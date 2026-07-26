import type { CustomMeal, CustomMealIngredient } from "@/lib/custom-meals.functions";

export const PORTION_PRESETS = [0.5, 1, 1.5, 2] as const;
export const DEFAULT_PORTION_FACTOR = 1;

export type ScaledCustomMeal = {
  factor: number;
  /** Total grams/ml of the scaled ingredients (0 when unknown). */
  serving_g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: CustomMealIngredient[];
};

export function parsePortionFactor(value: string): number {
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, 20);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function scaleValue(value: number | null | undefined, factor: number): number | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return round1(Number(value) * factor);
}

function ingredientAmount(ingredient: CustomMealIngredient): number {
  const amount = ingredient.amount ?? ingredient.amount_g ?? null;
  return Number.isFinite(Number(amount)) ? Number(amount) : 0;
}

/**
 * Scales a saved custom meal by a portion factor without mutating the stored recipe.
 * Macros are derived from the ingredients when they carry nutrition data,
 * otherwise from the meal totals.
 */
export function scaleCustomMeal(meal: CustomMeal, factor: number): ScaledCustomMeal {
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : DEFAULT_PORTION_FACTOR;
  const ingredients: CustomMealIngredient[] = (meal.ingredients ?? []).map((ingredient) => ({
    ...ingredient,
    amount: scaleValue(ingredient.amount ?? ingredient.amount_g, safeFactor),
    amount_g:
      ingredient.amount_g === null || ingredient.amount_g === undefined
        ? (ingredient.amount_g ?? null)
        : scaleValue(ingredient.amount_g, safeFactor),
    kcal: scaleValue(ingredient.kcal, safeFactor),
    protein_g: scaleValue(ingredient.protein_g, safeFactor),
    carbs_g: scaleValue(ingredient.carbs_g, safeFactor),
    fat_g: scaleValue(ingredient.fat_g, safeFactor),
  }));

  const hasIngredientMacros = ingredients.some(
    (ingredient) =>
      ingredient.kcal !== null ||
      ingredient.protein_g !== null ||
      ingredient.carbs_g !== null ||
      ingredient.fat_g !== null,
  );

  const totals = hasIngredientMacros
    ? ingredients.reduce(
        (acc, ingredient) => ({
          kcal: acc.kcal + (ingredient.kcal ?? 0),
          protein_g: acc.protein_g + (ingredient.protein_g ?? 0),
          carbs_g: acc.carbs_g + (ingredient.carbs_g ?? 0),
          fat_g: acc.fat_g + (ingredient.fat_g ?? 0),
        }),
        { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      )
    : {
        kcal: Number(meal.kcal ?? 0) * safeFactor,
        protein_g: Number(meal.protein_g ?? 0) * safeFactor,
        carbs_g: Number(meal.carbs_g ?? 0) * safeFactor,
        fat_g: Number(meal.fat_g ?? 0) * safeFactor,
      };

  const serving_g = round1(
    (meal.ingredients ?? []).reduce((sum, ingredient) => sum + ingredientAmount(ingredient), 0) *
      safeFactor,
  );

  return {
    factor: safeFactor,
    serving_g,
    kcal: Math.round(totals.kcal),
    protein_g: round1(totals.protein_g),
    carbs_g: round1(totals.carbs_g),
    fat_g: round1(totals.fat_g),
    ingredients,
  };
}

export function formatPortionFactor(factor: number): string {
  return String(round1(factor)).replace(".", ",");
}

export function customMealEntryName(meal: CustomMeal, factor: number): string {
  return factor === 1 ? meal.name : `${meal.name} (${formatPortionFactor(factor)}×)`;
}
