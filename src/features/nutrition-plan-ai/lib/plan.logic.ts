import type {
  ComputedGeneratedMeal,
  GeneratedDay,
  GeneratedMeal,
  GoalDirection,
  MacroTarget,
  PlanDayType,
  PlanScheduleDay,
} from "@/features/nutrition-plan-ai/types";
import type { EngineIngredient, EngineResult } from "@/lib/nutrition-engine.server";
import { calculateProteinTarget, capProteinAndShiftToCarbs } from "@/lib/nutrition-protein-policy";

export const MAX_KCAL_PER_MEAL = 850;

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
const WEEKDAY_LABELS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  fisch: [
    "fisch",
    "lachs",
    "räucherlachs",
    "raeucherlachs",
    "thunfisch",
    "forelle",
    "kabeljau",
    "seelachs",
    "dorsch",
    "heilbutt",
    "hering",
    "makrele",
    "sardine",
    "sardelle",
    "anchovis",
    "wels",
    "zander",
    "barsch",
    "scholle",
    "rotbarsch",
    "pangasius",
    "tilapia",
  ],
  meeresfrüchte: [
    "meeresfrüchte",
    "meeresfruechte",
    "garnele",
    "garnelen",
    "shrimp",
    "scampi",
    "krabbe",
    "krabben",
    "hummer",
    "muschel",
    "muscheln",
    "tintenfisch",
    "calamari",
    "oktopus",
  ],
  schweinefleisch: [
    "schwein",
    "schweinefleisch",
    "schinken",
    "speck",
    "bacon",
    "kassler",
    "salami",
    "mortadella",
    "schweinefilet",
    "schweinebraten",
    "kotelett",
  ],
  rindfleisch: [
    "rind",
    "rindfleisch",
    "steak",
    "rinderhack",
    "rinderfilet",
    "tafelspitz",
    "roastbeef",
  ],
  geflügel: [
    "geflügel",
    "gefluegel",
    "hähnchen",
    "haehnchen",
    "huhn",
    "pute",
    "truthahn",
    "ente",
    "wachtel",
  ],
  fleisch: [
    "fleisch",
    "hähnchen",
    "haehnchen",
    "pute",
    "rind",
    "schwein",
    "lamm",
    "wurst",
    "salami",
    "schinken",
    "speck",
    "hack",
    "steak",
    "filet",
  ],
  milchprodukte: [
    "milch",
    "joghurt",
    "quark",
    "skyr",
    "käse",
    "kaese",
    "feta",
    "mozzarella",
    "parmesan",
    "frischkäse",
    "frischkaese",
    "hüttenkäse",
    "huettenkaese",
    "sahne",
    "butter",
  ],
  nüsse: [
    "nuss",
    "nüsse",
    "nuesse",
    "mandel",
    "mandeln",
    "walnuss",
    "walnüsse",
    "haselnuss",
    "cashew",
    "pistazie",
    "pekan",
    "macadamia",
    "erdnuss",
    "erdnüsse",
  ],
  gluten: [
    "weizen",
    "dinkel",
    "roggen",
    "gerste",
    "brot",
    "nudeln",
    "pasta",
    "couscous",
    "bulgur",
    "seitan",
  ],
  laktose: ["milch", "joghurt", "quark", "skyr", "käse", "kaese", "sahne", "butter", "frischkäse"],
  ei: ["ei", "eier", "eiweiß", "eigelb", "omelett", "rührei", "ruehrei", "spiegelei"],
  soja: ["soja", "tofu", "tempeh", "edamame", "sojasauce", "sojamilch"],
};

export function labelForSlot(slot: string): string {
  switch (slot) {
    case "breakfast":
      return "Frühstück";
    case "lunch":
      return "Mittagessen";
    case "dinner":
      return "Abendessen";
    case "snack":
      return "Snack";
    default:
      return "Mahlzeit";
  }
}

