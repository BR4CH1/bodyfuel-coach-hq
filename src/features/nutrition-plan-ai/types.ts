import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type PlanDayType = "training" | "rest";
export type GoalDirection = "cut" | "bulk" | "maintain";

export type AiIngredient = {
  food_id?: string | null;
  name: string;
  amount?: number;
  unit?: string;
  grams?: number;
};

export type GeneratedMeal = {
  slot: MealSlot;
  name: string;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients?: AiIngredient[];
};

export type ComputedGeneratedMeal = GeneratedMeal & {
  _compute_warnings?: string[];
  _data_source?: string;
  _verified_ratio?: number;
};

export type GeneratedDay = {
  name: string;
  type?: PlanDayType;
  meals: GeneratedMeal[];
};

export type MacroTarget = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type PlanScheduleDay = {
  wkKey?: string;
  wkLabel: string;
  type: PlanDayType;
};

export type RawPlanDay = {
  name: string;
  type: PlanDayType;
  target: MacroTarget;
  meals: GeneratedMeal[];
};

export type CleanedPlanDay = {
  name: string;
  type: PlanDayType;
  meals: ComputedGeneratedMeal[];
};

export type UnresolvedIngredient = {
  day: string;
  meal: string;
  name: string;
  food_id: string | null;
};

export type GenerateNutritionPlanOpts = {
  target: string;
  uploadedBy?: string | null;
  scheduled_start_date?: string | null;
  title?: string;
  start_mode?: "today" | "next_shopping";
  plan_days?: number | null;
  apiKey: string;
};

export type GenerateNutritionPlanInput = {
  user_id: string;
  scheduled_start_date?: string | null;
  title?: string;
  start_mode?: "today" | "next_shopping";
  plan_days?: number | null;
};

export type NutritionPlanSupabaseClient = SupabaseClient<Database>;

export type PersistNutritionPlanInput = {
  supabase: NutritionPlanSupabaseClient;
  target: string;
  uploadedBy: string;
  apiKey: string;
  title?: string;
  start: Date;
  planDays: number;
  cleaned: CleanedPlanDay[];
  unresolved: UnresolvedIngredient[];
  wishesData: Array<{ id: string; wish: string }>;
};

export type NutritionPlanGenerationResult = {
  ok: true;
  plan_id: string;
  status: "draft" | "needs_review";
  needs_review: boolean;
  unresolved: Array<{ meal: string; name: string; food_id: string | null }>;
  days: number;
  meals: number;
  avg_kcal: number;
  scheduled_start_date: string;
  scheduled_end_date: string;
};

export type ClientProfileSource = {
  display_name?: string | null;
  height_cm?: number | null;
  birthdate?: string | null;
  gender?: string | null;
  goal_weight_kg?: number | null;
  activity_level?: string | null;
  coaching_goal?: string | null;
  training_goal?: string | null;
};

export type WeightMeasurementSource = {
  weight_kg: number | null;
  measured_at: string;
};

export type MealRelationSource = { name?: string | null } | null;

export type MealRatingSource = {
  stars: number;
  meal?: MealRelationSource;
};

export type MealFavoriteSource = {
  meal?: MealRelationSource;
};

export type MealSkipSource = {
  meal_name?: string | null;
  reason?: string | null;
};

export type MealInteractionSource = {
  meal?: MealRelationSource;
};

export type MealWishSource = {
  id: string;
  wish: string;
  applies_to?: string | null;
};

export type SmartNutritionProfileSource = {
  allergies?: string[] | null;
  extra_allergies?: string | null;
  nogo_foods?: string[] | null;
  extra_nogos?: string | null;
  favorite_foods?: string[] | null;
  extra_favorites?: string | null;
  meal_prep_style?: string | null;
  weekly_budget_eur?: number | string | null;
  budget_band?: string | null;
  kitchen_equipment?: string[] | null;
  kitchen_equipment_notes?: string | null;
  shopping_days?: string[] | null;
  training_weekdays?: string[] | null;
  diet_style?: string | null;
  diet_notes?: string | null;
};

export type NutritionTargetSource = {
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  kcal_rest?: number | null;
  protein_g_rest?: number | null;
  carbs_g_rest?: number | null;
  fat_g_rest?: number | null;
};

export type SafeFoodSource = {
  text_id: string;
  name: string;
  aliases: string[];
};

export type NutritionPlanSourceData = {
  profile: SmartNutritionProfileSource;
  clientProfile: ClientProfileSource;
  weightSeries: WeightMeasurementSource[];
  targets: NutritionTargetSource | null;
  ratings: MealRatingSource[];
  favorites: MealFavoriteSource[];
  skips: MealSkipSource[];
  swaps: MealInteractionSource[];
  wishes: MealWishSource[];
  safeFoods: SafeFoodSource[];
};

export type NutritionPlanGenerationContext = {
  start: Date;
  planDays: number;
  schedule: PlanScheduleDay[];
  aiSchedule: PlanScheduleDay[];
  aiPlanDays: number;
  trainingTargets: MacroTarget;
  restTargets: MacroTarget;
  forbidden: string[];
  isNoCook: boolean;
  prompt: string;
  wishesData: MealWishSource[];
};

export type ComputedPlanGeneration = {
  cleaned: CleanedPlanDay[];
  unresolved: UnresolvedIngredient[];
};
