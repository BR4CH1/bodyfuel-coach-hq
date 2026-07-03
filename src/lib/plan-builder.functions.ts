import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCoach(ctx: { supabase: any; userId: string }) {
  const { data: isCoach } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "coach",
  });
  if (!isCoach) throw new Error("Nur für Coaches.");
}

export type LibraryMeal = {
  id: string;
  name: string;
  description: string | null;
  category: "breakfast" | "lunch" | "dinner" | "snack" | "pre_workout" | "post_workout";
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion_label: string | null;
  ingredients: Array<{ name: string; amount_g?: number }>;
  instructions: string | null;
  tags: string[];
  no_go_ingredients: string[];
  suitable_training: boolean;
  suitable_rest: boolean;
  mealprep_ok: boolean;
  eat_cold: boolean;
  effort: "low" | "medium" | "high";
  budget: "low" | "medium" | "high";
  main_protein: string | null;
  main_carb: string | null;
};

export type CustomerPlanContext = {
  targets: {
    kcal_train: number; protein_train: number; carbs_train: number; fat_train: number;
    kcal_rest: number; protein_rest: number; carbs_rest: number; fat_rest: number;
  };
  favoriteFoods: string[];
  noGoFoods: string[];
  allergies: string[];
  intolerances: string[];
  dietStyle: string | null;
  budgetBand: string | null;
  mealPrepStyle: string | null;
  trainingWeekdays: number[]; // 0=Sun..6=Sat
};

export const listMealLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LibraryMeal[]> => {
    await assertCoach(context);
    const { data, error } = await context.supabase
      .from("coach_meal_library")
      .select("*")
      .eq("is_active", true)
      .order("category")
      .order("name");
    if (error) throw error;
    return (data ?? []) as unknown as LibraryMeal[];
  });

export const getCustomerPlanContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customerId: string }) => d)
  .handler(async ({ data, context }): Promise<CustomerPlanContext> => {
    await assertCoach(context);
    const [{ data: prof }, { data: tgt }] = await Promise.all([
      context.supabase.from("smart_nutrition_profile").select("*").eq("user_id", data.customerId).maybeSingle(),
      context.supabase.from("nutrition_targets").select("*").eq("user_id", data.customerId).maybeSingle(),
    ]);

    const toList = (v: any): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
      return String(v).split(/[,\n;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    };
    const merge = (...vs: any[]) => Array.from(new Set(vs.flatMap(toList)));

    return {
      targets: {
        kcal_train: Number(tgt?.kcal ?? 0),
        protein_train: Number(tgt?.protein_g ?? 0),
        carbs_train: Number(tgt?.carbs_g ?? 0),
        fat_train: Number(tgt?.fat_g ?? 0),
        kcal_rest: Number(tgt?.kcal_rest ?? tgt?.kcal ?? 0),
        protein_rest: Number(tgt?.protein_g_rest ?? tgt?.protein_g ?? 0),
        carbs_rest: Number(tgt?.carbs_g_rest ?? tgt?.carbs_g ?? 0),
        fat_rest: Number(tgt?.fat_g_rest ?? tgt?.fat_g ?? 0),
      },
      favoriteFoods: merge(prof?.favorite_foods, prof?.extra_favorites),
      noGoFoods: merge(prof?.nogo_foods, prof?.extra_nogos),
      allergies: merge(prof?.allergies, prof?.extra_allergies),
      intolerances: merge(prof?.intolerances),
      dietStyle: prof?.diet_style ?? null,
      budgetBand: prof?.budget_band ?? null,
      mealPrepStyle: prof?.meal_prep_style ?? null,
      trainingWeekdays: Array.isArray(prof?.training_weekdays) ? prof!.training_weekdays.map((n: any) => Number(n)) : [],
    };
  });

// Save a builder plan by adapting to existing importer.
export type BuilderMeal = {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  description?: string | null;
  ingredients: Array<{ name: string; grams: number }>;
  library_meal_id?: string | null;
  is_locked?: boolean;
  portion_factor?: number; // 1.0 = normale Portion
  linked_prep_group?: string | null;
};
export type BuilderDay = {
  name: string;
  type: "training" | "rest";
  meals: BuilderMeal[];
  prepCoupleLunchDinner?: boolean;
};

export const saveBuilderPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      customerId: string;
      title: string;
      startDate: string; // YYYY-MM-DD
      days: BuilderDay[];
      publish?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    const { saveCoachNutritionPlanDraft } = await import("./coach-plan-import.functions");
    const result = await saveCoachNutritionPlanDraft({
      data: {
        client_id: data.customerId,
        title: data.title,
        start_date: data.startDate,
        mode: "new_plan",
        force: true,
        plan: {
          title: data.title,
          days: data.days.map((d) => ({
            name: d.name,
            type: d.type,
            meals: d.meals.map((m) => ({
              slot: m.slot,
              name: m.name,
              description: m.description ?? null,
              ingredients: m.ingredients.map((i) => ({ name: i.name, grams: i.grams })),
            })),
          })),
        },
      },
    } as any);

    // Post-save: enrich saved meals with meal_slot / library_meal_id / is_locked
    if ((result as any)?.plan_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const planId = (result as any).plan_id as string;
      // Fetch created day rows with dates in order
      const { data: dayRows } = await supabaseAdmin
        .from("nutrition_plan_days")
        .select("id, day_date, name")
        .eq("plan_id", planId)
        .order("day_date");
      const dayIds = (dayRows ?? []).map((r: any) => r.id);
      for (let di = 0; di < data.days.length && di < dayIds.length; di++) {
        const dayId = dayIds[di];
        const { data: mealRows } = await supabaseAdmin
          .from("nutrition_plan_meals")
          .select("id, sort_order")
          .eq("day_id", dayId)
          .order("sort_order");
        const mealArr = mealRows ?? [];
        for (let mi = 0; mi < data.days[di].meals.length && mi < mealArr.length; mi++) {
          const src = data.days[di].meals[mi];
          await supabaseAdmin
            .from("nutrition_plan_meals")
            .update({
              meal_slot: src.slot,
              library_meal_id: src.library_meal_id ?? null,
              is_locked: !!src.is_locked,
            } as any)
            .eq("id", mealArr[mi].id);
        }
      }
      if (data.publish) {
        await supabaseAdmin
          .from("nutrition_plans")
          .update({ status: "active" } as any)
          .eq("id", planId);
      }
    }
    return result;
  });
