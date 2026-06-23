import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { daysUntilNextShopping } from "./shopping-cycle";

export type PlanStatus = "draft" | "approved" | "published" | "active" | "archived";

export type PlanSummary = {
  id: string;
  title: string;
  status: PlanStatus;
  source: string;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  activated_at: string | null;
  archived_at: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
  days_count: number;
  meals_count: number;
  compliance: { score: number; tone: "green" | "yellow" | "red"; days_tracked: number } | null;
};

// Max daily check score = 15 (matches compute_daily_check_points trigger weights).
const MAX_DAILY_POINTS = 15;

async function computeCompliance(
  supabase: any,
  clientId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<PlanSummary["compliance"]> {
  if (!fromIso) return null;
  const from = fromIso.slice(0, 10);
  const to = (toIso ?? new Date().toISOString()).slice(0, 10);
  const { data: checks } = await supabase
    .from("daily_checks")
    .select("points, check_date")
    .eq("user_id", clientId)
    .gte("check_date", from)
    .lte("check_date", to);
  const rows = (checks ?? []) as any[];
  if (!rows.length) return { score: 0, tone: "red", days_tracked: 0 };
  const avg =
    rows.reduce((s, r) => s + (Number(r.points) || 0), 0) / rows.length;
  const score = Math.round(Math.min(100, (avg / MAX_DAILY_POINTS) * 100));
  const tone: "green" | "yellow" | "red" =
    score >= 75 ? "green" : score >= 50 ? "yellow" : "red";
  return { score, tone, days_tracked: rows.length };
}

async function requireCoach(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
  if (!data) throw new Error("Forbidden");
}

async function loadPlan(supabase: any, id: string): Promise<PlanSummary | null> {
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select(
      "id, client_id, title, status, source, scheduled_start_date, scheduled_end_date, activated_at, archived_at, kcal, protein_g, carbs_g, fat_g, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!plan) return null;
  const { data: days } = await supabase
    .from("nutrition_plan_days")
    .select("id")
    .eq("plan_id", id);
  const dayIds = (days ?? []).map((d: any) => d.id);
  let mealsCount = 0;
  if (dayIds.length) {
    const { count } = await supabase
      .from("nutrition_plan_meals")
      .select("id", { count: "exact", head: true })
      .in("day_id", dayIds);
    mealsCount = count ?? 0;
  }
  const p: any = plan;
  let compliance: PlanSummary["compliance"] = null;
  if (p.status === "active" || p.status === "archived") {
    compliance = await computeCompliance(
      supabase,
      p.client_id,
      p.activated_at,
      p.archived_at,
    );
  }
  return {
    ...p,
    days_count: dayIds.length,
    meals_count: mealsCount,
    compliance,
  };
}

export const getCustomerPlanOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id !== userId) await requireCoach(supabase, userId);

    const { data: rows } = await supabase
      .from("nutrition_plans")
      .select(
        "id, title, status, source, scheduled_start_date, scheduled_end_date, activated_at, archived_at, kcal, protein_g, carbs_g, fat_g, created_at",
      )
      .eq("client_id", data.user_id)
      .eq("plan_type", "nutrition")
      .order("created_at", { ascending: false });

    const all = (rows ?? []) as any[];
    const active = all.find((p) => p.status === "active") ?? null;
    const next =
      all.find((p) => ["draft", "approved", "published"].includes(p.status)) ?? null;
    const archive = all.filter((p) => p.status === "archived").slice(0, 25);

    const [activeFull, nextFull] = await Promise.all([
      active ? loadPlan(supabase, active.id) : Promise.resolve(null),
      next ? loadPlan(supabase, next.id) : Promise.resolve(null),
    ]);

    // also include shopping days for "next shopping" hint
    const { data: prof } = await supabase
      .from("smart_nutrition_profile")
      .select("shopping_days, auto_publish")
      .eq("user_id", data.user_id)
      .maybeSingle();

    return {
      active: activeFull,
      next: nextFull,
      archive: await Promise.all(
        archive.map(async (p) => ({
          ...p,
          days_count: 0,
          meals_count: 0,
          compliance: await computeCompliance(
            supabase,
            data.user_id,
            p.activated_at,
            p.archived_at,
          ),
        })),
      ),
      shopping_days: (prof as any)?.shopping_days ?? [],
      auto_publish: (prof as any)?.auto_publish ?? false,
      days_until_next_shopping: daysUntilNextShopping((prof as any)?.shopping_days),
    };
  });

