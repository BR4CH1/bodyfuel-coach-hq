export type NutritionIngredientAmountInput = {
  grams?: number | null;
  amount?: number | null;
  unit?: "g" | "ml" | null;
};

export type EngineIngredientAmount = {
  grams: number;
  amount: number;
  unit?: "g" | "ml";
};

/**
 * Normalisiert ausschließlich die Menge für die Nutrition Engine.
 *
 * Explizite g/ml-Angaben bleiben erhalten und werden später gegen die Food-DB
 * validiert. Legacy-Builder-Zutaten besitzen dagegen nur `grams`; dort wird
 * absichtlich KEINE Einheit erfunden, damit die Engine nach dem Food-Lookup
 * `nutrition_foods.unit_type` als Source of Truth nutzen kann.
 */
export function toEngineIngredientAmount(
  ingredient: NutritionIngredientAmountInput,
): EngineIngredientAmount | null {
  const explicitAmount = Number(ingredient.amount ?? 0);
  if (
    (ingredient.unit === "g" || ingredient.unit === "ml") &&
    Number.isFinite(explicitAmount) &&
    explicitAmount > 0
  ) {
    const amount = Math.round(explicitAmount);
    return { grams: amount, amount, unit: ingredient.unit };
  }

  const legacyAmount = Number(ingredient.grams ?? 0);
  if (!Number.isFinite(legacyAmount) || legacyAmount <= 0) return null;
  const amount = Math.round(legacyAmount);
  return { grams: amount, amount };
}
