/**
 * BodyFuel Performance — Unified Onboarding Server Functions
 *
 * Zwei Server-Fns:
 *  - `savePerformanceNutritionPreferences` — sparse Upsert der SNP-Präferenzen
 *    (Diät, Allergien, Mealprep etc.). Persönliches BodyFuel-Smart bleibt
 *    unangetastet für Felder, die im Payload NICHT vorkommen.
 *  - `getPerformanceOnboardingCompletion` — Read-only Status: engineReady +
 *    mealPlanningReady, plus fehlende Feldliste für die UI.
 *
 * Beide sind bearer-authentifiziert. Der Wizard-Submit ruft weiterhin
 * `completeOrganizationOnboardingV2` für die Org-/PNP-Basisdaten und ruft
 * diese Fn parallel für die persönlichen Präferenzen auf.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OnboardingCompletionStatus = "COMPLETE" | "PARTIAL" | "MISSING";

export interface OnboardingCompletionResult {
  status: OnboardingCompletionStatus;
  engineReady: boolean;
  mealPlanningReady: boolean;
  missingPerformanceFields: string[];
  missingNutritionFields: string[];
  completionPercent: number;
}

const ENGINE_FIELDS = [
  "birthdate",
  "height_cm",
  "weight_kg",
  "sex_for_energy_calculation",
  "baseline_daily_activity",
  "performance_goal",
] as const;

const NUTRITION_FIELDS = [
  "diet_style",
  "meal_prep_style",
  "allergies",
  "intolerances",
] as const;

export const getPerformanceOnboardingCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { organizationId: string }) => d)
  .handler(async ({ data, context }): Promise<OnboardingCompletionResult> => {
    const { supabase, userId } = context;
    const [
      { data: profileRow },
      { data: bmRow },
      { data: pnpRow },
      { data: snpRow },
    ] = await Promise.all([
      supabase.from("profiles").select("birthdate, height_cm, gender").eq("id", userId).maybeSingle(),
      supabase
        .from("body_measurements")
        .select("weight_kg")
        .eq("user_id", userId)
        .not("weight_kg", "is", null)
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("performance_nutrition_profiles")
        .select("sex_for_energy_calculation, baseline_daily_activity, performance_goal")
        .eq("user_id", userId)
        .eq("organization_id", data.organizationId)
        .maybeSingle(),
      supabase
        .from("smart_nutrition_profile")
        .select("diet_style, meal_prep_style, allergies, intolerances")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const missingPerformanceFields: string[] = [];
    if (!profileRow?.birthdate) missingPerformanceFields.push("birthdate");
    if (!profileRow?.height_cm) missingPerformanceFields.push("height_cm");
    if (!bmRow?.weight_kg) missingPerformanceFields.push("weight_kg");
    if (!pnpRow?.sex_for_energy_calculation) missingPerformanceFields.push("sex_for_energy_calculation");
    if (!pnpRow?.baseline_daily_activity) missingPerformanceFields.push("baseline_daily_activity");
    if (!pnpRow?.performance_goal) missingPerformanceFields.push("performance_goal");

    const missingNutritionFields: string[] = [];
    if (!snpRow?.diet_style) missingNutritionFields.push("diet_style");
    if (!snpRow?.meal_prep_style) missingNutritionFields.push("meal_prep_style");
    // NULL (nie gepflegt) zählt als fehlend; leeres Array [] gilt als bewusst gepflegt.
    if ((snpRow?.allergies as unknown) == null) missingNutritionFields.push("allergies");
    if ((snpRow?.intolerances as unknown) == null) missingNutritionFields.push("intolerances");

    const engineReady = missingPerformanceFields.length === 0;
    const mealPlanningReady = missingNutritionFields.length === 0;

    const totalRequired = ENGINE_FIELDS.length + NUTRITION_FIELDS.length;
    const missingCount = missingPerformanceFields.length + missingNutritionFields.length;
    const completionPercent = Math.round(((totalRequired - missingCount) / totalRequired) * 100);

    const status: OnboardingCompletionStatus =
      engineReady && mealPlanningReady
        ? "COMPLETE"
        : missingCount === totalRequired
          ? "MISSING"
          : "PARTIAL";

    return {
      status,
      engineReady,
      mealPlanningReady,
      missingPerformanceFields,
      missingNutritionFields,
      completionPercent,
    };
  });

/**
 * Sparse Upsert der persönlichen SNP-Präferenzen. Nur Felder, die im
 * Payload explizit gesetzt sind, werden geschrieben — bestehende Werte
 * bleiben erhalten. Nach erfolgreichem Save wird optional ein
 * PERFORMANCE_PROFILE_COMPLETED-Job eingereiht.
 */
export const savePerformanceNutritionPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      organizationId: string;
      favorite_foods?: string[] | null;
      extra_favorites?: string | null;
      nogo_foods?: string[] | null;
      extra_nogos?: string | null;
      allergies?: string[] | null;
      extra_allergies?: string | null;
      intolerances?: string[] | null;
      diet_style?: string | null;
      diet_notes?: string | null;
      eating_style?: string | null;
      meal_prep_days?: number | null;
      meal_prep_style?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Sparse Patch: nur explizit gesetzte Felder ins UPDATE aufnehmen.
    const patch: Record<string, unknown> = { user_id: userId };
    const KEYS = [
      "favorite_foods",
      "extra_favorites",
      "nogo_foods",
      "extra_nogos",
      "allergies",
      "extra_allergies",
      "intolerances",
      "diet_style",
      "diet_notes",
      "eating_style",
      "meal_prep_days",
      "meal_prep_style",
    ] as const;
    for (const k of KEYS) {
      if ((data as Record<string, unknown>)[k] !== undefined) {
        patch[k] = (data as Record<string, unknown>)[k];
      }
    }

    const { error } = await supabase
      .from("smart_nutrition_profile")
      .upsert(patch as any, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    // Wenn Preferences jetzt vollständig sind, Auto-Plan-Job einreihen.
    // Der partielle Unique-Index verhindert Duplikate.
    const complete = await (async () => {
      const { data: snpRow } = await supabase
        .from("smart_nutrition_profile")
        .select("diet_style, meal_prep_style, allergies, intolerances")
        .eq("user_id", userId)
        .maybeSingle();
      return (
        !!snpRow?.diet_style &&
        !!snpRow?.meal_prep_style &&
        (snpRow as { allergies?: unknown }).allergies != null &&
        (snpRow as { intolerances?: unknown }).intolerances != null
      );
    })();

    let jobId: string | null = null;
    if (complete) {
      // Aktuelle Woche (Mo)
      const today = new Date();
      const day = today.getUTCDay();
      const monOffset = ((day + 6) % 7);
      today.setUTCDate(today.getUTCDate() - monOffset);
      const weekStart = today.toISOString().slice(0, 10);
      const { data: jobRow } = await supabase
        .from("performance_plan_jobs")
        .insert({
          organization_id: data.organizationId,
          team_id: null,
          athlete_user_id: userId,
          week_start: weekStart,
          trigger: "PERFORMANCE_PROFILE_COMPLETED",
          status: "pending",
          created_by: userId,
        })
        .select("id")
        .maybeSingle();
      jobId = (jobRow as { id: string } | null)?.id ?? null;
    }

    return { ok: true as const, jobId, mealPlanningReady: complete };
  });
