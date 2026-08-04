/**
 * BodyFuel — zentrale Makro-Optimierung für den Ernährungsplan-Builder.
 *
 * Ziel: Wenn ein Coach z. B. die Kohlenhydrate eines Tages von 200 g auf 30 g
 * setzt, werden nicht pauschal alle Portionen verkleinert, sondern gezielt die
 * Kohlenhydratquellen der geplanten Gerichte reduziert oder ersetzt.
 *
 * Prioritäten (absteigend):
 *   1. Harte Regeln (Ernährungsform, Allergien, No-Gos) werden nie verletzt.
 *   2. Protein möglichst am Ziel halten.
 *   3. Kohlenhydrate über die echten Haupt-Kohlenhydratquellen steuern.
 *   4. Fett über erkennbare Fettquellen steuern.
 *   5. Gemüse, Gewürze und kalorienarme Zutaten bleiben unverändert.
 *   6. Erst wenn Zutatenanpassung nicht reicht: Gericht aus derselben Kategorie
 *      ersetzen. Ganze Portionsfaktoren sind der letzte Fallback.
 */

import type {
  BuilderDay,
  BuilderIngredient,
  BuilderMeal,
  CustomerPlanContext,
  LibraryMeal,
} from "@/lib/plan-builder.functions";
import {
  classifyIngredientRole,
  fallbackPer100,
  roleBounds,
  roundGrams,
  type IngredientRole,
  type Per100,
} from "@/lib/ingredient-roles";
import {
  mealFitsDiet,
  mealFromLibrary,
  mealMacros,
  scoreMeal,
  type MacroValues,
  type Slot,
} from "./plan-builder.logic";

/** Dokumentierte Toleranzen der Optimierung. */
export const MACRO_TOLERANCE = { kcal: 60, p: 8, c: 5, f: 6 } as const;

export type NutritionResolver = (name: string) => Per100 | null;

/** Auflösung: erst Lebensmitteldatenbank-Snapshot, dann Standardtabelle. */
export function createNutritionResolver(
  resolved?: Record<string, Per100> | null,
): NutritionResolver {
  return (name: string) => {
    const key = (name ?? "").trim();
    if (!key) return null;
    return resolved?.[key] ?? fallbackPer100(key);
  };
}

export type OptimizationChange =
  | {
      kind: "ingredient";
      meal: string;
      ingredient: string;
      fromGrams: number;
      toGrams: number;
    }
  | { kind: "meal_replaced"; slot: Slot; from: string; to: string }
  | { kind: "portion"; meal: string; fromFactor: number; toFactor: number };

type MacroKey = "p" | "c" | "f";
const PER100_KEY: Record<MacroKey, keyof Per100> = {
  p: "protein_g",
  c: "carbs_g",
  f: "fat_g",
};

type IngModel = {
  name: string;
  base: number;
  grams: number;
  per100: Per100 | null;
  role: IngredientRole;
  min: number;
  max: number;
  original: number;
};

type MealModel = {
  index: number;
  slot: Slot;
  meal: BuilderMeal;
  factor: number;
  originalFactor: number;
  baseline: MacroValues;
  ings: IngModel[];
};

function emptyMacros(): MacroValues {
  return { kcal: 0, p: 0, c: 0, f: 0 };
}

function addMacros(a: MacroValues, b: MacroValues): MacroValues {
  return { kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f };
}

/** Nährwerte einer Zutat (aufgelöst oder aus dem Builder-Snapshot). */
function ingredientPer100(
  ingredient: BuilderIngredient,
  resolve: NutritionResolver,
): Per100 | null {
  if (
    ingredient.per100 &&
    Number.isFinite(Number(ingredient.per100.kcal)) &&
    Number(ingredient.per100.kcal) > 0
  ) {
    return ingredient.per100;
  }
  return resolve(ingredient.name);
}

