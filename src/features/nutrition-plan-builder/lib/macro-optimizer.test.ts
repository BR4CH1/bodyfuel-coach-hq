import { describe, expect, it } from "vitest";
import type {
  BuilderDay,
  BuilderMeal,
  CustomerPlanContext,
  LibraryMeal,
} from "@/lib/plan-builder.functions";
import { fallbackPer100 } from "@/lib/ingredient-roles";
import { mealFromLibrary, mealMacros } from "./plan-builder.logic";
import {
  MACRO_TOLERANCE,
  createNutritionResolver,
  isWithinTolerance,
  normalizeTargets,
  optimizeDayToTargets,
  violatesHardRules,
} from "./macro-optimizer";

// ---------------------------------------------------------------- helpers

type Ing = { name: string; amount_g: number };

/** Baut ein Bibliotheksgericht, dessen Makros exakt aus den Zutaten stammen. */
function libMeal(
  id: string,
  name: string,
  category: LibraryMeal["category"],
  ingredients: Ing[],
  extra: Partial<LibraryMeal> = {},
): LibraryMeal {
  let kcal = 0;
  let p = 0;
  let c = 0;
  let f = 0;
  for (const ing of ingredients) {
    const per100 = fallbackPer100(ing.name);
    if (!per100) continue;
    const factor = ing.amount_g / 100;
    kcal += per100.kcal * factor;
    p += per100.protein_g * factor;
    c += per100.carbs_g * factor;
    f += per100.fat_g * factor;
  }
  return {
    id,
    name,
    description: null,
    category,
    kcal: Math.round(kcal),
    protein_g: Math.round(p * 10) / 10,
    carbs_g: Math.round(c * 10) / 10,
    fat_g: Math.round(f * 10) / 10,
    portion_label: null,
    ingredients,
    instructions: null,
    tags: [],
    no_go_ingredients: [],
    suitable_training: true,
    suitable_rest: true,
    mealprep_ok: true,
    eat_cold: false,
    effort: "low",
    budget: "low",
    main_protein: null,
    main_carb: null,
    ...extra,
  };
}

function ctxOf(over: Partial<CustomerPlanContext> = {}): CustomerPlanContext {
  return {
    targets: {
      kcal_train: 2400,
      protein_train: 170,
      carbs_train: 250,
      fat_train: 70,
      kcal_rest: 2100,
      protein_rest: 170,
      carbs_rest: 180,
      fat_rest: 70,
    },
    favoriteFoods: [],
    noGoFoods: [],
    allergies: [],
    intolerances: [],
    dietStyle: null,
    budgetBand: null,
    mealPrepStyle: null,
    eatingStyle: null,
    mealPrepDays: null,
    varietyLevel: "medium",
    trainingWeekdays: [1, 3, 5],
    ...over,
  };
}

// --------------------------------------------------------------- library

const SKYR_BOWL = libMeal("b1", "Skyr-Bowl mit Banane und Haferflocken", "breakfast", [
  { name: "Skyr", amount_g: 250 },
  { name: "Banane", amount_g: 120 },
  { name: "Haferflocken", amount_g: 60 },
]);
const CHICKEN_RICE = libMeal("l1", "Hähnchen mit Reis gekocht", "lunch", [
  { name: "Hähnchenbrust", amount_g: 180 },
  { name: "Reis gekocht", amount_g: 250 },
  { name: "Brokkoli", amount_g: 150 },
]);
const PASTA = libMeal("d1", "Vollkornnudeln gekocht mit Rinderhack", "dinner", [
  { name: "Vollkornnudeln gekocht", amount_g: 250 },
  { name: "Rinderhack", amount_g: 150 },
  { name: "Tomaten", amount_g: 120 },
]);
const SNACK = libMeal("s1", "Reiswaffeln mit Erdnussbutter", "snack", [
  { name: "Reiswaffeln", amount_g: 40 },
  { name: "Erdnussbutter", amount_g: 25 },
]);

