import type { CustomMealIngredient } from "@/lib/custom-meals.functions";
import type { FoodAmountUnit } from "@/lib/food-units";

export type IngredientAmountInfo = {
  /** Angezeigte Menge in der Einheit `unit`. */
  amount: number;
  unit: FoodAmountUnit;
  /** false, wenn keine belastbare Basismenge hinterlegt ist. */
  scalable: boolean;
};

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Liest die anzuzeigende Menge einer gespeicherten Zutat.
 * Neue Zutaten besitzen `amount` + `unit`; Legacy-Zutaten nur `amount_g`.
 * Ohne belastbare Menge gilt die Zutat als nicht skalierbar, damit keine
 * falschen Makros berechnet werden.
 */
export function resolveIngredientAmount(ingredient: CustomMealIngredient): IngredientAmountInfo {
  const unit: FoodAmountUnit = ingredient.unit === "ml" ? "ml" : "g";
  const explicit = positive(ingredient.amount);
  if (explicit) return { amount: explicit, unit, scalable: true };
  const legacy = positive(ingredient.amount_g);
  if (legacy) return { amount: legacy, unit: "g", scalable: true };
  return { amount: 0, unit, scalable: false };
}

function scaleValue(value: number | null | undefined, factor: number): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return value === 0 ? 0 : null;
  return Math.round(numeric * factor * 10) / 10;
}

/**
 * Setzt die Menge einer Zutat neu und skaliert ihre Makros linear anhand der
 * bisherigen Basismenge. Nicht skalierbare Zutaten bleiben unverändert.
 */
export function scaleIngredientToAmount(
  ingredient: CustomMealIngredient,
  nextAmount: number,
): CustomMealIngredient {
  const base = resolveIngredientAmount(ingredient);
  const amount = Number(nextAmount);
  if (!base.scalable || !Number.isFinite(amount) || amount <= 0) return ingredient;

  const factor = amount / base.amount;
  const rounded = Math.round(amount * 10) / 10;
  const legacyGrams = positive(ingredient.amount_g);

  return {
    ...ingredient,
    amount: rounded,
    unit: base.unit,
    amount_g: legacyGrams ? Math.round(legacyGrams * factor * 10) / 10 : ingredient.amount_g,
    kcal: ingredient.kcal == null ? ingredient.kcal : Math.round(Number(ingredient.kcal) * factor),
    protein_g: scaleValue(ingredient.protein_g, factor),
    carbs_g: scaleValue(ingredient.carbs_g, factor),
    fat_g: scaleValue(ingredient.fat_g, factor),
  };
}

export type MealMacroTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

/** Summiert die Mahlzeit exakt so, wie es der Server beim Speichern tut. */
export function sumIngredientMacros(
  ingredients: readonly CustomMealIngredient[],
): MealMacroTotals {
  const totals = ingredients.reduce<MealMacroTotals>(
    (acc, ingredient) => ({
      kcal: acc.kcal + (Number(ingredient.kcal) || 0),
      protein_g: acc.protein_g + (Number(ingredient.protein_g) || 0),
      carbs_g: acc.carbs_g + (Number(ingredient.carbs_g) || 0),
      fat_g: acc.fat_g + (Number(ingredient.fat_g) || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
  return {
    kcal: Math.round(totals.kcal),
    protein_g: Math.round(totals.protein_g * 10) / 10,
    carbs_g: Math.round(totals.carbs_g * 10) / 10,
    fat_g: Math.round(totals.fat_g * 10) / 10,
  };
}

export function formatIngredientAmount(info: IngredientAmountInfo): string {
  if (!info.scalable) return "Menge unbekannt";
  const rounded = Math.round(info.amount * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${info.unit}`;
}