export function resolveGoalDirection(input: {
  trainingGoal?: string | null;
  currentWeight?: number | null;
  goalWeight?: number | null;
  coachingGoal?: string | null;
}): GoalDirection {
  const { trainingGoal, currentWeight, goalWeight, coachingGoal } = input;
  if (["fat_loss", "aggressive_cut", "weight_loss", "cut"].includes(trainingGoal ?? "")) {
    return "cut";
  }
  if (["lean_bulk", "muscle_gain", "bulk"].includes(trainingGoal ?? "")) {
    return "bulk";
  }
  if (
    [
      "performance",
      "recovery",
      "maintain",
      "recomp",
      "health",
      "strength",
      "maintenance",
      "recomposition",
    ].includes(trainingGoal ?? "")
  ) {
    return "maintain";
  }
  if (currentWeight != null && goalWeight != null) {
    const diff = goalWeight - currentWeight;
    if (diff <= -1) return "cut";
    if (diff >= 1) return "bulk";
  }
  if (coachingGoal) {
    const goal = coachingGoal.toLowerCase();
    if (/(abnehm|fett|cut|diät|diet|lose)/.test(goal)) return "cut";
    if (/(aufbau|muskel|bulk|gain|zunehm)/.test(goal)) return "bulk";
  }
  return "maintain";
}

export function resolveNutritionTargets(input: {
  source?: {
    kcal?: number | null;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
    kcal_rest?: number | null;
    protein_g_rest?: number | null;
    carbs_g_rest?: number | null;
    fat_g_rest?: number | null;
  } | null;
  currentWeight?: number | null;
  height?: number | null;
  ageYears?: number | null;
  gender?: string | null;
  activityLevel?: string | null;
  goalDirection: GoalDirection;
}): { training: MacroTarget; rest: MacroTarget } {
  const source = input.source ?? {};
  let kcal = source.kcal ?? undefined;
  let protein = source.protein_g ?? undefined;
  let carbs = source.carbs_g ?? undefined;
  let fat = source.fat_g ?? undefined;

  if (!kcal && input.currentWeight && input.height && input.ageYears) {
    const bmr =
      input.gender === "female"
        ? 10 * input.currentWeight + 6.25 * input.height - 5 * input.ageYears - 161
        : 10 * input.currentWeight + 6.25 * input.height - 5 * input.ageYears + 5;
    const activityFactor =
      input.activityLevel === "sedentary"
        ? 1.3
        : input.activityLevel === "light"
          ? 1.45
          : input.activityLevel === "very_active"
            ? 1.75
            : input.activityLevel === "athlete"
              ? 1.9
              : 1.6;
    let tdee = bmr * activityFactor;
    if (input.goalDirection === "cut") tdee -= 400;
    else if (input.goalDirection === "bulk") tdee += 300;
    kcal = Math.round(tdee / 10) * 10;
    protein = calculateProteinTarget(input.currentWeight, input.goalDirection);
    fat = Math.round((kcal * 0.27) / 9);
    carbs = Math.max(80, Math.round((kcal - protein * 4 - fat * 9) / 4));
  }

  let training: MacroTarget = {
    kcal: kcal ?? 2200,
    protein_g: protein ?? 150,
    carbs_g: carbs ?? 240,
    fat_g: fat ?? 70,
  };
  const capTarget = (target: MacroTarget): MacroTarget => {
    const capped = capProteinAndShiftToCarbs({
      proteinG: target.protein_g,
      carbsG: target.carbs_g,
      weightKg: input.currentWeight,
    });
    return {
      ...target,
      protein_g: capped.proteinG,
      carbs_g: capped.carbsG,
    };
  };
  training = capTarget(training);
  const hasRestTargets =
    source.kcal_rest != null &&
    source.protein_g_rest != null &&
    source.carbs_g_rest != null &&
    source.fat_g_rest != null;
  if (hasRestTargets) {
    return {
      training,
      rest: capTarget({
        kcal: source.kcal_rest!,
        protein_g: source.protein_g_rest!,
        carbs_g: source.carbs_g_rest!,
        fat_g: source.fat_g_rest!,
      }),
    };
  }
  const cycled = buildIssnCarbCyclingTargets(training);
  training = cycled.training;
  return { training, rest: cycled.rest };
}

