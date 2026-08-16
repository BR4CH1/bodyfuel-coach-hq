import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";
import {
  computeTrackerTargetsFromPlan,
  isNutritionPlanActiveOnDate,
  type TrackerPlanDay,
  type TrackerPlanMeal,
} from "@/lib/nutrition-tracker-targets.logic";

export type EffectiveNutritionTargetRow = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_glasses: number;
  kcal_rest: number | null;
  protein_g_rest: number | null;
  carbs_g_rest: number | null;
  fat_g_rest: number | null;
};

export type EffectiveNutritionTargetsResult = EffectiveNutritionTargetRow & {
  source: "active_plan" | "nutrition_targets";
  plan_id?: string;
};

function roundKcal(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.max(50, Math.round(number / 50) * 50) : 0;
}

function roundMacro(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

/**
 * Single source of truth for personal nutrition targets.
 * An active nutrition plan wins inside its scheduled date range; nutrition_targets
 * remains the fallback outside that range or when no computable active plan exists.
 */
export async function loadEffectiveNutritionTargets(
  db: any,
  userId: string,
  date: string,
): Promise<EffectiveNutritionTargetsResult | null> {
  const [{ data: fallback, error: fallbackError }, { data: plan, error: planError }] =
    await Promise.all([
      db
        .from("nutrition_targets")
        .select(
          "kcal,protein_g,carbs_g,fat_g,water_glasses,kcal_rest,protein_g_rest,carbs_g_rest,fat_g_rest",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from("nutrition_plans")
        .select(
          "id,kcal,protein_g,carbs_g,fat_g,scheduled_start_date,scheduled_end_date",
        )
        .eq("client_id", userId)
        .eq("plan_type", "nutrition")
        .eq("status", "active")
        .eq("performance_context", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (fallbackError) throw new Error(fallbackError.message);
  if (planError) throw new Error(planError.message);

  const fallbackTargets = fallback as EffectiveNutritionTargetRow | null;

  if (
    plan &&
    isNutritionPlanActiveOnDate(
      date,
      (plan as any).scheduled_start_date,
      (plan as any).scheduled_end_date,
    )
  ) {
    const { data: days, error: daysError } = await db
      .from("nutrition_plan_days")
      .select(
        "id,name,day_type,target_kcal,target_protein_g,target_carbs_g,target_fat_g",
      )
      .eq("plan_id", (plan as any).id);
    if (daysError) throw new Error(daysError.message);

    const dayRows = ((days ?? []) as TrackerPlanDay[]).filter((day) => Boolean(day.id));
    let mealRows: TrackerPlanMeal[] = [];
    if (dayRows.length) {
      const { data: meals, error: mealsError } = await db
        .from("nutrition_plan_meals")
        .select("day_id,kcal,protein_g,carbs_g,fat_g")
        .in(
          "day_id",
          dayRows.map((day) => day.id),
        );
      if (mealsError) throw new Error(mealsError.message);
      mealRows = (meals ?? []) as TrackerPlanMeal[];
    }

    const derived = computeTrackerTargetsFromPlan(dayRows, mealRows);
    if (derived) {
      return {
        ...derived,
        water_glasses: Number(fallbackTargets?.water_glasses) || 8,
        source: "active_plan",
        plan_id: (plan as any).id,
      };
    }

    // Plans without computable meal/day totals still have their aggregate plan target.
    const planKcal = roundKcal((plan as any).kcal);
    if (planKcal > 0) {
      return {
        kcal: planKcal,
        protein_g: roundMacro((plan as any).protein_g),
        carbs_g: roundMacro((plan as any).carbs_g),
        fat_g: roundMacro((plan as any).fat_g),
        water_glasses: Number(fallbackTargets?.water_glasses) || 8,
        kcal_rest: null,
        protein_g_rest: null,
        carbs_g_rest: null,
        fat_g_rest: null,
        source: "active_plan",
        plan_id: (plan as any).id,
      };
    }
  }

  if (!fallbackTargets) return null;
  return { ...fallbackTargets, source: "nutrition_targets" };
}

export const getNutritionTrackerTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; date: string }) => {
    if (!data?.user_id) throw new Error("user_id fehlt");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error("Ungültiges Datum");
    return data;
  })
  .handler(async ({ data, context }): Promise<EffectiveNutritionTargetsResult | null> => {
    if (data.user_id !== context.userId) {
      await assertCoachOrOrgStaffForAthlete(context, data.user_id, "nutrition");
    }

    // Use the server client only after the authenticated caller has been checked.
    // This lets tracker and coach tools resolve the exact same active-plan targets
    // without widening browser-side RLS permissions.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return loadEffectiveNutritionTargets(supabaseAdmin, data.user_id, data.date);
  });
