import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";
import {
  computeTrackerTargetsFromPlan,
  isNutritionPlanActiveOnDate,
  type TrackerPlanDay,
  type TrackerPlanMeal,
} from "@/lib/nutrition-tracker-targets.logic";

type NutritionTargetRow = {
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

type TrackerTargetsResult = NutritionTargetRow & {
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

export const getNutritionTrackerTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; date: string }) => {
    if (!data?.user_id) throw new Error("user_id fehlt");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error("Ungültiges Datum");
    return data;
  })
  .handler(async ({ data, context }): Promise<TrackerTargetsResult | null> => {
    if (data.user_id !== context.userId) {
      await assertCoachOrOrgStaffForAthlete(context, data.user_id, "nutrition");
    }

    // Use the server client only after the authenticated caller has been checked.
    // This lets the tracker read the same active-plan structure for clients and coaches
    // without widening browser-side RLS permissions.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: fallback }, { data: plan }] = await Promise.all([
      supabaseAdmin
        .from("nutrition_targets")
        .select(
          "kcal,protein_g,carbs_g,fat_g,water_glasses,kcal_rest,protein_g_rest,carbs_g_rest,fat_g_rest",
        )
        .eq("user_id", data.user_id)
        .maybeSingle(),
      supabaseAdmin
        .from("nutrition_plans")
        .select(
          "id,kcal,protein_g,carbs_g,fat_g,scheduled_start_date,scheduled_end_date",
        )
        .eq("client_id", data.user_id)
        .eq("plan_type", "nutrition")
        .eq("status", "active")
        .eq("performance_context", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const fallbackTargets = fallback as NutritionTargetRow | null;

    if (
      plan &&
      isNutritionPlanActiveOnDate(
        data.date,
        (plan as any).scheduled_start_date,
        (plan as any).scheduled_end_date,
      )
    ) {
      const { data: days } = await supabaseAdmin
        .from("nutrition_plan_days")
        .select(
          "id,name,day_type,target_kcal,target_protein_g,target_carbs_g,target_fat_g",
        )
        .eq("plan_id", (plan as any).id);

      const dayRows = ((days ?? []) as TrackerPlanDay[]).filter((day) => Boolean(day.id));
      let mealRows: TrackerPlanMeal[] = [];
      if (dayRows.length) {
        const { data: meals } = await supabaseAdmin
          .from("nutrition_plan_meals")
          .select("day_id,kcal,protein_g,carbs_g,fat_g")
          .in(
            "day_id",
            dayRows.map((day) => day.id),
          );
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
  });