// Low-Carb-Alternativen für jeden Slot
const OMELETT = libMeal("b2", "Omelett mit Spinat und Feta", "breakfast", [
  { name: "Ei", amount_g: 200 },
  { name: "Spinat", amount_g: 120 },
  { name: "Feta", amount_g: 40 },
  { name: "Olivenöl", amount_g: 8 },
]);
const CHICKEN_VEG = libMeal("l2", "Hähnchenpfanne mit Brokkoli", "lunch", [
  { name: "Hähnchenbrust", amount_g: 200 },
  { name: "Brokkoli", amount_g: 200 },
  { name: "Zucchini", amount_g: 150 },
  { name: "Olivenöl", amount_g: 10 },
]);
const LACHS = libMeal("d2", "Lachs mit Blumenkohlreis", "dinner", [
  { name: "Lachs", amount_g: 180 },
  { name: "Blumenkohlreis", amount_g: 250 },
  { name: "Olivenöl", amount_g: 8 },
]);
const QUARK_SNACK = libMeal("s2", "Magerquark mit Mandeln", "snack", [
  { name: "Magerquark", amount_g: 200 },
  { name: "Mandeln", amount_g: 20 },
]);
const NUSS_SNACK = libMeal("s3", "Walnüsse", "snack", [{ name: "Walnüsse", amount_g: 30 }]);

// Diät-/Allergie-Kandidaten
const VEGAN_BOWL = libMeal(
  "l3",
  "Tofu-Gemüsepfanne",
  "lunch",
  [
    { name: "Tofu", amount_g: 200 },
    { name: "Brokkoli", amount_g: 200 },
    { name: "Olivenöl", amount_g: 10 },
  ],
  { tags: ["vegan", "vegetarisch"], main_protein: "Tofu" },
);
const NUSS_LUNCH = libMeal(
  "l4",
  "Hähnchensalat mit Walnüssen",
  "lunch",
  [
    { name: "Hähnchenbrust", amount_g: 180 },
    { name: "Salat", amount_g: 150 },
    { name: "Walnüsse", amount_g: 30 },
  ],
  { main_protein: "Hähnchen" },
);

const LIBRARY: LibraryMeal[] = [
  SKYR_BOWL,
  CHICKEN_RICE,
  PASTA,
  SNACK,
  OMELETT,
  CHICKEN_VEG,
  LACHS,
  QUARK_SNACK,
  NUSS_SNACK,
  VEGAN_BOWL,
  NUSS_LUNCH,
];

const resolve = createNutritionResolver(null);

function highCarbDay(): BuilderDay {
  return {
    name: "Montag",
    type: "training",
    meals: [
      mealFromLibrary(SKYR_BOWL, "breakfast"),
      mealFromLibrary(CHICKEN_RICE, "lunch"),
      mealFromLibrary(PASTA, "dinner"),
      mealFromLibrary(SNACK, "snack"),
    ],
  };
}

