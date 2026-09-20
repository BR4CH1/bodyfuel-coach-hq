/**
 * Harte und weiche Constraints für den Smart Nutrition Plan Builder.
 *
 * Grundregeln:
 * - Ernährungsregeln (vegan, vegetarisch, ...) und No-Gos sind ABSOLUTE
 *   Constraints. Sie werden auf Zutaten-Ebene (Name, food_id, Tags,
 *   Kategorie, Allergene) geprüft, nicht nur auf dem Rezeptnamen.
 * - Vorlieben sind ausschließlich Ranking-Boni. Ein Plan ist auch ohne
 *   Vorlieben vollständig generierbar.
 */

export type PlanGoal =
  | "abnehmen"
  | "muskelaufbau"
  | "halten"
  | "recomposition"
  | "performance"
  | "individuell";

export const PLAN_GOAL_LABELS: Record<PlanGoal, string> = {
  abnehmen: "Abnehmen",
  muskelaufbau: "Muskelaufbau",
  halten: "Gewicht halten",
  recomposition: "Recomposition",
  performance: "Performance",
  individuell: "Individuell",
};

/**
 * Ernährungsform. `mischkost`, `high_protein` und `low_carb` sind KEINE
 * harten Ausschlüsse — sie steuern Auswahl und Priorisierung, blockieren
 * aber keine Zutaten.
 */
export type DietRule =
  | "mischkost"
  | "vegetarisch"
  | "vegan"
  | "high_protein"
  | "low_carb"
  | "glutenfrei"
  | "laktosefrei"
  | "halal";

/** Variationsgrad: steuert, wie stark Wiederholungen vermieden werden. */
export type VariationLevel = "niedrig" | "mittel" | "hoch";

export const VARIATION_LABELS: Record<VariationLevel, string> = {
  niedrig: "niedrig",
  mittel: "mittel",
  hoch: "hoch",
};

/** Mindestanteil einzigartiger Hauptmahlzeiten je Variationsgrad. */
export function varietyTargetFor(level: VariationLevel | undefined): number {
  if (level === "niedrig") return 0.25;
  if (level === "hoch") return 0.7;
  return 0.45;
}

export type ExclusionGroup =
  | "schweinefleisch"
  | "rind"
  | "gefluegel"
  | "fisch"
  | "meeresfruechte"
  | "eier"
  | "milchprodukte"
  | "nuesse";

export type LifestyleFlag =
  | "meal_prep"
  | "schnell"
  | "wenig_zutaten"
  | "budget"
  | "unterwegs";

export interface PlanConstraintConfig {
  goal: PlanGoal;
  dietRules: DietRule[];
  exclusionGroups: ExclusionGroup[];
  /** Frei suchbare individuelle Ausschluss-Lebensmittel. */
  customExclusions: string[];
  /** Weiche Vorlieben — nur Ranking, niemals Pflicht. */
  preferences: string[];
  lifestyle: LifestyleFlag[];
  mealsPerDay: number;
  planDays: number;
  partner: boolean;
  /** Variationsgrad (Standard: mittel). */
  variation?: VariationLevel;
}

export interface IngredientLike {
  name?: string | null;
  food_id?: string | null;
  grams?: number | null;
  amount?: number | null;
  tags?: string[] | null;
  category?: string | null;
  allergens?: string[] | null;
}

export interface MealLike {
  slot?: string | null;
  name?: string | null;
  description?: string | null;
  ingredients?: IngredientLike[] | null;
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
}

export interface PlanDayLike {
  name?: string | null;
  meals: MealLike[];
}

