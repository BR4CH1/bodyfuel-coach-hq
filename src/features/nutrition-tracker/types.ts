import type { FoodResult } from "@/lib/nutrition.functions";

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";

export type FoodEntry = {
  id: string;
  meal: Meal;
  name: string;
  brand: string | null;
  serving_g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: string | null;
  image_url?: string | null;
};

export type RecentFood = FoodResult & { last_amount_g: number };
export type FavoriteFood = FoodResult & {
  fav_id: string;
  last_amount_g: number | null;
};

export type NutritionTargets = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_glasses: number;
};

export type NutritionTotals = Omit<NutritionTargets, "water_glasses">;

export type FoodUnit = "g" | "piece";
export type AddFoodSource = "food" | "meal";

export type FoodPickOptions = {
  unit?: FoodUnit;
  amount?: string;
};

export type FavoriteCandidate = FoodResult & { last_amount_g?: number | null };
