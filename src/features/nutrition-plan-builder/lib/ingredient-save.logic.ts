export type BuilderIngredientSaveInput = {
  name: string;
  grams?: number | null;
  amount_g?: number | null;
  amount?: number | null;
  unit?: "g" | "ml" | null;
};

function positiveAmount(...values: unknown[]): number {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

/**
 * Normalisiert Builder-Zutaten vor dem Speichern.
 *
 * - Aktuelle Builder-Daten nutzen `grams`.
 * - Ältere Auto-Drafts/Bibliotheks-Snapshots können noch `amount_g` oder
 *   `amount` enthalten. Diese Werte dürfen beim Publish nicht zu 0 g werden.
 * - Zutaten, die der Makro-Optimizer bewusst auf 0 g reduziert hat, werden
 *   ausgelassen statt den gesamten Plan mit einer Mengen-Fehlermeldung zu blockieren.
 */
export function normalizeBuilderIngredientsForSave(
  ingredients: readonly BuilderIngredientSaveInput[],
  portionFactor = 1,
): Array<{ name: string; grams: number }> {
  const factor =
    Number.isFinite(Number(portionFactor)) && Number(portionFactor) > 0
      ? Number(portionFactor)
      : 1;

  return ingredients.flatMap((ingredient) => {
    const name = String(ingredient.name ?? "").trim();
    if (!name) return [];

    // `grams` ist die aktuelle Wahrheit. Nur wenn das Feld fehlt/ungültig ist,
    // greifen wir auf Legacy-Felder zurück. Ein explizites grams=0 vom Optimizer
    // bleibt 0 und wird unten bewusst entfernt.
    const hasCurrentGrams =
      ingredient.grams !== null &&
      ingredient.grams !== undefined &&
      Number.isFinite(Number(ingredient.grams));
    const baseAmount = hasCurrentGrams
      ? Math.max(0, Number(ingredient.grams))
      : positiveAmount(ingredient.amount_g, ingredient.amount);
    const grams = Math.round(baseAmount * factor);

    return grams > 0 ? [{ name, grams }] : [];
  });
}