export const EXCLUSION_GROUP_TERMS: Record<ExclusionGroup, string[]> = {
  schweinefleisch: [
    "schwein",
    "schweinefleisch",
    "schnitzel",
    "speck",
    "bacon",
    "schinken",
    "salami",
    "bratwurst",
    "leberwurst",
    "kassler",
    "mett",
    "wiener",
    "lardo",
    "pancetta",
  ],
  rind: ["rind", "rindfleisch", "beef", "steak", "hackfleisch rind", "kalb", "roastbeef", "corned"],
  gefluegel: [
    "huhn",
    "hähnchen",
    "haehnchen",
    "hahnchen",
    "chicken",
    "pute",
    "putenbrust",
    "truthahn",
    "entenbrust",
    "ente",
    "gans",
    "geflügel",
    "gefluegel",
  ],
  fisch: [
    "fisch",
    "lachs",
    "thunfisch",
    "forelle",
    "kabeljau",
    "seelachs",
    "hering",
    "makrele",
    "sardine",
    "zander",
    "dorade",
    "pangasius",
    "tilapia",
  ],
  meeresfruechte: [
    "garnele",
    "garnelen",
    "shrimp",
    "scampi",
    "krabbe",
    "hummer",
    "muschel",
    "muscheln",
    "tintenfisch",
    "calamari",
    "austern",
    "meeresfrüchte",
    "meeresfruechte",
  ],
  eier: ["ei", "eier", "eigelb", "eiweiß", "eiklar", "rührei", "ruehrei", "omelett", "spiegelei"],
  milchprodukte: [
    "milch",
    "vollmilch",
    "magermilch",
    "joghurt",
    "jogurt",
    "skyr",
    "quark",
    "magerquark",
    "käse",
    "kaese",
    "gouda",
    "mozzarella",
    "feta",
    "frischkäse",
    "frischkaese",
    "hüttenkäse",
    "huettenkaese",
    "sahne",
    "butter",
    "schmand",
    "creme fraiche",
    "whey",
    "molkenprotein",
  ],
  nuesse: [
    "nuss",
    "nüsse",
    "nuesse",
    "mandel",
    "mandeln",
    "walnuss",
    "haselnuss",
    "cashew",
    "pistazie",
    "erdnuss",
    "erdnussbutter",
    "pekan",
    "macadamia",
    "paranuss",
    "nussmus",
  ],
};

const MEAT_AND_FISH_TERMS: string[] = [
  ...EXCLUSION_GROUP_TERMS.schweinefleisch,
  ...EXCLUSION_GROUP_TERMS.rind,
  ...EXCLUSION_GROUP_TERMS.gefluegel,
  ...EXCLUSION_GROUP_TERMS.fisch,
  ...EXCLUSION_GROUP_TERMS.meeresfruechte,
  "lamm",
  "wild",
  "hirsch",
  "gelatine",
  "wurst",
  "aufschnitt",
];

export const DIET_RULE_TERMS: Record<DietRule, string[]> = {
  // Ernährungsformen ohne harte Ausschlüsse:
  mischkost: [],
  high_protein: [],
  low_carb: [],
  vegetarisch: MEAT_AND_FISH_TERMS,
  vegan: [
    ...MEAT_AND_FISH_TERMS,
    ...EXCLUSION_GROUP_TERMS.milchprodukte,
    ...EXCLUSION_GROUP_TERMS.eier,
    "honig",
  ],
  glutenfrei: [
    "weizen",
    "weizenmehl",
    "dinkel",
    "gerste",
    "roggen",
    "grünkern",
    "gruenkern",
    "couscous",
    "bulgur",
    "seitan",
    "paniert",
    "panade",
    "brot",
    "brötchen",
    "broetchen",
    "toastbrot",
    "nudeln",
    "pasta",
    "spaghetti",
    "hartweizen",
    "wrap",
    "tortilla",
    "pizzateig",
  ],
  laktosefrei: [
    "milch",
    "vollmilch",
    "magermilch",
    "joghurt",
    "skyr",
    "quark",
    "magerquark",
    "käse",
    "kaese",
    "sahne",
    "schmand",
    "frischkäse",
    "frischkaese",
    "hüttenkäse",
    "huettenkaese",
    "molke",
  ],
  halal: [
    ...EXCLUSION_GROUP_TERMS.schweinefleisch,
    "gelatine",
    "alkohol",
    "wein",
    "bier",
    "rum",
    "likör",
    "likoer",
  ],
};

export const DIET_RULE_LABELS: Record<DietRule, string> = {
  mischkost: "Mischkost",
  high_protein: "High Protein",
  low_carb: "Low Carb",
  vegetarisch: "vegetarisch",
  vegan: "vegan",
  glutenfrei: "glutenfrei",
  laktosefrei: "laktosefrei",
  halal: "halal",
};