function buildMealModel(
  meal: BuilderMeal,
  index: number,
  library: LibraryMeal[],
  resolve: NutritionResolver,
): MealModel {
  const factor = meal.portion_factor && meal.portion_factor > 0 ? meal.portion_factor : 1;
  // Basiswerte immer ohne Override berechnen — der Override wird aus den
  // Zutaten-Deltas neu abgeleitet und darf nicht doppelt einfließen.
  const baseline = mealMacros(
    { ...meal, portion_factor: 1, macro_override: null },
    library,
  );

  const ingredients = meal.ingredients ?? [];
  const otherCaloricIngredients = ingredients.filter((i) => {
    const per100 = ingredientPer100(i, resolve);
    return per100 ? per100.kcal > 30 : false;
  }).length;

  const ings: IngModel[] = ingredients.map((ingredient) => {
    const per100 = ingredientPer100(ingredient, resolve);
    const role = ingredient.role ?? classifyIngredientRole(ingredient.name, per100);
    const base = Math.max(0, Math.round(Number(ingredient.base_grams ?? ingredient.grams) || 0));
    const grams = Math.max(0, Math.round(Number(ingredient.grams) || 0));
    // Eine Kohlenhydratquelle darf komplett entfallen, wenn das Gericht danach
    // noch aus einer weiteren kalorienhaltigen Komponente besteht.
    const allowZero = otherCaloricIngredients >= 2;
    const bounds = roleBounds(role, base, { allowZero });
    return {
      name: ingredient.name,
      base,
      grams,
      per100,
      role,
      min: per100 ? bounds.min : grams,
      max: per100 ? bounds.max : grams,
      original: grams,
    };
  });

  return {
    index,
    slot: meal.slot as Slot,
    meal,
    factor,
    originalFactor: factor,
    baseline,
    ings,
  };
}

function modelMacros(model: MealModel): MacroValues {
  let kcal = model.baseline.kcal;
  let p = model.baseline.p;
  let c = model.baseline.c;
  let f = model.baseline.f;
  for (const ing of model.ings) {
    if (!ing.per100) continue;
    const delta = (ing.grams - ing.base) / 100;
    if (delta === 0) continue;
    kcal += ing.per100.kcal * delta;
    p += ing.per100.protein_g * delta;
    c += ing.per100.carbs_g * delta;
    f += ing.per100.fat_g * delta;
  }
  return {
    kcal: Math.max(0, kcal) * model.factor,
    p: Math.max(0, p) * model.factor,
    c: Math.max(0, c) * model.factor,
    f: Math.max(0, f) * model.factor,
  };
}

function totalsOf(models: MealModel[], locked: MacroValues): MacroValues {
  return models.reduce((acc, model) => addMacros(acc, modelMacros(model)), { ...locked });
}

/**
 * Verschiebt `need` Gramm eines Makros über die passenden Zutatenrollen.
 * Gibt den nicht erreichbaren Rest zurück.
 */
function shiftMacro(
  models: MealModel[],
  macro: MacroKey,
  need: number,
  roles: readonly IngredientRole[],
): number {
  if (!Number.isFinite(need) || Math.abs(need) < 0.25) return 0;
  const per100Key = PER100_KEY[macro];

  const candidates: Array<{ ing: IngModel; perGram: number }> = [];
  for (const model of models) {
    for (const ing of model.ings) {
      if (!ing.per100 || !roles.includes(ing.role)) continue;
      const perGram = (Number(ing.per100[per100Key]) / 100) * model.factor;
      if (perGram <= 0.005) continue;
      candidates.push({ ing, perGram });
    }
  }
  // Dichteste Quellen zuerst → wenige, gezielte Mengenänderungen.
  candidates.sort((a, b) => b.perGram - a.perGram);

  let remaining = need;
  for (const candidate of candidates) {
    if (Math.abs(remaining) < 0.25) break;
    const { ing, perGram } = candidate;
    const wanted = ing.grams + remaining / perGram;
    const next = Math.min(ing.max, Math.max(ing.min, wanted));
    const applied = next - ing.grams;
    if (Math.abs(applied) < 0.5) continue;
    ing.grams = next;
    remaining -= applied * perGram;
  }
  return remaining;
}

function fineTuneCalories(models: MealModel[], target: MacroValues, locked: MacroValues) {
  let totals = totalsOf(models, locked);
  let kcalDiff = target.kcal - totals.kcal;
  if (Math.abs(kcalDiff) <= MACRO_TOLERANCE.kcal) return;

  // Reihenfolge: Fett (dicht), dann Kohlenhydrate, dann Protein —
  // jeweils nur innerhalb der eigenen Makro-Toleranz.
  const steps: Array<{ macro: MacroKey; roles: IngredientRole[]; kcalPerGram: number }> = [
    { macro: "f", roles: ["fat"], kcalPerGram: 9 },
    { macro: "c", roles: ["carb", "fruit"], kcalPerGram: 4 },
    { macro: "p", roles: ["protein"], kcalPerGram: 4 },
  ];

  for (const step of steps) {
    totals = totalsOf(models, locked);
    kcalDiff = target.kcal - totals.kcal;
    if (Math.abs(kcalDiff) <= MACRO_TOLERANCE.kcal) return;
    const wantedMacroDelta = kcalDiff / step.kcalPerGram;
    const tolerance = MACRO_TOLERANCE[step.macro];
    const lowerRoom = target[step.macro] - tolerance - totals[step.macro];
    const upperRoom = target[step.macro] + tolerance - totals[step.macro];
    const allowed = Math.min(Math.max(wantedMacroDelta, lowerRoom), upperRoom);
    if (Math.abs(allowed) < 0.5) continue;
    shiftMacro(models, step.macro, allowed, step.roles);
  }
}