export function expandFoodTerms(terms: string[]): string[] {
  const expanded = terms.flatMap((term) => {
    const key = term.toLowerCase().trim();
    const values = new Set<string>(key ? [key] : []);
    for (const [category, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
      if (key === category || key.startsWith(category) || category.startsWith(key)) {
        synonyms.forEach((synonym) => values.add(synonym));
      }
    }
    return [...values];
  });
  return [...new Set(expanded)];
}

export function buildPlanSchedule(input: {
  start: Date;
  planDays: number;
  trainingWeekdays?: string[] | null;
}): PlanScheduleDay[] {
  const trainingDays = new Set((input.trainingWeekdays ?? []).map((day) => day.toLowerCase()));
  const hasTrainingConfig = trainingDays.size > 0;
  return Array.from({ length: input.planDays }, (_, index) => {
    const date = new Date(input.start);
    date.setDate(date.getDate() + index);
    const weekday = date.getDay();
    const wkKey = WEEKDAY_KEYS[weekday];
    return {
      wkKey,
      wkLabel: WEEKDAY_LABELS_DE[weekday],
      type: hasTrainingConfig
        ? trainingDays.has(wkKey)
          ? "training"
          : "rest"
        : index % 7 < 4
          ? "training"
          : "rest",
    };
  });
}

export function buildAiSchedule(schedule: PlanScheduleDay[]): PlanScheduleDay[] {
  return schedule.reduce<PlanScheduleDay[]>((acc, day) => {
    if (!acc.some((entry) => entry.type === day.type)) acc.push(day);
    return acc;
  }, []);
}

function cloneMealForExpandedDay(meal: GeneratedMeal): GeneratedMeal {
  return {
    ...meal,
    ingredients: Array.isArray(meal.ingredients)
      ? meal.ingredients.map((ingredient) => ({ ...ingredient }))
      : undefined,
  };
}

export function cloneComputedMealForExpandedDay(
  meal: ComputedGeneratedMeal,
): ComputedGeneratedMeal {
  return {
    ...meal,
    ingredients: Array.isArray(meal.ingredients)
      ? meal.ingredients.map((ingredient) => ({ ...ingredient }))
      : undefined,
    _compute_warnings: Array.isArray(meal._compute_warnings)
      ? [...meal._compute_warnings]
      : undefined,
  };
}

export function expandGeneratedDays(
  baseDays: GeneratedDay[],
  schedule: PlanScheduleDay[],
  planDays: number,
): GeneratedDay[] {
  const fallbackDays = baseDays.length
    ? baseDays
    : [{ name: "Tag 1", type: "training" as const, meals: [] }];
  const pools: Record<PlanDayType, GeneratedDay[]> = {
    training: fallbackDays.filter((day) => day.type === "training"),
    rest: fallbackDays.filter((day) => day.type === "rest"),
  };
  const counters: Record<PlanDayType, number> = { training: 0, rest: 0 };

  return Array.from({ length: planDays }, (_, index): GeneratedDay => {
    const type =
      schedule[index]?.type ?? fallbackDays[index % fallbackDays.length]?.type ?? "training";
    const pool = pools[type].length ? pools[type] : fallbackDays;
    const template =
      pool[counters[type] % pool.length] ?? fallbackDays[index % fallbackDays.length];
    counters[type] += 1;
    return {
      name: `Tag ${index + 1}`,
      type,
      meals: (template.meals ?? []).map(cloneMealForExpandedDay),
    };
  });
}

export function extractJsonObject(raw: string): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return candidate
    .slice(start, end + 1)
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return char === "\n" || char === "\r" || char === "\t" || code > 31;
    })
    .join("")
    .replace(/,\s*([}\]])/g, "$1");
}

export function roundKcal50(value: number): number {
  return Math.max(0, Math.round(value / 50) * 50);
}