export const EXCLUSION_GROUP_LABELS: Record<ExclusionGroup, string> = {
  schweinefleisch: "Schweinefleisch",
  rind: "Rind",
  gefluegel: "Geflügel",
  fisch: "Fisch",
  meeresfruechte: "Meeresfrüchte",
  eier: "Eier",
  milchprodukte: "Milchprodukte",
  nuesse: "Nüsse",
};

/** Sinnvolle Alternativen, wenn eine Gruppe die Generierung blockiert. */
export const EXCLUSION_ALTERNATIVES: Record<ExclusionGroup, string[]> = {
  schweinefleisch: ["Geflügel", "Rind", "Tofu"],
  rind: ["Geflügel", "Fisch", "Linsen"],
  gefluegel: ["Fisch", "Tofu", "Hülsenfrüchte"],
  fisch: ["Geflügel", "Tofu", "Hülsenfrüchte"],
  meeresfruechte: ["Fisch", "Geflügel", "Tofu"],
  eier: ["Skyr", "Tofu", "Hülsenfrüchte"],
  milchprodukte: ["Sojajoghurt", "Tofu", "Hülsenfrüchte"],
  nuesse: ["Kürbiskerne", "Sonnenblumenkerne", "Olivenöl"],
};

export const DIET_RULE_ALTERNATIVES: Record<DietRule, string[]> = {
  mischkost: [],
  high_protein: ["Skyr", "Hähnchen", "Linsen", "Tofu"],
  low_carb: ["Gemüse", "Eier", "Fisch", "Nüsse"],
  vegetarisch: ["Tofu", "Hülsenfrüchte", "Skyr"],
  vegan: ["Tofu", "Tempeh", "Linsen", "Sojajoghurt"],
  glutenfrei: ["Reis", "Kartoffeln", "Mais", "Buchweizen", "Quinoa"],
  laktosefrei: ["Sojajoghurt", "Haferdrink", "laktosefreier Käse"],
  halal: ["Geflügel", "Rind", "Fisch"],
};

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Suche, die deutsche Komposita trifft (deutsche Umlaute zählen als
 * Wortzeichen). Harte No-Gos müssen auch in zusammengesetzten Zutatennamen
 * greifen ("Schweineschnitzel", "Hähnchenbrust", "Vollmilchjoghurt"):
 * - ab 5 Zeichen: Teilwort-Treffer
 * - 4 Zeichen: Treffer am Wortanfang
 * - bis 3 Zeichen: nur exaktes Wort ("Ei" darf nicht in "Reis" greifen)
 */
export function textContainsTerm(haystack: string, term: string): boolean {
  const needle = normalize(term);
  if (!needle) return false;
  const hay = normalize(haystack);
  if (needle.length >= 5) return hay.includes(needle);
  if (needle.length === 4) {
    return new RegExp(`(^|[^a-z0-9äöüß])${escapeRegExp(needle)}`, "i").test(hay);
  }
  return new RegExp(`(^|[^a-z0-9äöüß])${escapeRegExp(needle)}([^a-z0-9äöüß]|$)`, "i").test(hay);
}

/**
 * Baut die vollständige Liste harter Ausschluss-Begriffe aus
 * Ernährungsregeln, Ausschlussgruppen und individuellen No-Gos.
 */
export function buildForbiddenTerms(
  config: Pick<PlanConstraintConfig, "dietRules" | "exclusionGroups" | "customExclusions">,
  extra: string[] = [],
): string[] {
  const terms = new Set<string>();
  for (const rule of config.dietRules ?? []) {
    for (const term of DIET_RULE_TERMS[rule] ?? []) terms.add(normalize(term));
  }
  for (const group of config.exclusionGroups ?? []) {
    for (const term of EXCLUSION_GROUP_TERMS[group] ?? []) terms.add(normalize(term));
  }
  for (const custom of config.customExclusions ?? []) {
    const value = normalize(custom);
    if (value) terms.add(value);
  }
  for (const value of extra) {
    const normalized = normalize(value);
    if (normalized) terms.add(normalized);
  }
  return Array.from(terms);
}

