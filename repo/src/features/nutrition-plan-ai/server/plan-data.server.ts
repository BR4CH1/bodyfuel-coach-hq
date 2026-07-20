import type {
  ClientProfileSource,
  MealFavoriteSource,
  MealInteractionSource,
  MealRatingSource,
  MealSkipSource,
  MealWishSource,
  NutritionPlanSourceData,
  NutritionPlanSupabaseClient,
  NutritionTargetSource,
  SafeFoodSource,
  SmartNutritionProfileSource,
  WeightMeasurementSource,
} from "@/features/nutrition-plan-ai/types";

type SafePoolRow = {
  text_id?: string | null;
  name?: string | null;
  aliases?: string[] | null;
};

export async function loadNutritionPlanSourceData(
  supabase: NutritionPlanSupabaseClient,
  target: string,
): Promise<NutritionPlanSourceData> {
  const [
    { data: profile },
    { data: clientProfile },
    { data: latestWeight },
    { data: targets },
    { data: ratings },
    { data: favorites },
    { data: skips },
    { data: swaps },
    { data: wishes },
    { data: safePoolRows },
  ] = await Promise.all([
    supabase.from("smart_nutrition_profile").select("*").eq("user_id", target).maybeSingle(),
    supabase
      .from("profiles")
      .select(
        "display_name, height_cm, birthdate, gender, goal_weight_kg, activity_level, coaching_goal, training_goal",
      )
      .eq("id", target)
      .maybeSingle(),
    supabase
      .from("body_measurements")
      .select("weight_kg, measured_at")
      .eq("user_id", target)
      .not("weight_kg", "is", null)
      .order("measured_at", { ascending: false })
      .limit(30),
    supabase
      .from("nutrition_targets")
      .select(
        "kcal, protein_g, carbs_g, fat_g, kcal_rest, protein_g_rest, carbs_g_rest, fat_g_rest",
      )
      .eq("user_id", target)
      .maybeSingle(),
    supabase
      .from("meal_ratings")
      .select("stars, meal:nutrition_plan_meals!inner(name)")
      .eq("user_id", target)
      .limit(30),
    supabase
      .from("meal_favorites")
      .select("meal:nutrition_plan_meals!inner(name)")
      .eq("user_id", target)
      .limit(20),
    supabase.from("meal_skips").select("meal_name, reason").eq("user_id", target).limit(20),
    supabase
      .from("meal_interactions")
      .select("kind, meal:nutrition_plan_meals!inner(name)")
      .eq("user_id", target)
      .eq("kind", "swapped")
      .limit(30),
    supabase
      .from("meal_wishes")
      .select("id, wish, applies_to")
      .eq("user_id", target)
      .eq("status", "approved")
      .is("consumed_at", null),
    supabase
      .from("nutrition_foods")
      .select("text_id,name,aliases")
      .eq("safe_for_smart", true)
      .eq("is_active", true)
      .eq("verified_by_coach", true)
      .order("name", { ascending: true })
      .limit(600),
  ]);

  const safeFoods: SafeFoodSource[] = ((safePoolRows ?? []) as SafePoolRow[])
    .filter((row): row is SafePoolRow & { text_id: string; name: string } =>
      Boolean(row?.text_id && row?.name),
    )
    .map((row) => ({
      text_id: String(row.text_id),
      name: String(row.name),
      aliases: Array.isArray(row.aliases) ? row.aliases.slice(0, 4) : [],
    }));

  return {
    profile: (profile ?? {}) as SmartNutritionProfileSource,
    clientProfile: (clientProfile ?? {}) as ClientProfileSource,
    weightSeries: (latestWeight ?? []) as WeightMeasurementSource[],
    targets: (targets as NutritionTargetSource | null) ?? null,
    ratings: (ratings ?? []) as MealRatingSource[],
    favorites: (favorites ?? []) as MealFavoriteSource[],
    skips: (skips ?? []) as MealSkipSource[],
    swaps: (swaps ?? []) as MealInteractionSource[],
    wishes: (wishes ?? []) as MealWishSource[],
    safeFoods,
  };
}