export function buildIssnCarbCyclingTargets(trainingInput: MacroTarget): {
  training: MacroTarget;
  rest: MacroTarget;
} {
  const training = {
    kcal: Math.max(50, roundKcal50(trainingInput.kcal)),
    protein_g: Math.max(1, Math.round(trainingInput.protein_g)),
    carbs_g: Math.max(1, Math.round(trainingInput.carbs_g)),
    fat_g: Math.max(1, Math.round(trainingInput.fat_g)),
  };

  let rest: MacroTarget = {
    protein_g: training.protein_g,
    carbs_g: Math.max(1, Math.round(training.carbs_g * 0.65)),
    fat_g: Math.max(1, Math.round(training.fat_g * 1.1)),
    kcal: 0,
  };
  rest.kcal = roundKcal50(rest.protein_g * 4 + rest.carbs_g * 4 + rest.fat_g * 9);

  if (rest.kcal >= training.kcal || rest.carbs_g >= training.carbs_g) {
    rest = {
      protein_g: training.protein_g,
      carbs_g: Math.max(1, Math.round(training.carbs_g * 0.55)),
      fat_g: Math.max(1, Math.round(training.fat_g * 1.05)),
      kcal: 0,
    };
    rest.kcal = Math.max(
      50,
      Math.min(
        training.kcal - 100,
        roundKcal50(rest.protein_g * 4 + rest.carbs_g * 4 + rest.fat_g * 9),
      ),
    );
  }

  return { training, rest };
}

export function splitOversizedMeals(meals: ComputedGeneratedMeal[]): ComputedGeneratedMeal[] {
  const capped: ComputedGeneratedMeal[] = [];
  for (const meal of meals) {
    const kcal = Number(meal.kcal) || 0;
    if (kcal <= MAX_KCAL_PER_MEAL) {
      capped.push(meal);
      continue;
    }
    const parts = Math.ceil(kcal / MAX_KCAL_PER_MEAL);
    const sourceIngredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
    for (let index = 0; index < parts; index++) {
      const ingredients = sourceIngredients.map((ingredient) => {
        const grams = Number(ingredient.grams ?? ingredient.amount) || 0;
        const splitGrams = Math.max(0, Math.round((grams / parts) * 10) / 10);
        return { ...ingredient, amount: splitGrams, unit: "g", grams: splitGrams };
      });
      capped.push({
        ...meal,
        slot: index === 0 ? meal.slot : "snack",
        name: `${meal.name} (Portion ${index + 1}/${parts})`,
        description: ingredients.length ? describeIngredients(ingredients) : meal.description,
        ingredients,
        kcal: Math.round(kcal / parts),
        protein_g: Math.round((Number(meal.protein_g) || 0) / parts),
        carbs_g: Math.round((Number(meal.carbs_g) || 0) / parts),
        fat_g: Math.round((Number(meal.fat_g) || 0) / parts),
      });
    }
  }
  return capped;
}

export async function addDeterministicCorrectionSnacks(
  meals: ComputedGeneratedMeal[],
  target: MacroTarget,
  current: MacroTarget,
  supabase: unknown,
  computeMealFromIngredients: (
    supabase: unknown,
    ingredients: EngineIngredient[],
  ) => Promise<EngineResult>,
  isUsableEngineResult: (result: EngineResult | null | undefined) => boolean,
  forbidden: string[] = [],
): Promise<ComputedGeneratedMeal[]> {
  const result = [...meals];
  const addSnack = async (label: string, ingredients: EngineIngredient[]) => {
    if (containsForbiddenFood(`${label} ${JSON.stringify(ingredients)}`, forbidden)) return;
    const computed = await computeMealFromIngredients(supabase, ingredients);
    if (
      !isUsableEngineResult(computed) ||
      computed.kcal < 50 ||
      computed.kcal > MAX_KCAL_PER_MEAL
    ) {
      return;
    }
    result.push({
      slot: "snack",
      name: label,
      description: describeIngredients(ingredients),
      ingredients,
      kcal: computed.kcal,
      protein_g: computed.protein_g,
      carbs_g: computed.carbs_g,
      fat_g: computed.fat_g,
      _data_source: computed.data_source,
      _verified_ratio: computed.coverage,
      _compute_warnings: [
        "Automatisch ergänzt, damit Tagesziel näher getroffen wird.",
        ...(computed.warnings ?? []),
      ],
    });
    current.kcal += computed.kcal;
    current.protein_g += computed.protein_g;
    current.carbs_g += computed.carbs_g;
    current.fat_g += computed.fat_g;
  };

  const kcalGap = target.kcal - current.kcal;
  const proteinGap = target.protein_g - current.protein_g;
  if (proteinGap > 12 && kcalGap > 80) {
    const grams = Math.min(300, Math.max(100, Math.round((proteinGap / 11) * 100)));
    await addSnack("Skyr-Protein-Snack", [{ name: "Skyr", grams }]);
  }

  const remainingKcal = target.kcal - current.kcal;
  const carbGap = target.carbs_g - current.carbs_g;
  if ((carbGap > 18 || remainingKcal > 180) && remainingKcal > 90) {
    const grams = Math.min(
      120,
      Math.max(30, Math.round((Math.min(carbGap, remainingKcal / 4) / 58.7) * 100)),
    );
    await addSnack("Haferflocken-Snack", [{ name: "Haferflocken", grams }]);
  }

  const finalGap = target.kcal - current.kcal;
  const fatGap = target.fat_g - current.fat_g;
  if (fatGap > 8 && finalGap > 90) {
    const grams = Math.min(30, Math.max(10, Math.round(fatGap / 0.5)));
    await addSnack("Mandel-Snack", [{ name: "Mandeln", grams }]);
  }

  return result;
}