function ingredientHaystack(ingredient: IngredientLike): string {
  return [
    ingredient.name ?? "",
    (ingredient.food_id ?? "").replace(/[_-]+/g, " "),
    ingredient.category ?? "",
    ...(ingredient.tags ?? []),
    ...(ingredient.allergens ?? []),
  ].join(" ");
}

export interface IngredientViolation {
  ingredient: string;
  term: string;
  source: "ingredient" | "name";
}

/**
 * Prüft eine Mahlzeit vollständig auf harte Verstöße — zuerst jede einzelne
 * Zutat inkl. Tags/Kategorie/Allergenen, danach Name und Beschreibung.
 */
export function findMealViolations(meal: MealLike, forbidden: string[]): IngredientViolation[] {
  const violations: IngredientViolation[] = [];
  for (const ingredient of meal.ingredients ?? []) {
    const haystack = ingredientHaystack(ingredient);
    for (const term of forbidden) {
      if (textContainsTerm(haystack, term)) {
        violations.push({
          ingredient: ingredient.name ?? ingredient.food_id ?? "unbekannte Zutat",
          term,
          source: "ingredient",
        });
      }
    }
  }
  const textHaystack = `${meal.name ?? ""} ${meal.description ?? ""}`;
  for (const term of forbidden) {
    if (textContainsTerm(textHaystack, term)) {
      violations.push({ ingredient: meal.name ?? "Mahlzeit", term, source: "name" });
    }
  }
  return violations;
}

export function mealIsAllowed(meal: MealLike, forbidden: string[]): boolean {
  return findMealViolations(meal, forbidden).length === 0;
}

/**
 * Soft-Constraint-Score: Vorlieben erzeugen nur einen Bonus.
 * Ohne Vorlieben ist der Score immer 0 — nie ein Ausschluss.
 */
export function scoreMealPreference(meal: MealLike, preferences: string[]): number {
  if (!preferences?.length) return 0;
  const haystack = [
    meal.name ?? "",
    meal.description ?? "",
    ...(meal.ingredients ?? []).map((ingredient) => ingredientHaystack(ingredient)),
  ].join(" ");
  let score = 0;
  for (const preference of preferences) {
    if (textContainsTerm(haystack, preference)) score += 1;
  }
  return score;
}