export const transitionPlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_id: string; to: PlanStatus }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan } = await supabase
      .from("nutrition_plans")
      .select("id, client_id, plan_type, status, source, kcal, protein_g, carbs_g, fat_g")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan nicht gefunden");

    // Self-Service erlaubt: Kunden dürfen ihren eigenen Plan in jeden Status
    // überführen (insb. Smart-Kunden, die ihren Entwurf selbst aktivieren).
    if ((plan as any).client_id !== userId) {
      await requireCoach(supabase, userId);
    }

    // If transitioning to active, archive the currently active plan first
    if (data.to === "active") {
      await supabase
        .from("nutrition_plans")
        .update({ status: "archived" })
        .eq("client_id", (plan as any).client_id)
        .eq("plan_type", (plan as any).plan_type)
        .eq("status", "active")
        .neq("id", data.plan_id);
    }

    const { error } = await supabase
      .from("nutrition_plans")
      .update({ status: data.to })
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);

    // When a nutrition plan is approved, pre-generate the shopping list so
    // the customer can already see it before the plan becomes active.
    if (data.to === "approved" && (plan as any).plan_type === "nutrition") {
      try {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (apiKey) {
          const { generateShoppingListForPlan } = await import("./shopping-list-engine.server");
          const { data: prof } = await supabase
            .from("smart_nutrition_profile")
            .select("shopping_days")
            .eq("user_id", (plan as any).client_id)
            .maybeSingle();
          const windowDays = daysUntilNextShopping((prof as any)?.shopping_days);
          await generateShoppingListForPlan({
            supabase,
            apiKey,
            planId: data.plan_id,
            windowDays,
          });
        }
      } catch (e) {
        console.warn("auto shopping list on approval failed", e);
      }
    }

    // Auto-apply nutrition targets when a plan becomes active
    if (data.to === "active") {
      try {
        const { computeTargetsFromPlanDB, deriveRestFromTraining } = await import("./nutrition.functions");
        const t = await computeTargetsFromPlanDB(supabase, data.plan_id);
        let kcal: number | null = null, protein_g = 0, carbs_g = 0, fat_g = 0;
        let kcal_rest: number | null = null, protein_g_rest: number | null = null;
        let carbs_g_rest: number | null = null, fat_g_rest: number | null = null;
        if (t && t.kcal > 0) {
          kcal = t.kcal; protein_g = t.protein_g; carbs_g = t.carbs_g; fat_g = t.fat_g;
          kcal_rest = t.kcal_rest; protein_g_rest = t.protein_g_rest;
          carbs_g_rest = t.carbs_g_rest; fat_g_rest = t.fat_g_rest;
          const shouldDeriveRest =
            (plan as any).source === "smart_ai" ||
            kcal_rest == null ||
            kcal_rest >= kcal ||
            (carbs_g_rest ?? 0) >= carbs_g;
          if (shouldDeriveRest) {
            const rest = deriveRestFromTraining({ kcal, protein_g, carbs_g, fat_g });
            kcal_rest = rest.kcal; protein_g_rest = rest.protein_g;
            carbs_g_rest = rest.carbs_g; fat_g_rest = rest.fat_g;
          }
        } else if ((plan as any).kcal && Number((plan as any).kcal) > 0) {
          const { data: pRow } = await supabase
            .from("nutrition_plans")
            .select("kcal, protein_g, carbs_g, fat_g")
            .eq("id", data.plan_id)
            .maybeSingle();
          if (pRow && (pRow as any).kcal) {
            kcal = Number((pRow as any).kcal);
            protein_g = Number((pRow as any).protein_g) || 0;
            carbs_g = Number((pRow as any).carbs_g) || 0;
            fat_g = Number((pRow as any).fat_g) || 0;
            const rest = deriveRestFromTraining({ kcal, protein_g, carbs_g, fat_g });
            kcal_rest = rest.kcal; protein_g_rest = rest.protein_g;
            carbs_g_rest = rest.carbs_g; fat_g_rest = rest.fat_g;
          }
        }
        // Auf 50-kcal-Schritte runden, damit die UI runde Werte zeigt.
        const round50 = (v: number | null) => v == null ? null : Math.max(0, Math.round(v / 50) * 50);
        if (kcal) kcal = round50(kcal)!;
        if (kcal_rest != null) kcal_rest = round50(kcal_rest);
        if (kcal && kcal > 0) {
          // Preserve existing water_glasses if present
          const { data: existing } = await supabase
            .from("nutrition_targets")
            .select("water_glasses")
            .eq("user_id", (plan as any).client_id)
            .maybeSingle();
          await supabase.from("nutrition_targets").upsert(
            {
              user_id: (plan as any).client_id,
              kcal, protein_g, carbs_g, fat_g,
              water_glasses: (existing as any)?.water_glasses ?? 8,
              kcal_rest, protein_g_rest, carbs_g_rest, fat_g_rest,
              updated_by: userId,
            },
            { onConflict: "user_id" },
          );
        }
      } catch (e) {
        console.warn("auto-apply targets failed", e);
      }
    }

    return { ok: true, status: data.to };
  });

