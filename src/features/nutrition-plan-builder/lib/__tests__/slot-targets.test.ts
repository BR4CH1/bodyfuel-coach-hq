import { describe, expect, it } from "vitest";
import type { BuilderDay, CustomerPlanContext, LibraryMeal } from "@/lib/plan-builder.functions";
import {
  autoFillDayImpl,
  daySlotTargets,
  rebalanceDay,
  resolveSlotKcalTargets,
  setSlotKcalTarget,
  slotStatus,
  slotTotals,
} from "../plan-builder.logic";

const ctx: CustomerPlanContext = {
  targets: {
    kcal_train: 2400,
    protein_train: 170,
    carbs_train: 280,
    fat_train: 70,
    kcal_rest: 2000,
    protein_rest: 170,
    carbs_rest: 190,
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
  varietyLevel: null,
  trainingWeekdays: [1, 3],
};

function libraryMeal(
  id: string,
  category: LibraryMeal["category"],
  overrides: Partial<LibraryMeal> = {},
): LibraryMeal {
  return {
    id,
    name: `Meal ${id}`,
    description: null,
    category,
    kcal: 500,
    protein_g: 35,
    carbs_g: 50,
    fat_g: 15,
    portion_label: null,
    ingredients: [{ name: "Zutat", amount_g: 100 }],
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
    ...overrides,
  };
}

describe("resolveSlotKcalTargets", () => {
  it("verteilt das Tagesziel nach 25/30/30/15 und trifft die Summe exakt", () => {
    const targets = resolveSlotKcalTargets(2400, null);
    expect(targets.breakfast).toBe(600);
    expect(targets.lunch).toBe(720);
    expect(targets.dinner).toBe(720);
    expect(targets.snack).toBe(360);
    expect(targets.breakfast + targets.lunch + targets.dinner + targets.snack).toBe(2400);
  });

  it("skaliert bestehende Overrides auf ein neues Tagesziel", () => {
    const custom = { breakfast: 500, lunch: 500, dinner: 500, snack: 500 };
    const scaled = resolveSlotKcalTargets(1000, custom);
    expect(scaled.breakfast + scaled.lunch + scaled.dinner + scaled.snack).toBe(1000);
  });
});

describe("setSlotKcalTarget", () => {
  it("verteilt die Differenz proportional und hält das Tagesziel", () => {
    const base = resolveSlotKcalTargets(2000, null);
    const next = setSlotKcalTarget(base, "breakfast", 800, 2000);
    expect(next.breakfast).toBe(800);
    expect(next.lunch + next.dinner + next.snack).toBe(1200);
    expect(next.lunch).toBeGreaterThan(next.snack);
  });

  it("begrenzt extreme Eingaben auf sinnvolle Restwerte", () => {
    const base = resolveSlotKcalTargets(2000, null);
    const next = setSlotKcalTarget(base, "lunch", 100000, 2000);
    expect(next.breakfast + next.lunch + next.dinner + next.snack).toBe(2000);
    expect(next.breakfast).toBeGreaterThan(0);
  });
});

describe("rebalanceDay mit Slot-Zielen", () => {
  const library = [
    libraryMeal("b", "breakfast", { kcal: 400, protein_g: 25, carbs_g: 45, fat_g: 10 }),
    libraryMeal("l", "lunch", { kcal: 600, protein_g: 45, carbs_g: 60, fat_g: 18 }),
  ];

  const day: BuilderDay = {
    name: "Tag 1",
    type: "training",
    meals: [
      { slot: "breakfast", name: "B", library_meal_id: "b", ingredients: [], portion_factor: 4 },
      { slot: "lunch", name: "L", library_meal_id: "l", ingredients: [], portion_factor: 0.25 },
    ],
  };

  it("führt jede Mahlzeit nah an ihr Slot-Ziel statt an das Tagesziel", () => {
    const result = rebalanceDay(day, ctx, library);
    const targets = daySlotTargets(result, ctx);

    for (const slot of ["breakfast", "lunch"] as const) {
      const totals = slotTotals(result, slot, library);
      expect(slotStatus(totals.kcal, targets[slot].kcal)).toBe("on_target");
    }
  });

  it("bläht besetzte Slots nicht auf, wenn andere Slots leer sind", () => {
    const result = rebalanceDay(day, ctx, library);
    const breakfast = slotTotals(result, "breakfast", library);
    expect(breakfast.kcal).toBeLessThan(daySlotTargets(result, ctx).breakfast.kcal * 1.2);
  });

  it("ist stabil: erneutes Rebalance ändert nichts mehr", () => {
    const once = rebalanceDay(day, ctx, library);
    const twice = rebalanceDay(once, ctx, library);
    expect(twice.meals.map((m) => m.portion_factor)).toEqual(
      once.meals.map((m) => m.portion_factor),
    );
  });

  it("lässt fixierte Mahlzeiten unverändert", () => {
    const locked: BuilderDay = {
      ...day,
      meals: day.meals.map((m) => ({ ...m, is_locked: true })),
    };
    const result = rebalanceDay(locked, ctx, library);
    expect(result.meals.map((m) => m.portion_factor)).toEqual([4, 0.25]);
  });
});

describe("autoFillDayImpl mit Slot-Zielen", () => {
  it("erzeugt keine extremen Portionsfaktoren", () => {
    const library = [
      libraryMeal("b1", "breakfast", { kcal: 350 }),
      libraryMeal("l1", "lunch", { kcal: 650 }),
      libraryMeal("d1", "dinner", { kcal: 620 }),
      libraryMeal("s1", "snack", { kcal: 300 }),
    ];
    const day: BuilderDay = { name: "Tag 1", type: "training", meals: [] };
    const filled = autoFillDayImpl(day, ctx, library, "all_unlocked").day;

    for (const meal of filled.meals) {
      const factor = meal.portion_factor ?? 1;
      expect(factor).toBeGreaterThanOrEqual(0.25);
      expect(factor).toBeLessThanOrEqual(4);
    }
  });
});