/** Sortiert Kandidaten nach Vorlieben-Bonus, ohne welche auszuschließen. */
export function rankMealsByPreference<T extends MealLike>(meals: T[], preferences: string[]): T[] {
  return meals
    .map((meal, index) => ({ meal, index, score: scoreMealPreference(meal, preferences) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.meal);
}

/** Anteil einzigartiger Hauptmahlzeiten über den Zeitraum (0..1). */
export function computeVarietyRatio(days: PlanDayLike[]): number {
  const names = days.flatMap((day) =>
    (day.meals ?? [])
      .filter((meal) => meal.slot !== "snack")
      .map((meal) => normalize(meal.name ?? "").replace(/\s*\(portion.*$/i, "")),
    )
    .filter(Boolean);
  if (!names.length) return 0;
  return new Set(names).size / names.length;
}

export interface PlanValidationCheck {
  id:
    | "nogos"
    | "allergies"
    | "diet"
    | "macros"
    | "meals"
    | "completeness"
    | "period"
    | "variety";
  label: string;
  ok: boolean;
  detail: string;
}

/** Ist/Soll-Kennzahlen zur Anzeige nach der Generierung. */
export interface PlanValidationMetrics {
  kcalActual: number;
  kcalTarget: number;
  proteinActual: number;
  proteinTarget: number;
  carbsActual: number;
  carbsTarget: number;
  fatActual: number;
  fatTarget: number;
  nogoViolations: number;
  allergyViolations: number;
  missingMeals: number;
  repeatedMeals: number;
  varietyRatio: number;
}

export interface PlanValidationReport {
  ok: boolean;
  checks: PlanValidationCheck[];
  blockingReasons: string[];
  suggestions: string[];
  metrics: PlanValidationMetrics;
}

export interface PlanValidationInput {
  days: PlanDayLike[];
  forbidden: string[];
  config: Pick<
    PlanConstraintConfig,
    "dietRules" | "exclusionGroups" | "customExclusions" | "mealsPerDay" | "planDays"
  >;
  /** Tagesziel pro Tag (gleiche Reihenfolge wie days). */
  targets: Array<{ kcal: number; protein_g: number; carbs_g: number; fat_g: number }>;
  /** Maximal erlaubte Abweichung der Tageskalorien (Anteil). */
  kcalTolerance?: number;
  /** Mindestanteil einzigartiger Hauptmahlzeiten. */
  minVarietyRatio?: number;
  /** Allergene/Intoleranzen — härteste Stufe, immer blockierend. */
  allergyTerms?: string[];
  /** Variationsgrad; setzt minVarietyRatio, wenn dieses fehlt. */
  variation?: VariationLevel;
}

/**
 * Validiert einen generierten Plan über ALLE Tage, Mahlzeiten und Zutaten.
 * Nur wenn `ok === true` gilt die Generierung als erfolgreich.
 */
export function validateGeneratedPlan(input: PlanValidationInput): PlanValidationReport {
  const kcalTolerance = input.kcalTolerance ?? 0.15;
  const minVarietyRatio = input.minVarietyRatio ?? varietyTargetFor(input.variation);
  const allergyTerms = (input.allergyTerms ?? [])
    .map((term) => normalize(term))
    .filter(Boolean);
  const blockingReasons: string[] = [];
  const suggestions = new Set<string>();

  // 1) No-Gos / Ernährungsregeln auf Zutaten-Ebene
  const violations: string[] = [];
  input.days.forEach((day, dayIndex) => {
    for (const meal of day.meals ?? []) {
      for (const violation of findMealViolations(meal, input.forbidden)) {
        violations.push(
          `Tag ${dayIndex + 1} — ${meal.name ?? "Mahlzeit"}: "${violation.ingredient}" verstößt gegen "${violation.term}"`,
        );
      }
    }
  });
  // 1b) Allergien getrennt ausweisen — härteste Stufe.
  const allergyViolations: string[] = [];
  if (allergyTerms.length) {
    input.days.forEach((day, dayIndex) => {
      for (const meal of day.meals ?? []) {
        for (const violation of findMealViolations(meal, allergyTerms)) {
          allergyViolations.push(
            `Tag ${dayIndex + 1} — ${meal.name ?? "Mahlzeit"}: "${violation.ingredient}" enthält "${violation.term}"`,
          );
        }
      }
    });
    if (allergyViolations.length) blockingReasons.push(...allergyViolations.slice(0, 6));
  }

  const dietRules = input.config.dietRules ?? [];
  const exclusionGroups = input.config.exclusionGroups ?? [];
  if (violations.length) {
    for (const rule of dietRules) {
      for (const alternative of DIET_RULE_ALTERNATIVES[rule] ?? []) suggestions.add(alternative);
    }
    for (const group of exclusionGroups) {
      for (const alternative of EXCLUSION_ALTERNATIVES[group] ?? []) suggestions.add(alternative);
    }
    blockingReasons.push(...violations.slice(0, 8));
  }

  // 2) Makros pro Tag
  const macroIssues: string[] = [];
  input.days.forEach((day, dayIndex) => {
    const target = input.targets[dayIndex] ?? input.targets.at(-1);
    if (!target) return;
    const sums = (day.meals ?? []).reduce<{ kcal: number; protein_g: number }>(
      (acc, meal) => ({
        kcal: acc.kcal + (Number(meal.kcal) || 0),
        protein_g: acc.protein_g + (Number(meal.protein_g) || 0),
      }),
      { kcal: 0, protein_g: 0 },
    );
    // Rundungstoleranz: max(4 g, 2 %) — Kleinstabweichungen sind kein Verstoß.
    if (sums.protein_g > target.protein_g + Math.max(4, target.protein_g * 0.02)) {
      macroIssues.push(
        `Tag ${dayIndex + 1}: Protein-Obergrenze überschritten (${Math.round(sums.protein_g)} g statt max. ${target.protein_g} g)`,
      );
    }
    const deviation = Math.abs(sums.kcal - target.kcal) / Math.max(1, target.kcal);
    if (deviation > kcalTolerance) {
      macroIssues.push(
        `Tag ${dayIndex + 1}: Kalorien ${Math.round(sums.kcal)} statt ${target.kcal} kcal`,
      );
    }
  });
  if (macroIssues.length) blockingReasons.push(...macroIssues.slice(0, 6));

  // 3) Mahlzeitenanzahl
  const mealsPerDay = Math.max(1, Math.round(input.config.mealsPerDay || 0));
  const mealCountIssues = input.days
    .map((day, dayIndex) =>
      (day.meals ?? []).length < mealsPerDay
        ? `Tag ${dayIndex + 1}: nur ${(day.meals ?? []).length} von ${mealsPerDay} Mahlzeiten`
        : null,
    )
    .filter((entry): entry is string => Boolean(entry));
  if (mealCountIssues.length) blockingReasons.push(...mealCountIssues.slice(0, 6));

  // 4) Zeitraum
  const expectedDays = Math.max(1, Math.round(input.config.planDays || 0));
  const periodOk = input.days.length === expectedDays;
  if (!periodOk) {
    blockingReasons.push(`Zeitraum: ${input.days.length} statt ${expectedDays} Tage generiert`);
  }

  // 4b) Vollständigkeit: jede Mahlzeit braucht Name und Energie
  const incompleteMeals: string[] = [];
  input.days.forEach((day, dayIndex) => {
    (day.meals ?? []).forEach((meal) => {
      const hasName = Boolean((meal.name ?? "").trim());
      const hasEnergy = (Number(meal.kcal) || 0) > 0;
      if (!hasName || !hasEnergy) {
        incompleteMeals.push(
          `Tag ${dayIndex + 1}: "${meal.name ?? "ohne Namen"}" ist unvollständig`,
        );
      }
    });
  });
  if (incompleteMeals.length) blockingReasons.push(...incompleteMeals.slice(0, 4));

  // 5) Abwechslung
  const varietyRatio = computeVarietyRatio(input.days);
  const varietyOk = input.days.length < 3 || varietyRatio >= minVarietyRatio;

  // Ist/Soll-Kennzahlen über den gesamten Zeitraum (Tagesdurchschnitt)
  const dayCount = Math.max(1, input.days.length);
  const actual = input.days.reduce(
    (acc, day) => {
      for (const meal of day.meals ?? []) {
        acc.kcal += Number(meal.kcal) || 0;
        acc.protein_g += Number(meal.protein_g) || 0;
        acc.carbs_g += Number(meal.carbs_g) || 0;
        acc.fat_g += Number(meal.fat_g) || 0;
      }
      return acc;
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
  const targetSum = input.days.reduce(
    (acc, _day, index) => {
      const target = input.targets[index] ?? input.targets.at(-1);
      if (!target) return acc;
      acc.kcal += target.kcal;
      acc.protein_g += target.protein_g;
      acc.carbs_g += target.carbs_g;
      acc.fat_g += target.fat_g;
      return acc;
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
  const mainMealNames = input.days.flatMap((day) =>
    (day.meals ?? []).filter((meal) => meal.slot !== "snack").map((meal) => normalize(meal.name ?? "")),
  );
  const repeatedMeals = mainMealNames.length - new Set(mainMealNames.filter(Boolean)).size;
  const metrics: PlanValidationMetrics = {
    kcalActual: Math.round(actual.kcal / dayCount),
    kcalTarget: Math.round(targetSum.kcal / dayCount),
    proteinActual: Math.round(actual.protein_g / dayCount),
    proteinTarget: Math.round(targetSum.protein_g / dayCount),
    carbsActual: Math.round(actual.carbs_g / dayCount),
    carbsTarget: Math.round(targetSum.carbs_g / dayCount),
    fatActual: Math.round(actual.fat_g / dayCount),
    fatTarget: Math.round(targetSum.fat_g / dayCount),
    nogoViolations: violations.length,
    allergyViolations: allergyViolations.length,
    missingMeals: mealCountIssues.length,
    repeatedMeals: Math.max(0, repeatedMeals),
    varietyRatio,
  };

  const checks: PlanValidationCheck[] = [
    {
      id: "nogos",
      label: "No-Gos eingehalten",
      ok: violations.length === 0,
      detail: violations.length ? violations[0] : "Keine ausgeschlossene Zutat im Plan",
    },
    {
      id: "allergies",
      label: "Allergien eingehalten",
      ok: allergyViolations.length === 0,
      detail: allergyViolations.length
        ? allergyViolations[0]
        : allergyTerms.length
          ? `${allergyTerms.length} Allergene geprüft`
          : "keine Allergene hinterlegt",
    },
    {
      id: "diet",
      label: "Ernährungsregeln eingehalten",
      ok: violations.length === 0,
      detail: dietRules.length ? dietRules.map((r) => DIET_RULE_LABELS[r]).join(", ") : "keine",
    },
    {
      id: "macros",
      label: "Makroziele",
      ok: macroIssues.length === 0,
      detail: macroIssues.length ? macroIssues[0] : "Alle Tage im Zielkorridor",
    },
    {
      id: "meals",
      label: "Mahlzeitenanzahl",
      ok: mealCountIssues.length === 0,
      detail: mealCountIssues.length ? mealCountIssues[0] : `${mealsPerDay} pro Tag`,
    },
    {
      id: "completeness",
      label: "Mahlzeiten vollständig",
      ok: incompleteMeals.length === 0,
      detail: incompleteMeals.length
        ? incompleteMeals[0]
        : `Ø ${metrics.kcalActual} von ${metrics.kcalTarget} kcal · Protein ${metrics.proteinActual}/${metrics.proteinTarget} g · KH ${metrics.carbsActual}/${metrics.carbsTarget} g · Fett ${metrics.fatActual}/${metrics.fatTarget} g`,
    },
    {
      id: "period",
      label: "Zeitraum",
      ok: periodOk,
      detail: `${input.days.length} Tage`,
    },
    {
      id: "variety",
      label: "Abwechslung",
      ok: varietyOk,
      detail: `${Math.round(varietyRatio * 100)} % unterschiedliche Hauptmahlzeiten · ${metrics.repeatedMeals} Wiederholungen`,
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks,
    blockingReasons,
    suggestions: Array.from(suggestions).slice(0, 6),
    metrics,
  };
}

/** Verständliche Fehlermeldung inkl. konkreter Alternativen. */
export function describeConstraintFailure(report: PlanValidationReport): string {
  const failed = report.checks.filter((check) => !check.ok);
  if (!failed.length) return "";
  const head = failed.map((check) => `${check.label}: ${check.detail}`).join("; ");
  const alternatives = report.suggestions.length
    ? ` Mögliche Alternativen: ${report.suggestions.join(", ")}.`
    : "";
  return `Plan konnte mit den aktuellen Vorgaben nicht erstellt werden — ${head}.${alternatives}`;
}

export function summarizeActiveRules(config: PlanConstraintConfig): string[] {
  const parts: string[] = [];
  if (config.goal) parts.push(`Ziel: ${config.goal}`);
  if (config.dietRules?.length) {
    parts.push(config.dietRules.map((rule) => DIET_RULE_LABELS[rule]).join(", "));
  }
  if (config.exclusionGroups?.length) {
    parts.push(`ohne ${config.exclusionGroups.map((g) => EXCLUSION_GROUP_LABELS[g]).join(", ")}`);
  }
  if (config.customExclusions?.length) {
    parts.push(`ohne ${config.customExclusions.join(", ")}`);
  }
  if (config.preferences?.length) parts.push(`Vorlieben: ${config.preferences.length}`);
  parts.push(`${config.mealsPerDay} Mahlzeiten/Tag`);
  parts.push(`${config.planDays} Tage`);
  if (config.variation) parts.push(`Variation: ${VARIATION_LABELS[config.variation]}`);
  if (config.partner) parts.push("Partnerplan");
  return parts;
}