export const deletePlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireCoach(supabase, userId);
    const { data: plan } = await supabase
      .from("nutrition_plans")
      .select("status")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan nicht gefunden");
    if ((plan as any).status === "active")
      throw new Error("Aktiver Plan kann nicht gelöscht werden — erst archivieren.");
    const { error } = await supabase
      .from("nutrition_plans")
      .delete()
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePlanScheduling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      plan_id: string;
      scheduled_start_date?: string | null;
      scheduled_end_date?: string | null;
      title?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireCoach(supabase, userId);
    const patch: any = {};
    if (data.scheduled_start_date !== undefined)
      patch.scheduled_start_date = data.scheduled_start_date;
    if (data.scheduled_end_date !== undefined)
      patch.scheduled_end_date = data.scheduled_end_date;
    if (data.title !== undefined) patch.title = data.title;
    const { error } = await supabase
      .from("nutrition_plans")
      .update(patch)
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAutoPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; auto_publish: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id !== userId) await requireCoach(supabase, userId);
    const { error } = await supabase
      .from("smart_nutrition_profile")
      .upsert(
        { user_id: data.user_id, auto_publish: data.auto_publish },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPlanPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase
      .from("nutrition_plans")
      .select(
        "id, client_id, title, status, source, plan_type, scheduled_start_date, scheduled_end_date, kcal, protein_g, carbs_g, fat_g, created_at",
      )
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan nicht gefunden");
    if ((plan as any).client_id !== userId) await requireCoach(supabase, userId);

    const planType = (plan as any).plan_type ?? "nutrition";

    if (planType === "training") {
      const { data: days } = await supabase
        .from("training_days")
        .select("id, name, sort_order, week_number")
        .eq("plan_id", data.plan_id)
        .order("week_number")
        .order("sort_order");
      const dayList = (days ?? []) as any[];
      let exercises: any[] = [];
      if (dayList.length) {
        const { data: ex } = await supabase
          .from("training_exercises")
          .select(
            "id, day_id, name, category, target_sets, target_reps, target_weights, rest_seconds, notes, sort_order",
          )
          .in("day_id", dayList.map((d) => d.id))
          .order("sort_order");
        exercises = (ex ?? []) as any[];
      }
      return { plan, days: dayList, meals: [], exercises, planType };
    }

    const { data: days } = await supabase
      .from("nutrition_plan_days")
      .select("id, name, sort_order")
      .eq("plan_id", data.plan_id)
      .order("sort_order");
    const dayList = (days ?? []) as any[];

    let meals: any[] = [];
    if (dayList.length) {
      const { data: m } = await supabase
        .from("nutrition_plan_meals")
        .select("id, day_id, name, description, kcal, protein_g, carbs_g, fat_g, sort_order")
        .in("day_id", dayList.map((d) => d.id))
        .order("sort_order");
      meals = (m ?? []) as any[];
    }

    return { plan, days: dayList, meals, exercises: [], planType };
  });
