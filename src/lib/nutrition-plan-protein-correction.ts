/**
 * Deterministische Protein-Korrektur für generierte Tage.
 *
 * Die harte BodyFuel-Regel (max. 2,0 g Protein pro kg Körpergewicht) wird
 * NICHT gelockert. Statt einen ganzen Plan zu verwerfen, wenn die KI zu viel
 * Protein einplant, werden proteinreiche Zutaten deterministisch nach unten
 * skaliert und die frei werdenden Kalorien auf Kohlenhydrate verschoben
 * (beide 4 kcal/g) — identisch zur Policy in `nutrition-protein-policy.ts`.
 */

export const PROTEIN_RICH_TERMS = [
  "skyr",
  "quark",
  "magerquark",
  "hüttenkäse",
  "huettenkaese",
  "joghurt",
  "käse",
  "kaese",
  "whey",
  "protein",
  "eiweiß",
  "eiweiss",
  "hähnchen",
  "haehnchen",
  "hahnchen",
  "huhn",
  "pute",
  "putenbrust",
  "rind",
  "hack",
  "steak",
  "schwein",
  "lachs",
  "thunfisch",
  "fisch",
  "garnele",
  "tofu",
  "tempeh",
  "seitan",
  "ei",
  "eier",
  "linsen",
  "kichererbsen",
  "bohnen",
  "schinken",
  "aufschnitt",
];