function dayTotals(day: BuilderDay, library = LIBRARY) {
  return day.meals.reduce(
    (acc, meal) => {
      const m = mealMacros(meal, library);
      return { kcal: acc.kcal + m.kcal, p: acc.p + m.p, c: acc.c + m.c, f: acc.f + m.f };
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
}

function gramsOf(day: BuilderDay, ingredientName: string): number | null {
  for (const meal of day.meals) {
    for (const ing of meal.ingredients) {
      if (ing.name.toLowerCase() === ingredientName.toLowerCase()) return ing.grams;
    }
  }
  return null;
}

// ------------------------------------------------------------------ tests

describe("normalizeTargets", () => {
  it("rundet und begrenzt Eingaben", () => {
    expect(normalizeTargets({ kcal: 2100.4, p: 170.6, c: 30.2, f: 80.5 })).toEqual({
      kcal: 2100,
      p: 171,
      c: 30,
      f: 81,
    });
  });

  it("erzwingt Min-/Max-Grenzen und fängt ungültige Werte ab", () => {
    expect(normalizeTargets({ kcal: 10, p: 0, c: -50, f: 0 })).toEqual({
      kcal: 800,
      p: 20,
      c: 0,
      f: 10,
    });
    expect(normalizeTargets({ kcal: 99999, p: 9999, c: 9999, f: 9999 })).toEqual({
      kcal: 6000,
      p: 400,
      c: 800,
      f: 300,
    });
    expect(normalizeTargets({})).toEqual({ kcal: 800, p: 20, c: 0, f: 10 });
    expect(normalizeTargets({ kcal: Number.NaN, p: Number.NaN, c: Number.NaN, f: Number.NaN })).toEqual(
      { kcal: 800, p: 20, c: 0, f: 10 },
    );
  });
});

describe("Low-Carb-Abnahmetest: 200 g+ KH → 30 g", () => {
  const day = highCarbDay();
  const before = dayTotals(day);
  const target = {
    kcal: Math.round(before.kcal - (before.c - 30) * 4),
    p: Math.round(before.p),
    c: 30,
    f: Math.round(before.f),
  };
  const result = optimizeDayToTargets({ day, target, ctx: ctxOf(), library: LIBRARY, resolve });
  const after = dayTotals(result.day);

  it("startet mit über 200 g Kohlenhydraten", () => {
    expect(before.c).toBeGreaterThan(200);
  });

  it("erreicht 30 g KH innerhalb der ±5-g-Toleranz", () => {
    expect(Math.abs(after.c - 30)).toBeLessThanOrEqual(MACRO_TOLERANCE.c);
    expect(result.totals.c).toBeCloseTo(after.c, 1);
    expect(result.withinTolerance).toBe(true);
  });

  it("meldet Summen, die exakt aus dem zurückgegebenen Tag stammen", () => {
    expect(result.totals.kcal).toBeCloseTo(after.kcal, 1);
    expect(result.totals.p).toBeCloseTo(after.p, 1);
    expect(result.totals.f).toBeCloseTo(after.f, 1);
    expect(isWithinTolerance(result.totals, target)).toBe(true);
  });

  it("reduziert oder ersetzt gezielt die Kohlenhydratquellen", () => {
    const carbSources = ["Reis gekocht", "Vollkornnudeln gekocht", "Haferflocken", "Banane"];
    for (const name of carbSources) {
      const nowGrams = gramsOf(result.day, name);
      const beforeGrams = gramsOf(day, name);
      if (nowGrams === null) continue; // Gericht wurde ersetzt
      expect(nowGrams).toBeLessThan((beforeGrams ?? 0) * 0.6);
    }
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("hält Proteinquellen weitgehend stabil", () => {
    expect(Math.abs(after.p - target.p)).toBeLessThanOrEqual(MACRO_TOLERANCE.p);
    for (const name of ["Skyr", "Hähnchenbrust"]) {
      const nowGrams = gramsOf(result.day, name);
      const beforeGrams = gramsOf(day, name);
      if (nowGrams === null || beforeGrams === null) continue;
      expect(nowGrams).toBeGreaterThanOrEqual(beforeGrams * 0.6);
    }
  });

  it("reduziert kein Gemüse", () => {
    for (const name of ["Brokkoli", "Tomaten", "Spinat", "Zucchini"]) {
      const nowGrams = gramsOf(result.day, name);
      const beforeGrams = gramsOf(day, name);
      if (nowGrams === null || beforeGrams === null) continue;
      expect(nowGrams).toBe(beforeGrams);
    }
  });

  it("erzeugt keine negativen oder unrealistischen Mengen", () => {
    for (const meal of result.day.meals) {
      for (const ing of meal.ingredients) {
        expect(ing.grams).toBeGreaterThanOrEqual(0);
        expect(ing.grams).toBeLessThanOrEqual(1000);
        expect(Number.isFinite(ing.grams)).toBe(true);
      }
      expect(meal.portion_factor ?? 1).toBeGreaterThan(0);
    }
  });

  it("lässt den Ausgangstag unverändert (kein Mutieren der Eingabe)", () => {
    expect(dayTotals(day).c).toBeCloseTo(before.c, 3);
  });
});

describe("harte Regeln bei Ersatzgerichten", () => {
  it("erkennt Diät-Verstöße", () => {
    const vegan = ctxOf({ dietStyle: "vegan" });
    expect(violatesHardRules(VEGAN_BOWL, vegan)).toBe(false);
    expect(violatesHardRules(CHICKEN_RICE, vegan)).toBe(true);
    const vegetarian = ctxOf({ dietStyle: "vegetarisch" });
    expect(violatesHardRules(CHICKEN_RICE, vegetarian)).toBe(true);
    const pesce = ctxOf({ dietStyle: "pescetarisch" });
    expect(violatesHardRules(LACHS, pesce)).toBe(false);
    expect(violatesHardRules(PASTA, pesce)).toBe(true);
  });

  it("erkennt Allergien und No-Gos", () => {
    expect(violatesHardRules(NUSS_LUNCH, ctxOf({ allergies: ["Walnüsse"] }))).toBe(true);
    expect(violatesHardRules(NUSS_LUNCH, ctxOf({ intolerances: ["walnuss"] }))).toBe(true);
    expect(violatesHardRules(CHICKEN_RICE, ctxOf({ noGoFoods: ["Reis"] }))).toBe(true);
    expect(violatesHardRules(CHICKEN_VEG, ctxOf({ noGoFoods: ["Reis"] }))).toBe(false);
  });

  it("verletzt bei aggressivem Ziel weder Ernährungsform noch Allergien", () => {
    const ctx = ctxOf({ dietStyle: "vegan", allergies: ["Walnüsse"], noGoFoods: ["Reis"] });
    const day: BuilderDay = {
      name: "Dienstag",
      type: "rest",
      meals: [mealFromLibrary(CHICKEN_RICE, "lunch"), mealFromLibrary(SNACK, "snack")],
    };
    const result = optimizeDayToTargets({
      day,
      target: { kcal: 900, p: 60, c: 20, f: 45 },
      ctx,
      library: LIBRARY,
      resolve,
    });
    for (const meal of result.day.meals) {
      const lib = LIBRARY.find((m) => m.id === meal.library_meal_id);
      if (!lib) continue;
      // Ersetzte Gerichte müssen hart kompatibel sein
      if (meal.library_meal_id !== CHICKEN_RICE.id && meal.library_meal_id !== SNACK.id) {
        expect(violatesHardRules(lib, ctx)).toBe(false);
      }
    }
  });
});

describe("fixierte Mahlzeiten", () => {
  it("bleiben unverändert und zählen auf das Tagesziel an", () => {
    const day = highCarbDay();
    day.meals[0]!.is_locked = true;
    const lockedBefore = JSON.parse(JSON.stringify(day.meals[0]));
    const lockedMacros = mealMacros(day.meals[0]!, LIBRARY);
    const target = { kcal: 1600, p: 140, c: Math.round(lockedMacros.c) + 20, f: 60 };
    const result = optimizeDayToTargets({ day, target, ctx: ctxOf(), library: LIBRARY, resolve });
    expect(result.day.meals[0]).toEqual(lockedBefore);
    // Die fixierten Makros stecken in den Summen
    expect(result.totals.c).toBeGreaterThanOrEqual(lockedMacros.c - 0.01);
  });

  it("prüft bei komplett fixiertem Tag alle vier Makros", () => {
    const day = highCarbDay();
    for (const meal of day.meals) meal.is_locked = true;
    const totals = dayTotals(day);
    const off = optimizeDayToTargets({
      day,
      // kcal passt, Kohlenhydrate liegen weit daneben
      target: { kcal: Math.round(totals.kcal), p: Math.round(totals.p), c: 30, f: Math.round(totals.f) },
      ctx: ctxOf(),
      library: LIBRARY,
      resolve,
    });
    expect(off.withinTolerance).toBe(false);

    const ok = optimizeDayToTargets({
      day,
      target: {
        kcal: Math.round(totals.kcal),
        p: Math.round(totals.p),
        c: Math.round(totals.c),
        f: Math.round(totals.f),
      },
      ctx: ctxOf(),
      library: LIBRARY,
      resolve,
    });
    expect(ok.withinTolerance).toBe(true);
  });
});

describe("Persistenz & Serialisierung", () => {
  it("übersteht Klonen/Serialisieren mit customTargets, Mengen und macro_override", () => {
    const day = highCarbDay();
    day.customTargets = { kcal: 1800, p: 160, c: 30, f: 85 };
    const optimized = optimizeDayToTargets({
      day,
      target: day.customTargets,
      ctx: ctxOf(),
      library: LIBRARY,
      resolve,
    }).day;

    const roundTrip: BuilderDay = JSON.parse(JSON.stringify(optimized));
    expect(roundTrip.customTargets).toEqual(day.customTargets);
    expect(dayTotals(roundTrip).c).toBeCloseTo(dayTotals(optimized).c, 3);
    for (let i = 0; i < optimized.meals.length; i += 1) {
      expect(roundTrip.meals[i]!.macro_override).toEqual(optimized.meals[i]!.macro_override);
      expect(roundTrip.meals[i]!.ingredients).toEqual(optimized.meals[i]!.ingredients);
    }
  });

  it("lädt alte Pläne ohne neue Felder weiterhin", () => {
    const legacy: BuilderDay = {
      name: "Alt",
      type: "rest",
      meals: [
        {
          slot: "lunch",
          name: "Hähnchen mit Reis gekocht",
          library_meal_id: CHICKEN_RICE.id,
          ingredients: [
            { name: "Hähnchenbrust", grams: 180 },
            { name: "Reis gekocht", grams: 250 },
            { name: "Brokkoli", grams: 150 },
          ],
        } as BuilderMeal,
      ],
    };
    expect(legacy.customTargets).toBeUndefined();
    const totals = dayTotals(legacy);
    expect(totals.kcal).toBeGreaterThan(0);
    const result = optimizeDayToTargets({
      day: legacy,
      target: { kcal: Math.round(totals.kcal * 0.8), p: Math.round(totals.p), c: 40, f: 30 },
      ctx: ctxOf(),
      library: LIBRARY,
      resolve,
    });
    expect(result.day.meals[0]!.ingredients.length).toBe(3);
    expect(result.totals.kcal).toBeGreaterThan(0);
  });
});

describe("manuelle Portionierung nach Zutatenanpassung", () => {
  it("skaliert die angepassten Makros korrekt", () => {
    const day = highCarbDay();
    const target = { kcal: 1700, p: 150, c: 30, f: 80 };
    const optimized = optimizeDayToTargets({ day, target, ctx: ctxOf(), library: LIBRARY, resolve }).day;
    const meal = optimized.meals.find((m) => m.macro_override)!;
    const single = mealMacros({ ...meal, portion_factor: 1 }, LIBRARY);
    const doubled = mealMacros({ ...meal, portion_factor: 2 }, LIBRARY);
    expect(doubled.kcal).toBeCloseTo(single.kcal * 2, 3);
    expect(doubled.c).toBeCloseTo(single.c * 2, 3);
    expect(single.c).toBeCloseTo(meal.macro_override!.carbs_g * (meal.portion_factor ?? 1) === 0 ? 0 : meal.macro_override!.carbs_g, 3);
  });
});

describe("Reporting", () => {
  it("dokumentiert das 30-g-Beispiel", () => {
    const day = highCarbDay();
    const before = dayTotals(day);
    const target = {
      kcal: Math.round(before.kcal - (before.c - 30) * 4),
      p: Math.round(before.p),
      c: 30,
      f: Math.round(before.f),
    };
    const res = optimizeDayToTargets({ day, target, ctx: ctxOf(), library: LIBRARY, resolve });
    const after = dayTotals(res.day);
    const fmt = (t: typeof before) =>
      `kcal ${Math.round(t.kcal)} | P ${t.p.toFixed(1)} | KH ${t.c.toFixed(1)} | F ${t.f.toFixed(1)}`;
    console.log("VORHER :", fmt(before));
    console.log("ZIEL   :", `kcal ${target.kcal} | P ${target.p} | KH ${target.c} | F ${target.f}`);
    console.log("NACHHER:", fmt(after));
    for (const c of res.changes) console.log("  -", JSON.stringify(c));
  });
});
