import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * BodyFuel Smart Onboarding — speichert alle Pflichtfelder, markiert den
 * Onboarding-Abschluss am Profil und triggert die Autopilot-Generierung
 * (Ernährungs- und Trainingsplan) im Hintergrund.
 *
 * Coach-Freigabe ist NICHT erforderlich. Der Nutzer kann sofort starten.
 */
export type SmartOnboardingInput = {
  // Persönlich
  height_cm?: number | null;
  gender?: "male" | "female" | "other" | null;
  birthdate?: string | null;
  weight_kg?: number | null;
  goal_weight_kg?: number | null;
  // Ziel
  training_goal?: "fat_loss" | "lean_bulk" | "performance" | "recomp" | null;
  // Training
  training_experience?: "beginner" | "intermediate" | "advanced" | null;
  training_location?: "gym" | "home_gym" | "home" | null;
  training_equipment?: "machines" | "free_weights" | "both" | null;
  training_weekdays?: string[];
  training_duration_min?: number | null;
  // Ernährung
  eating_style?: "meal_prep" | "fresh" | "mixed" | null;
  meal_prep_days?: number | null;
  shopping_days?: string[];
  shopping_lead_days?: number | null;
  budget_band?: "<50" | "50_75" | "75_100" | ">100" | null;
  weekly_budget_eur?: number | null;
  variety_level?: "low" | "medium" | "high" | null;
  // Lebensmittel
  favorite_foods?: string[];
  nogo_foods?: string[];
  allergies?: string[];
  intolerances?: string[];
  extra_favorites?: string | null;
  extra_nogos?: string | null;
  extra_allergies?: string | null;
};

export const completeSmartOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SmartOnboardingInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Profil-Stammdaten upserten
    const profilePatch: Record<string, any> = {};
    if (data.height_cm != null) profilePatch.height_cm = data.height_cm;
    if (data.gender) profilePatch.gender = data.gender;
    if (data.birthdate) profilePatch.birthdate = data.birthdate;
    if (data.goal_weight_kg != null) profilePatch.goal_weight_kg = data.goal_weight_kg;
    if (data.training_goal) profilePatch.training_goal = data.training_goal;
    profilePatch.smart_onboarding_completed_at = new Date().toISOString();

    const { error: pErr } = await supabase
      .from("profiles")
      .update(profilePatch as any)
      .eq("id", userId);
    if (pErr) throw new Error(pErr.message);

    // 2) Startgewicht in body_measurements (löst macro-Trigger aus)
    if (data.weight_kg != null) {
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from("body_measurements").insert({
        user_id: userId,
        weight_kg: data.weight_kg,
        measured_at: today,
      });
    }

    // 3) smart_nutrition_profile upserten
    const snp: Record<string, any> = { user_id: userId };
    const map: Array<keyof SmartOnboardingInput> = [
      "eating_style",
      "meal_prep_days",
      "variety_level",
      "intolerances",
      "training_experience",
      "training_location",
      "training_equipment",
      "training_duration_min",
      "training_weekdays",
      "shopping_days",
      "shopping_lead_days",
      "budget_band",
      "weekly_budget_eur",
      "favorite_foods",
      "nogo_foods",
      "allergies",
      "extra_favorites",
      "extra_nogos",
      "extra_allergies",
    ];
    for (const k of map) {
      const v = data[k];
      if (v !== undefined) snp[k] = v;
    }
    snp.completed_at = new Date().toISOString();
    snp.auto_publish = true;

    const { error: sErr } = await supabase
      .from("smart_nutrition_profile")
      .upsert(snp as any, { onConflict: "user_id" });
    if (sErr) throw new Error(sErr.message);

    // 4) Autopilot triggern — Training (6 Wochen) + Ernährung (28 Tage). Best effort.
    const apiKey = process.env.LOVABLE_API_KEY;
    const results = { nutrition: false, training: false, errors: [] as string[] };
    if (!apiKey) {
      results.errors.push("LOVABLE_API_KEY fehlt — Pläne werden später erstellt.");
      return { ok: true, ...results };
    }

    // Trainingsplan (6 Wochen) + sofort aktivieren
    try {
      const { generateTrainingPlanCore } = await import("./training-plan-ai-core.server");
      await generateTrainingPlanCore(supabase, {
        target: userId,
        uploadedBy: userId,
        startMode: "today",
        apiKey,
        weeks: 6,
      });
      await activateLatestPlan(supabase, userId, "training");
      results.training = true;
    } catch (e) {
      results.errors.push("training: " + (e as Error).message);
    }

    // Ernährungsplan (28 Tage) + sofort aktivieren
    try {
      const { generateAiNutritionPlanCore } = await import("./nutrition-plan-ai.functions");
      await generateAiNutritionPlanCore(supabase, {
        target: userId,
        uploadedBy: userId,
        start_mode: "today",
        plan_days: 28,
        apiKey,
      });
      await activateLatestPlan(supabase, userId, "nutrition");
      results.nutrition = true;
    } catch (e) {
      results.errors.push("nutrition: " + (e as Error).message);
    }

    return { ok: true, ...results };
  });

async function activateLatestPlan(
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

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("smart_onboarding_completed_at")
      .eq("id", userId)
      .maybeSingle();
    return {
      completed: !!data?.smart_onboarding_completed_at,
      completed_at: data?.smart_onboarding_completed_at ?? null,
    };
  });