function runPasses(models: MealModel[], target: MacroValues, locked: MacroValues) {
  for (let pass = 0; pass < 4; pass += 1) {
    let totals = totalsOf(models, locked);
    shiftMacro(models, "c", target.c - totals.c, ["carb", "fruit"]);
    totals = totalsOf(models, locked);
    shiftMacro(models, "f", target.f - totals.f, ["fat"]);
    totals = totalsOf(models, locked);
    shiftMacro(models, "p", target.p - totals.p, ["protein"]);
    fineTuneCalories(models, target, locked);

    totals = totalsOf(models, locked);
    const done =
      Math.abs(totals.c - target.c) <= MACRO_TOLERANCE.c &&
      Math.abs(totals.p - target.p) <= MACRO_TOLERANCE.p &&
      Math.abs(totals.f - target.f) <= MACRO_TOLERANCE.f &&
      Math.abs(totals.kcal - target.kcal) <= MACRO_TOLERANCE.kcal;
    if (done) return;
  }
}

/** Umlaut-/Schreibweisen-tolerante Normalisierung für Regelvergleiche. */
function normalizeRuleText(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[äÄ]/g, "a")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Harte Ausschlusskriterien: Allergien, Intoleranzen, No-Gos, Ernährungsform. */
export function violatesHardRules(meal: LibraryMeal, ctx: CustomerPlanContext): boolean {
  if (!mealFitsDiet(meal, ctx.dietStyle)) return true;
  const hay = normalizeRuleText(
    [
      meal.name,
      meal.description ?? "",
      ...(meal.tags ?? []),
      meal.main_protein ?? "",
      meal.main_carb ?? "",
      ...(meal.ingredients ?? []).map((i) => i.name),
      ...(meal.no_go_ingredients ?? []),
    ].join(" "),
  );
  const forbidden = [...ctx.allergies, ...ctx.intolerances, ...ctx.noGoFoods]
    .map((entry) => normalizeRuleText(entry))
    // Ein einzelner Wortstamm reicht (z. B. "Walnüsse" trifft "Walnüssen").
    // Nur bei ausreichend langen Begriffen, sonst drohen Fehltreffer.
    .map((entry) => (entry.length >= 6 ? entry.replace(/(en|e|n|s)$/, "") : entry))

    .filter((entry) => entry.length > 2);
  return forbidden.some((entry) => hay.includes(entry));
}


/** Ersatzkandidat, der harte Regeln einhält und dem Restziel am nächsten kommt. */
function findReplacement(
  slot: Slot,
  ctx: CustomerPlanContext,
  library: LibraryMeal[],
  dayType: BuilderDay["type"],
  remaining: MacroValues,
  desired: MacroValues,
  excludeIds: Set<string>,
): LibraryMeal | null {
  const candidates = library
    .filter((m) => m.category === slot)
    .filter((m) => !excludeIds.has(m.id))
    // Harte Regeln sind nicht verhandelbar — vor jedem Scoring.
    .filter((m) => !violatesHardRules(m, ctx))
    .map((m) => ({ meal: m, ...scoreMeal(m, ctx, dayType, remaining) }))
    .map((entry) => {
      const carbGap = Math.abs(Number(entry.meal.carbs_g) - desired.c);
      const proteinGap = Math.abs(Number(entry.meal.protein_g) - desired.p);
      const kcalGap = Math.abs(Number(entry.meal.kcal) - desired.kcal) / 10;
      return { ...entry, fit: carbGap * 2 + proteinGap + kcalGap - entry.score / 10 };
    })
    .sort((a, b) => a.fit - b.fit);
  return candidates[0]?.meal ?? null;
}


function writeBack(model: MealModel): BuilderMeal {
  const ingredients: BuilderIngredient[] = model.meal.ingredients.map((ingredient, index) => {
    const ing = model.ings[index];
    if (!ing) return { ...ingredient };
    return {
      ...ingredient,
      grams: ing.grams,
      base_grams: ing.base,
      role: ing.role,
      per100: ing.per100 ?? ingredient.per100 ?? null,
    };
  });
  const macros = modelMacros({ ...model, factor: 1 });
  return {
    ...model.meal,
    ingredients,
    portion_factor: model.factor,
    macro_override: {
      kcal: Math.round(macros.kcal),
      protein_g: Math.round(macros.p * 10) / 10,
      carbs_g: Math.round(macros.c * 10) / 10,
      fat_g: Math.round(macros.f * 10) / 10,
    },
  };
}

