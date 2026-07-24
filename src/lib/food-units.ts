export type FoodAmountUnit = "g" | "ml";

export type FoodReference = {
  unit?: FoodAmountUnit | null;
  density_g_per_ml?: number | null;
};

export type EnergyNutrients = {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
  alcohol_g?: number | null;
  polyols_g?: number | null;
  organic_acids_g?: number | null;
};

export function foodAmountUnit(food: FoodReference): FoodAmountUnit {
  return food.unit === "ml" ? "ml" : "g";
}

/**
 * Nutrition values on FoodResult always refer to 100 of the displayed unit:
 * 100 ml for liquids, 100 g for everything else.
 */
export function macroFactorForAmount(amount: number): number {
  return Math.max(0, Number(amount) || 0) / 100;
}

/** Legacy food_entries.serving_g still stores mass; new UI uses amount + unit. */
export function amountToGrams(food: FoodReference, amount: number): number {
  const safeAmount = Math.max(0, Number(amount) || 0);
  if (foodAmountUnit(food) === "g") return safeAmount;
  const density = Number(food.density_g_per_ml);
  return safeAmount * (Number.isFinite(density) && density > 0 ? density : 1);
}

/** EU 1169/2011 Annex XIV energy conversion factors (kcal). */
export function energyFromNutrients(nutrients: EnergyNutrients): number {
  return (
    nutrients.protein_g * 4 +
    nutrients.carbs_g * 4 +
    nutrients.fat_g * 9 +
    (nutrients.fiber_g ?? 0) * 2 +
    (nutrients.alcohol_g ?? 0) * 7 +
    (nutrients.polyols_g ?? 0) * 2.4 +
    (nutrients.organic_acids_g ?? 0) * 3
  );
}

export function formatFoodAmount(amount: number, unit: FoodAmountUnit): string {
  const rounded = Math.round(Number(amount) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} ${unit}`;
}