export function ensureRequiredMealSlots(
  meals: GeneratedMeal[],
  dayType: PlanDayType,
  target: MacroTarget,
  forbidden: string[],
  isNoCook: boolean,
): GeneratedMeal[] {
  const result = [...meals];
  for (const slot of ["breakfast", "lunch", "dinner"] as const) {
    if (!result.some((meal) => meal.slot === slot)) {
      result.push(chooseRequiredSlotFallback(slot, dayType, target, forbidden, isNoCook));
    }
  }
  if (!result.some((meal) => meal.slot === "snack")) {
    result.push(chooseRequiredSlotFallback("snack", dayType, target, forbidden, isNoCook));
  }
  return sortMealsBySlot(result);
}

function chooseRequiredSlotFallback(
  slot: GeneratedMeal["slot"],
  dayType: PlanDayType,
  target: MacroTarget,
  forbidden: string[],
  isNoCook: boolean,
): GeneratedMeal {
  const kcalScale = Math.max(
    0.75,
    Math.min(1.25, target.kcal / (dayType === "training" ? 2400 : 1900)),
  );
  const grams = (value: number) => Math.max(5, Math.round(value * kcalScale));
  const candidates: GeneratedMeal[] = [];

  if (slot === "breakfast") {
    candidates.push(
      makeMeal("breakfast", "Skyr-Hafer-Beeren-Bowl", [
        { name: "Skyr natur", grams: grams(300) },
        { name: "Haferflocken", grams: grams(60) },
        { name: "Beeren gemischt", grams: grams(100) },
        { name: "Mandeln", grams: grams(15) },
      ]),
      makeMeal("breakfast", "Haferflocken-Bananen-Bowl", [
        { name: "Haferflocken", grams: grams(80) },
        { name: "Banane", grams: grams(120) },
        { name: "Beeren gemischt", grams: grams(100) },
      ]),
    );
  } else if (slot === "lunch") {
    candidates.push(
      isNoCook
        ? makeMeal("lunch", "Putenbrust-Vollkornbrot-Teller", [
            { name: "Putenbrust Aufschnitt", grams: grams(160) },
            { name: "Brot Vollkorn (Roggen)", grams: grams(120) },
            { name: "Gurke", grams: grams(150) },
            { name: "Tomaten", grams: grams(150) },
            { name: "Frischkäse light", grams: grams(40) },
          ])
        : makeMeal("lunch", "Hähnchen-Reis-Brokkoli-Bowl", [
            { name: "Hähnchenbrust, gegart", grams: grams(180) },
            { name: "Reis weiß, langkorn, gekocht", grams: grams(250) },
            { name: "Brokkoli", grams: grams(200) },
            { name: "Olivenöl", grams: grams(10) },
          ]),
      makeMeal("lunch", "Reis-Brokkoli-Olivenöl-Bowl", [
        { name: "Reis weiß, langkorn, gekocht", grams: grams(300) },
        { name: "Brokkoli", grams: grams(250) },
        { name: "Olivenöl", grams: grams(15) },
      ]),
      makeMeal("lunch", "Kartoffel-Gemüse-Teller", [
        { name: "Kartoffeln, gekocht", grams: grams(350) },
        { name: "Brokkoli", grams: grams(250) },
        { name: "Olivenöl", grams: grams(15) },
      ]),
    );
  } else if (slot === "dinner") {
    candidates.push(
      isNoCook
        ? makeMeal("dinner", "Skyr-Brot-Gemüse-Teller", [
            { name: "Skyr natur", grams: grams(300) },
            { name: "Brot Vollkorn (Roggen)", grams: grams(100) },
            { name: "Gurke", grams: grams(150) },
            { name: "Tomaten", grams: grams(150) },
            { name: "Mandeln", grams: grams(15) },
          ])
        : makeMeal("dinner", "Puten-Kartoffel-Gemüse-Teller", [
            { name: "Putenbrust gegart", grams: grams(180) },
            { name: "Kartoffeln, gekocht", grams: grams(300) },
            { name: "Paprika gelb", grams: grams(150) },
            { name: "Olivenöl", grams: grams(10) },
          ]),
      makeMeal("dinner", "Kartoffel-Brokkoli-Olivenöl-Teller", [
        { name: "Kartoffeln, gekocht", grams: grams(350) },
        { name: "Brokkoli", grams: grams(250) },
        { name: "Olivenöl", grams: grams(15) },
      ]),
    );
  } else {
    candidates.push(
      makeMeal("snack", "Skyr-Protein-Snack", [{ name: "Skyr natur", grams: grams(250) }]),
      makeMeal("snack", "Haferflocken-Snack", [{ name: "Haferflocken", grams: grams(50) }]),
      makeMeal("snack", "Bananen-Snack", [{ name: "Banane", grams: grams(150) }]),
    );
  }

  const allowed = candidates.find(
    (meal) => !containsForbiddenFood(`${meal.name} ${meal.description}`, forbidden),
  );
  if (allowed) return allowed;

  if (slot === "breakfast") {
    return makeMeal("breakfast", "Haferflocken-Bowl", [{ name: "Haferflocken", grams: grams(90) }]);
  }
  if (slot === "lunch") {
    return makeMeal("lunch", "Reis-Olivenöl-Teller", [
      { name: "Reis weiß, langkorn, gekocht", grams: grams(320) },
      { name: "Olivenöl", grams: grams(15) },
    ]);
  }
  if (slot === "dinner") {
    return makeMeal("dinner", "Kartoffel-Olivenöl-Teller", [
      { name: "Kartoffeln, gekocht", grams: grams(400) },
      { name: "Olivenöl", grams: grams(15) },
    ]);
  }
  return makeMeal("snack", "Bananen-Snack", [{ name: "Banane", grams: grams(150) }]);
}