export type OptimizeArgs = {
  day: BuilderDay;
  target: MacroValues;
  ctx: CustomerPlanContext;
  library: LibraryMeal[];
  resolve: NutritionResolver;
  /** Maximale Anzahl vollständig ersetzter Gerichte. */
  maxReplacements?: number;
};

export type OptimizeResult = {
  day: BuilderDay;
  changes: OptimizationChange[];
  totals: MacroValues;
  withinTolerance: boolean;
};

/**
 * Passt einen Tag an das (ggf. individuelle) Makroziel an.
 * Fixierte Mahlzeiten bleiben unangetastet.
 */
export function optimizeDayToTargets({
  day,
  target,
  ctx,
  library,
  resolve,
  maxReplacements = 2,
}: OptimizeArgs): OptimizeResult {
  const changes: OptimizationChange[] = [];
  const lockedTotals = day.meals.reduce<MacroValues>(
    (acc, meal) => (meal.is_locked ? addMacros(acc, mealMacros(meal, library)) : acc),
    emptyMacros(),
  );

  let models: MealModel[] = day.meals
    .map((meal, index) => ({ meal, index }))
    .filter((entry) => !entry.meal.is_locked)
    .map((entry) => buildMealModel(entry.meal, entry.index, library, resolve));

  const originalGrams = new Map<string, number>();
  for (const model of models) {
    for (const ing of model.ings) originalGrams.set(`${model.index}:${ing.name}`, ing.original);
  }

  if (models.length === 0) {
    // Alles fixiert: es kann nichts verändert werden, aber die Bewertung muss
    // trotzdem alle vier Makros berücksichtigen.
    return {
      day,
      changes,
      totals: lockedTotals,
      withinTolerance: isWithinTolerance(lockedTotals, target),
    };
  }


  runPasses(models, target, lockedTotals);

  // --- Gerichtsersatz, wenn reine Zutatenanpassung nicht reicht ---
  const excluded = new Set<string>();
  for (let attempt = 0; attempt < maxReplacements; attempt += 1) {
    const totals = totalsOf(models, lockedTotals);
    const carbOff = totals.c - target.c;
    const kcalOff = totals.kcal - target.kcal;
    const needsReplacement =
      Math.abs(carbOff) > MACRO_TOLERANCE.c + 10 || Math.abs(kcalOff) > MACRO_TOLERANCE.kcal * 3;
    if (!needsReplacement) break;

    // Gericht mit dem größten Beitrag zur Abweichung wählen.
    const ranked = [...models].sort((a, b) => {
      const am = modelMacros(a);
      const bm = modelMacros(b);
      return carbOff > 0 ? bm.c - am.c : am.c - bm.c;
    });
    const victim = ranked[0];
    if (!victim) break;

    const victimMacros = modelMacros(victim);
    const rest: MacroValues = {
      kcal: target.kcal - (totals.kcal - victimMacros.kcal),
      p: target.p - (totals.p - victimMacros.p),
      c: target.c - (totals.c - victimMacros.c),
      f: target.f - (totals.f - victimMacros.f),
    };
    if (victim.meal.library_meal_id) excluded.add(victim.meal.library_meal_id);
    const replacement = findReplacement(
      victim.slot,
      ctx,
      library,
      day.type,
      rest,
      rest,
      excluded,
    );
    if (!replacement) break;

    changes.push({
      kind: "meal_replaced",
      slot: victim.slot,
      from: victim.meal.name,
      to: replacement.name,
    });
    const replaced = mealFromLibrary(
      replacement,
      victim.slot,
      1,
      victim.meal.linked_prep_group ?? null,
    );
    const newModel = buildMealModel(replaced, victim.index, library, resolve);
    models = models.map((model) => (model.index === victim.index ? newModel : model));
    runPasses(models, target, lockedTotals);
  }

  // --- Mengen runden und Ergebnis stabilisieren ---
  for (const model of models) {
    for (const ing of model.ings) {
      if (!ing.per100) continue;
      const rounded = roundGrams(ing.grams);
      ing.grams = Math.min(ing.max, Math.max(ing.min === 0 ? 0 : ing.min, rounded));
    }
  }

  // --- Letzter Fallback: Portionsfaktor, wenn kcal weiterhin klar daneben liegt ---
  // Er darf ein bereits erreichtes Makroziel (v. a. Kohlenhydrate) niemals
  // wieder aus der Toleranz schieben — sonst wird er komplett zurückgenommen.
  let totals = totalsOf(models, lockedTotals);
  if (target.kcal > 0 && Math.abs(totals.kcal - target.kcal) > target.kcal * 0.1) {
    const unlockedKcal = totals.kcal - lockedTotals.kcal;
    if (unlockedKcal > 0) {
      const wanted = Math.max(0, target.kcal - lockedTotals.kcal) / unlockedKcal;
      const scale = Math.min(2, Math.max(0.5, Math.round(wanted * 4) / 4));
      if (scale !== 1) {
        const before = { totals, factors: models.map((model) => model.factor) };
        const portionChanges: OptimizationChange[] = [];
        for (const model of models) {
          const from = model.factor;
          const next = Math.min(8, Math.max(0.25, Math.round(from * scale * 4) / 4));
          if (next !== from) {
            model.factor = next;
            portionChanges.push({
              kind: "portion",
              meal: model.meal.name,
              fromFactor: from,
              toFactor: next,
            });
          }
        }
        const after = totalsOf(models, lockedTotals);
        const brokeMacro = (["c", "p", "f"] as const).some(
          (key) =>
            Math.abs(after[key] - target[key]) > MACRO_TOLERANCE[key] &&
            Math.abs(after[key] - target[key]) > Math.abs(before.totals[key] - target[key]),
        );
        if (brokeMacro) {
          models.forEach((model, index) => {
            model.factor = before.factors[index] ?? model.factor;
          });
        } else {
          changes.push(...portionChanges);
        }
      }
    }
  }

  // --- Änderungsprotokoll ---
  for (const model of models) {
    for (const ing of model.ings) {
      const before = originalGrams.get(`${model.index}:${ing.name}`);
      if (before === undefined || Math.round(before) === Math.round(ing.grams)) continue;
      changes.push({
        kind: "ingredient",
        meal: model.meal.name,
        ingredient: ing.name,
        fromGrams: Math.round(before),
        toGrams: Math.round(ing.grams),
      });
    }
  }

  const nextMeals = [...day.meals];
  for (const model of models) nextMeals[model.index] = writeBack(model);
  const nextDay: BuilderDay = { ...day, meals: nextMeals };

  // Die gemeldeten Summen müssen exakt aus dem tatsächlich zurückgegebenen Tag
  // stammen (inkl. Rundung der macro_override-Werte).
  totals = nextDay.meals.reduce<MacroValues>(
    (acc, meal) => addMacros(acc, mealMacros(meal, library)),
    emptyMacros(),
  );

  return { day: nextDay, changes, totals, withinTolerance: isWithinTolerance(totals, target) };
}

