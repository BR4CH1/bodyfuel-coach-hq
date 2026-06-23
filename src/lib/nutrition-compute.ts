/**
 * Zentrale Nährwert-Berechnung für BodyFuel.
 *
 * Regel: Keine KI-Schätzwerte. Alle Werte stammen aus `nutrition_foods`
 * (BLS 4.0, Open Food Facts, USDA, coach-verifiziert) und werden hier
 * mathematisch verrechnet.
 *
 * Formel: kcal = menge_g / 100 * nährwert_per_100g
 */

export type UnitType = "raw" | "cooked" | "ml" | "piece";
export type FoodState = "raw" | "cooked" | "n_a";

export type NutritionFood = {
  id: string;
  name: string;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  unit_type: UnitType;
  default_state: FoodState;
  density_g_per_ml: number | null;
  verified_by_coach: boolean;
  source: string;
};

export type ServingUnit = "g" | "ml" | "piece";

export type MealItem = {
  food: NutritionFood;
  amount: number;
  unit: ServingUnit;
  /** Roh oder gekocht – muss zum food.default_state passen, sonst Warnung */
  state?: FoodState;
  /** Gramm pro Stück (nur wenn unit = "piece") */
  piece_g?: number;
};

export type ItemMacros = {
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Hinweise/Warnungen für die UI */
  warnings: string[];
};

export type MealMacros = ItemMacros & {
  items: ItemMacros[];
  /** true wenn Makros vs gespeicherte kcal um mehr als 5 % abweichen */
  needs_review: boolean;
  review_reason: string | null;
};

/** Wandelt eine Eingabemenge in Gramm um. ml → g via Dichte (Default 1.0). */
export function toGrams(item: MealItem): { grams: number; warnings: string[] } {
  const warnings: string[] = [];
  const { food, amount, unit, piece_g } = item;

  if (!isFinite(amount) || amount <= 0) {
    return { grams: 0, warnings: ["Menge ungültig"] };
  }

  if (unit === "g") {
    if (food.unit_type === "ml") {
      warnings.push(
        `${food.name} ist als Flüssigkeit (ml) hinterlegt – Eingabe in g wird als Gewicht genutzt.`,
      );
    }
    return { grams: amount, warnings };
  }

  if (unit === "ml") {
    const density = food.density_g_per_ml ?? 1.0;
    if (food.unit_type !== "ml" && food.density_g_per_ml == null) {
      warnings.push(
        `Keine Dichte für ${food.name} hinterlegt – ml→g mit 1,0 g/ml geschätzt. Coach: Dichte ergänzen.`,
      );
    }
    return { grams: amount * density, warnings };
  }

  if (unit === "piece") {
    if (!piece_g || piece_g <= 0) {
      warnings.push(
        `Stück-Gewicht für ${food.name} fehlt – bitte Gramm pro Stück angeben.`,
      );
      return { grams: 0, warnings };
    }
    return { grams: amount * piece_g, warnings };
  }

  return { grams: 0, warnings: ["Unbekannte Einheit"] };
}

/** Berechnet kcal/Makros für ein einzelnes Lebensmittel in der vorgegebenen Menge. */
export function computeItemMacros(item: MealItem): ItemMacros {
  const { grams, warnings } = toGrams(item);
  const { food, state } = item;

  // Roh/Gekocht-Konsistenz
  if (state && food.default_state !== "n_a" && state !== food.default_state) {
    warnings.push(
      `${food.name}: Plan verlangt „${state}", hinterlegt ist „${food.default_state}". Roh-/Gekocht-Werte unterscheiden sich stark – bitte korrekten Eintrag wählen.`,
    );
  }

  const factor = grams / 100;
  const kcal = food.kcal_per_100g * factor;
  const protein_g = food.protein_per_100g * factor;
  const carbs_g = food.carbs_per_100g * factor;
  const fat_g = food.fat_per_100g * factor;

  // 5%-Plausibilität pro Lebensmittel
  const calcKcal = protein_g * 4 + carbs_g * 4 + fat_g * 9;
  if (kcal > 0) {
    const diff = Math.abs(calcKcal - kcal) / kcal;
    if (diff > 0.05) {
      warnings.push(
        `${food.name}: Makros (${Math.round(calcKcal)} kcal) weichen ${Math.round(diff * 100)} % von gespeicherten ${Math.round(kcal)} kcal ab.`,
      );
    }
  }

  return {
    grams: round(grams, 1),
    kcal: round(kcal, 1),
    protein_g: round(protein_g, 1),
    carbs_g: round(carbs_g, 1),
    fat_g: round(fat_g, 1),
    warnings,
  };
}

/** Summiert eine ganze Mahlzeit auf und prüft die Gesamt-Plausibilität (5 %). */
export function computeMealMacros(items: MealItem[]): MealMacros {
  const computed = items.map(computeItemMacros);
  const sum = computed.reduce(
    (acc, c) => ({
      grams: acc.grams + c.grams,
      kcal: acc.kcal + c.kcal,
      protein_g: acc.protein_g + c.protein_g,
      carbs_g: acc.carbs_g + c.carbs_g,
      fat_g: acc.fat_g + c.fat_g,
    }),
    { grams: 0, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  const calcKcal = sum.protein_g * 4 + sum.carbs_g * 4 + sum.fat_g * 9;
  let needs_review = false;
  let review_reason: string | null = null;
  if (sum.kcal > 0) {
    const diff = Math.abs(calcKcal - sum.kcal) / sum.kcal;
    if (diff > 0.05) {
      needs_review = true;
      review_reason = `Mahlzeit-Makros ergeben ${Math.round(calcKcal)} kcal, gespeichert sind ${Math.round(sum.kcal)} kcal (Abweichung ${Math.round(diff * 100)} %).`;
    }
  }

  const allWarnings = computed.flatMap((c) => c.warnings);

  return {
    grams: round(sum.grams, 1),
    kcal: round(sum.kcal, 0),
    protein_g: round(sum.protein_g, 1),
    carbs_g: round(sum.carbs_g, 1),
    fat_g: round(sum.fat_g, 1),
    warnings: allWarnings,
    items: computed,
    needs_review,
    review_reason,
  };
}

function round(v: number, decimals: number) {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

/**
 * Lookup-Hilfe: Sucht das beste passende Lebensmittel.
 * Priorität: coach-verifiziert > bls_4_0 > open_food_facts > usda > sonstige.
 */
export function pickBestFood(matches: NutritionFood[]): NutritionFood | null {
  if (!matches.length) return null;
  const priority: Record<string, number> = {
    bodyfuel_verified: 0,
    bls_4_0: 1,
    open_food_facts: 2,
    usda: 3,
    manual: 4,
    ai_estimate: 5,
  };
  return [...matches].sort((a, b) => {
    if (a.verified_by_coach !== b.verified_by_coach) {
      return a.verified_by_coach ? -1 : 1;
    }
    return (priority[a.source] ?? 9) - (priority[b.source] ?? 9);
  })[0]!;
}