function makeMeal(
  slot: GeneratedMeal["slot"],
  name: string,
  ingredients: Array<{ name: string; grams: number }>,
): GeneratedMeal {
  const normalizedIngredients = ingredients.map((ingredient) => ({
    name: ingredient.name,
    amount: ingredient.grams,
    unit: "g",
    grams: ingredient.grams,
  }));
  return {
    slot,
    name,
    description: describeIngredients(normalizedIngredients),
    ingredients: normalizedIngredients,
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
  };
}

export function sortMealsBySlot<T extends { slot: GeneratedMeal["slot"] }>(meals: T[]): T[] {
  const order: Record<GeneratedMeal["slot"], number> = {
    breakfast: 0,
    lunch: 1,
    dinner: 2,
    snack: 3,
  };
  return [...meals].sort((left, right) => order[left.slot] - order[right.slot]);
}

export function containsForbiddenFood(haystack: string, forbidden: string[]): boolean {
  const normalizedHaystack = haystack.toLowerCase();
  return forbidden.some((raw) => {
    const term = raw.toLowerCase().trim();
    if (!term) return false;
    const pattern = new RegExp(`(^|[^a-zäöüß])${escapeRegExp(term)}([^a-zäöüß]|$)`, "i");
    return pattern.test(normalizedHaystack);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function describeIngredients(ingredients: Array<{ name?: string; grams?: number }>): string {
  return ingredients
    .filter((ingredient) => ingredient.name && Number(ingredient.grams) > 0)
    .map((ingredient) => `${formatAmount(Number(ingredient.grams))}g ${ingredient.name}`)
    .join(", ");
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}
