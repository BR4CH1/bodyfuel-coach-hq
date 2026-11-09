export type BuilderIngredientSaveInput = {
  name: string;
  grams?: number | null;
  amount_g?: number | null;
  amount?: number | null;
  unit?: "g" | "ml" | null;
  /** Ursprungsmenge des Makro-Optimizers zur Erkennung späterer Änderungen. */
  base_grams?: number | null;
};

export type BuilderIngredientSaveOutput =
  | { name: string; grams: number }
  | { name: string; amount: number; unit: "g" | "ml" };

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Normalisiert Zutaten direkt vor dem Builder-Publish.
 * Explizite g/ml-Mengen aus der Food-DB bleiben erhalten. Fehlt `grams` in
 * einem älteren Browser-Auto-Draft, wird das frühere `amount_g`/`amount`
 * übernommen. Ein explizites `grams=0` vom Makro-Optimizer wird dagegen nicht
 * durch einen alten Basiswert wiederbelebt, sondern sauber ausgelassen.
 */
export function normalizeBuilderIngredientsForSave(
  ingredients: readonly BuilderIngredientSaveInput[],
  portionFactor = 1,
): BuilderIngredientSaveOutput[] {
  const factor = positive(portionFactor) ?? 1;
  const output: BuilderIngredientSaveOutput[] = [];

  for (const ingredient of ingredients) {
    const name = String(ingredient.name ?? "").trim();
    if (!name) continue;

    const explicitAmount = positive(ingredient.amount);
    const hasCurrentGrams =
      ingredient.grams !== null &&
      ingredient.grams !== undefined &&
      Number.isFinite(Number(ingredient.grams));
    const currentGrams = hasCurrentGrams ? Math.max(0, Number(ingredient.grams)) : null;
    const baseGrams = positive(ingredient.base_grams);

    if ((ingredient.unit === "g" || ingredient.unit === "ml") && explicitAmount) {
      let currentAmount = explicitAmount;
      if (ingredient.unit === "g" && currentGrams !== null) {
        // Nach dem erneuten Laden kann `amount` noch den alten DB-Wert tragen.
        // Eine positive bzw. vom Optimizer bewusst auf 0 gesetzte Bearbeitungsmenge
        // ist aktueller. grams=0 ohne Optimizer-Basis ist dagegen ein alter Draft.
        if (currentGrams > 0 || baseGrams !== null) currentAmount = currentGrams;
      } else if (ingredient.unit === "ml" && currentGrams !== null && baseGrams !== null) {
        // Der Optimizer arbeitet am Gewicht; die kanonische ml-Menge skaliert
        // proportional zur unveränderten Ausgangsmenge.
        currentAmount = explicitAmount * (currentGrams / baseGrams);
      }
      const amount = Math.round(currentAmount * factor);
      if (amount > 0) output.push({ name, amount, unit: ingredient.unit });
      continue;
    }

    const sourceAmount = currentGrams !== null
      ? currentGrams
      : positive(ingredient.amount_g) ?? explicitAmount ?? 0;
    const grams = Math.round(sourceAmount * factor);
    if (grams > 0) output.push({ name, grams });
  }

  return output;
}
