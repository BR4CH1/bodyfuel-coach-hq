import type { FoodResult } from "@/lib/nutrition.functions";
import type { FoodAmountUnit } from "@/lib/food-units";

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";

export type FoodEntry = {
  id: string;
  food_id: string | null;
  meal: Meal;
  name: string;
  brand: string | null;
  serving_amount: number;
  amount_unit: FoodAmountUnit;
  /** Legacy-Massenwert; neue Anzeige nutzt serving_amount + amount_unit. */
  serving_g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: string | null;
};

export type RecentFood = FoodResult & { last_amount: number };
export type FavoriteFood = FoodResult & {
  fav_id: string;
  last_amount: number | null;
};

export type NutritionTargets = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_glasses: number;
};

export type NutritionTotals = Omit<NutritionTargets, "water_glasses">;

export type FoodUnit = FoodAmountUnit;
export type AddFoodSource = "food" | "meal";

export type FoodPickOptions = {
  unit?: FoodUnit;
  amount?: string;
};

export type FavoriteCandidate = FoodResult & { last_amount?: number | null };
