import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Smart-Paket Verlängerung:
 * - Ernährungsplan: 1 Monat (30 Tage)
 * - Trainingsplan: 1 Monat (4 Wochen), aber nur freigegeben wenn letzter
 *   Strength-Check < 30 Tage alt ist. Sonst muss vorher ein neuer Check her.
 *
 * Verlängerung ist nur erlaubt, wenn der aktuelle Plan in den nächsten 7 Tagen
 * abläuft ODER bereits abgelaufen ist — kein vorzeitiges Spammen.
 */

async function assertSmart(supabase: any, userId: string) {
  const { data } = await supabase
    .from("customer_packages")
    .select("package, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.package !== "smart") {
    throw new Error("Nur für Smart-Kunden verfügbar.");
  }
}

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil(
    (new Date(`${date}T23:59:59Z`).getTime() - Date.now()) / 86_400_000,
  );
}

async function getActivePlan(
  supabase: any,
  userId: string,
  planType: "nutrition" | "training",
) {
  const { data } = await supabase
    .from("nutrition_plans")
    .select("id, scheduled_end_date, scheduled_start_date, status")
    .eq("client_id", userId)
    .eq("plan_type", planType)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function getLastStrengthCheck(supabase: any, userId: string) {
  const { data } = await supabase
    .from("strength_checks")
    .select("id, performed_at, completed_at, status")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("performed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export const getSmartRenewalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: pkg } = await supabase
      .from("customer_packages")
      .select("package, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const isSmart = pkg?.package === "smart";

    const { hasActiveSmartSubscription } = await import("./smart-subscription.server");
    const sub = await hasActiveSmartSubscription(supabase, userId);

    const [nutrition, training, lastCheck] = await Promise.all([
      getActivePlan(supabase, userId, "nutrition"),
      getActivePlan(supabase, userId, "training"),
      getLastStrengthCheck(supabase, userId),
    ]);

    const nDays = daysUntil(nutrition?.scheduled_end_date);
    const tDays = daysUntil(training?.scheduled_end_date);
    const checkAgeDays = lastCheck?.performed_at
      ? Math.floor(
          (Date.now() - new Date(lastCheck.performed_at).getTime()) / 86_400_000,
        )
      : null;
    const strengthCheckStale = checkAgeDays == null ? true : checkAgeDays > 30;

    return {
      is_smart: isSmart,
      subscription: {
        active: sub.active,
        status: sub.status,
        period_end: sub.period_end,
      },
      nutrition: {
        end_date: nutrition?.scheduled_end_date ?? null,
        days_until_end: nDays,
        can_renew: sub.active && (nDays == null || nDays <= 7),
        blocked_by_subscription: !sub.active,
      },
      training: {
        end_date: training?.scheduled_end_date ?? null,
        days_until_end: tDays,
        can_renew: sub.active && (tDays == null || tDays <= 7) && !strengthCheckStale,
        blocked_by_strength_check: strengthCheckStale,
        blocked_by_subscription: !sub.active,
        last_check_days_ago: checkAgeDays,
      },
    };
  });

export const renewSmartNutritionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSmart(supabase, userId);
    const { hasActiveSmartSubscription } = await import("./smart-subscription.server");
    const sub = await hasActiveSmartSubscription(supabase, userId);
    if (!sub.active) {
      throw new Error(
        "Verlängerung nicht möglich — bitte zuerst Zahlung/Abo aktualisieren.",
      );
    }

    const current = await getActivePlan(supabase, userId, "nutrition");
    const days = daysUntil(current?.scheduled_end_date);
    if (current && days != null && days > 7) {
      throw new Error(
        `Aktueller Plan läuft noch ${days} Tage. Verlängerung ist erst in der letzten Woche möglich.`,
      );
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI-Service nicht erreichbar.");

    const { generateAiNutritionPlanCore } = await import(
      "./nutrition-plan-ai.functions"
    );
    await generateAiNutritionPlanCore(supabase, {
      target: userId,
      uploadedBy: userId,
      start_mode: "today",
      plan_days: 28,
      apiKey,
    });
    await activateLatest(supabase, userId, "nutrition");
    return { ok: true };
  });

export const renewSmartTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSmart(supabase, userId);
    const { hasActiveSmartSubscription } = await import("./smart-subscription.server");
    const sub = await hasActiveSmartSubscription(supabase, userId);
    if (!sub.active) {
      throw new Error(
        "Verlängerung nicht möglich — bitte zuerst Zahlung/Abo aktualisieren.",
      );
    }

    const lastCheck = await getLastStrengthCheck(supabase, userId);
    const checkAgeDays = lastCheck?.performed_at
      ? Math.floor(
          (Date.now() - new Date(lastCheck.performed_at).getTime()) / 86_400_000,
        )
      : null;
    if (checkAgeDays == null || checkAgeDays > 28) {
      throw new Error(
        "Bitte zuerst einen neuen Strength-Check durchführen — der letzte ist älter als 4 Wochen.",
      );
    }

    const current = await getActivePlan(supabase, userId, "training");
    const days = daysUntil(current?.scheduled_end_date);
    if (current && days != null && days > 7) {
      throw new Error(
        `Aktueller Trainingsplan läuft noch ${days} Tage. Verlängerung ist erst in der letzten Woche möglich.`,
      );
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI-Service nicht erreichbar.");

    const { generateTrainingPlanCore } = await import(
      "./training-plan-ai-core.server"
    );
    await generateTrainingPlanCore(supabase, {
      target: userId,
      uploadedBy: userId,
      startMode: "today",
      apiKey,
      weeks: 6,
    });
    await activateLatest(supabase, userId, "training");
    return { ok: true };
  });

async function activateLatest(
  supabase: any,
  userId: string,
  planType: "nutrition" | "training",
) {
  const { data: draft } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("client_id", userId)
    .eq("plan_type", planType)
    .in("status", ["draft", "approved", "published"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draft) return;
  await supabase
    .from("nutrition_plans")
    .update({ status: "archived" })
    .eq("client_id", userId)
    .eq("plan_type", planType)
    .eq("status", "active");
  await supabase
    .from("nutrition_plans")
    .update({ status: "active" })
    .eq("id", draft.id);
}