export const CARB_RICH_TERMS = [
  "reis",
  "nudeln",
  "pasta",
  "kartoffel",
  "süßkartoffel",
  "suesskartoffel",
  "haferflocken",
  "hafer",
  "brot",
  "brötchen",
  "broetchen",
  "toast",
  "wrap",
  "tortilla",
  "couscous",
  "bulgur",
  "quinoa",
  "banane",
  "apfel",
  "beeren",
  "obst",
  "mais",
  "polenta",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasTerm(haystack: string, term: string): boolean {
  const hay = haystack.toLowerCase();
  const needle = term.toLowerCase();
  // Deutsche Komposita: "Magerquark", "Hähnchenbrust", "Thunfisch" müssen
  // ihre Basiszutat treffen. Kurze Begriffe ("ei") bleiben wortgenau, damit
  // "Reis" oder "Zwiebel" nicht fälschlich als Protein gelten.
  if (needle.length >= 5) return hay.includes(needle);
  if (needle.length === 4) {
    return new RegExp(`(^|[^a-z0-9äöüß])${escapeRegExp(needle)}`, "i").test(hay);
  }
  return new RegExp(`(^|[^a-z0-9äöüß])${escapeRegExp(needle)}([^a-z0-9äöüß]|$)`, "i").test(hay);
}

export type IngredientClass = "protein" | "carb" | "other";

export function classifyIngredient(name: string | null | undefined): IngredientClass {
  const haystack = String(name ?? "").replace(/[_-]+/g, " ");
  if (!haystack.trim()) return "other";
  if (PROTEIN_RICH_TERMS.some((term) => hasTerm(haystack, term))) return "protein";
  if (CARB_RICH_TERMS.some((term) => hasTerm(haystack, term))) return "carb";
  return "other";
}

export interface CorrectableIngredient {
  name?: string | null;
  food_id?: string | null;
  amount?: number | null;
  unit?: string | null;
  grams?: number | null;
}

export interface CorrectableMeal {
  slot?: string | null;
  name?: string | null;
  description?: string | null;
  ingredients?: CorrectableIngredient[] | null;
  protein_g?: number | null;
}

function ingredientGrams(ingredient: CorrectableIngredient): number {
  const value = Number(ingredient.grams ?? ingredient.amount);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function ingredientKey(ingredient: CorrectableIngredient): string {
  return `${ingredient.food_id ?? ""} ${ingredient.name ?? ""}`;
}

export interface ProteinCorrectionResult<T extends CorrectableMeal> {
  meals: T[];
  changed: boolean;
  /** Reduzierte Protein-Gramm (geschätzt über die Skalierung). */
  scaleFactor: number;
}

/**
 * Skaliert proteinreiche Zutaten so, dass die Tagessumme die Obergrenze
 * einhält, und gibt die eingesparten Kalorien 1:1 (4 kcal/g) an
 * kohlenhydratreiche Zutaten weiter. Die Mengen sind danach neu zu berechnen
 * (Engine), weil sich die Zutatenmengen geändert haben.
 */
export function correctProteinOverflow<T extends CorrectableMeal>(
  meals: T[],
  proteinTotal: number,
  proteinCap: number,
): ProteinCorrectionResult<T> {
  if (!Number.isFinite(proteinCap) || proteinCap <= 0) {
    return { meals, changed: false, scaleFactor: 1 };
  }
  if (proteinTotal <= proteinCap) {
    return { meals, changed: false, scaleFactor: 1 };
  }

  const proteinIngredients = meals.flatMap((meal) =>
    (meal.ingredients ?? []).filter(
      (ingredient) =>
        ingredientGrams(ingredient) > 0 &&
        classifyIngredient(ingredientKey(ingredient)) === "protein",
    ),
  );
  if (!proteinIngredients.length) {
    return { meals, changed: false, scaleFactor: 1 };
  }

  // 3 % Sicherheitsmarge, damit Rundungen im Engine-Recompute nicht
  // direkt wieder über die Obergrenze laufen.
  const targetProtein = proteinCap * 0.97;
  const proteinFromRich = proteinIngredients.reduce(
    (sum, ingredient) => sum + ingredientGrams(ingredient),
    0,
  );
  const overflow = proteinTotal - targetProtein;
  // Anteil, der von den proteinreichen Zutaten abgezogen werden muss.
  const rawFactor = 1 - overflow / Math.max(1, proteinTotal);
  const scaleFactor = Math.min(1, Math.max(0.4, rawFactor));

  const removedGrams = Math.max(0, proteinFromRich * (1 - scaleFactor));

  const carbIngredients = meals.flatMap((meal) =>
    (meal.ingredients ?? []).filter(
      (ingredient) =>
        ingredientGrams(ingredient) > 0 && classifyIngredient(ingredientKey(ingredient)) === "carb",
    ),
  );
  const carbGramsTotal = carbIngredients.reduce(
    (sum, ingredient) => sum + ingredientGrams(ingredient),
    0,
  );

  const round1 = (value: number) => Math.round(value * 10) / 10;

  const corrected = meals.map((meal) => {
    const ingredients = (meal.ingredients ?? []).map((ingredient) => {
      const grams = ingredientGrams(ingredient);
      if (grams <= 0) return ingredient;
      const kind = classifyIngredient(ingredientKey(ingredient));
      if (kind === "protein") {
        const next = Math.max(5, round1(grams * scaleFactor));
        return { ...ingredient, amount: next, unit: "g", grams: next };
      }
      if (kind === "carb" && carbGramsTotal > 0 && removedGrams > 0) {
        const share = grams / carbGramsTotal;
        const next = round1(grams + removedGrams * share);
        return { ...ingredient, amount: next, unit: "g", grams: next };
      }
      return ingredient;
    });
    return { ...meal, ingredients } as T;
  });

  return { meals: corrected, changed: true, scaleFactor };
}

/** Gramm-Skalierung einer Fallback-Mahlzeit auf ein Tagesziel. */
export function scaleFallbackGrams(input: {
  grams: number;
  targetKcal: number;
  referenceKcal: number;
  min?: number;
  max?: number;
}): number {
  const reference = input.referenceKcal > 0 ? input.referenceKcal : 2200;
  const scale = Math.max(
    input.min ?? 0.6,
    Math.min(input.max ?? 1.25, (Number(input.targetKcal) || reference) / reference),
  );
  return Math.max(5, Math.round(input.grams * scale));
}