/** Prüft alle vier Makros gegen die dokumentierte Toleranz. */
export function isWithinTolerance(totals: MacroValues, target: MacroValues): boolean {
  return (
    Math.abs(totals.c - target.c) <= MACRO_TOLERANCE.c &&
    Math.abs(totals.p - target.p) <= MACRO_TOLERANCE.p &&
    Math.abs(totals.f - target.f) <= MACRO_TOLERANCE.f &&
    Math.abs(totals.kcal - target.kcal) <= MACRO_TOLERANCE.kcal
  );
}



/** Normalisiert Zieleingaben aus dem Editor auf ganze, plausible Werte. */
export function normalizeTargets(raw: Partial<MacroValues>): MacroValues {
  const clamp = (value: unknown, min: number, max: number) => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  };
  return {
    kcal: clamp(raw.kcal, 800, 6000),
    p: clamp(raw.p, 20, 400),
    c: clamp(raw.c, 0, 800),
    f: clamp(raw.f, 10, 300),
  };
}

/** Kurze, lesbare Zusammenfassung der Anpassung für die UI. */
export function summarizeChanges(changes: OptimizationChange[]): string[] {
  const lines: string[] = [];
  const replaced = changes.filter((c) => c.kind === "meal_replaced").length;
  for (const change of changes) {
    if (change.kind === "ingredient") {
      lines.push(`${change.ingredient} ${change.fromGrams} g → ${change.toGrams} g`);
    }
  }
  if (replaced > 0) {
    lines.push(replaced === 1 ? "1 Gericht ersetzt" : `${replaced} Gerichte ersetzt`);
  }
  const portions = changes.filter((c) => c.kind === "portion").length;
  if (portions > 0) {
    lines.push(
      portions === 1 ? "1 Portion angepasst" : `${portions} Portionen zusätzlich angepasst`,
    );
  }
  return lines;
}
