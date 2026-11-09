export type NutritionIngredientAmountInput = {
  grams?: number | null;
  amount_g?: number | null;
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
function positiveAmount(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function toEngineIngredientAmount(
  ingredient: NutritionIngredientAmountInput,
): EngineIngredientAmount | null {
  const explicitAmount = positiveAmount(ingredient.amount);
  if ((ingredient.unit === "g" || ingredient.unit === "ml") && explicitAmount !== null) {
    const amount = Math.round(explicitAmount);
    return { grams: amount, amount, unit: ingredient.unit };
  }

  const legacyAmount = positiveAmount(ingredient.grams) ?? positiveAmount(ingredient.amount_g);
  if (legacyAmount === null) return null;
  const amount = Math.round(legacyAmount);
  return { grams: amount, amount };
}
