import { describe, it, expect } from "vitest";
import {
  pickMealsForDay,
  reoptimizeExistingDay,
  type PoolMeal,
  type AthletePreferences,
  type ExistingMeal,
} from "../plan-builder";

function meal(
  overrides: Partial<PoolMeal> & { id: string; category: PoolMeal["category"] },
): PoolMeal {
  return {
    name: `Meal ${overrides.id}`,
    description: null,
    kcal: 500,
    protein_g: 30,
    carbs_g: 55,
    fat_g: 15,
    suitable_training: true,
    suitable_rest: true,
    no_go_ingredients: [],
    mealprep_ok: true,
    ...overrides,
  };
}

const defaultPrefs: AthletePreferences = {
  no_go_ingredients: [],
  wants_snack: true,
};

const basicPool: PoolMeal[] = [
  meal({ id: "b1", category: "breakfast", kcal: 550, protein_g: 35, carbs_g: 65, fat_g: 12 }),
  meal({ id: "b2", category: "breakfast", kcal: 620, protein_g: 28, carbs_g: 70, fat_g: 20 }),
  meal({ id: "l1", category: "lunch", kcal: 720, protein_g: 45, carbs_g: 80, fat_g: 20 }),
  meal({ id: "l2", category: "lunch", kcal: 800, protein_g: 50, carbs_g: 85, fat_g: 22 }),
  meal({ id: "d1", category: "dinner", kcal: 700, protein_g: 45, carbs_g: 60, fat_g: 25 }),
  meal({ id: "s1", category: "snack", kcal: 260, protein_g: 15, carbs_g: 30, fat_g: 8 }),
  meal({ id: "s2", category: "snack", kcal: 300, protein_g: 20, carbs_g: 30, fat_g: 10 }),
  meal({ id: "pre1", category: "pre_workout", kcal: 220, protein_g: 12, carbs_g: 40, fat_g: 3 }),
  meal({ id: "post1", category: "post_workout", kcal: 260, protein_g: 25, carbs_g: 35, fat_g: 4 }),
];

describe("pickMealsForDay", () => {
  it("baut einen REST-Tag mit 4 Slots (Frühstück/Mittag/Abend/Snack)", () => {
    const r = pickMealsForDay({
      target: { kcal: 2400, protein_g: 160, carbs_g: 260, fat_g: 75 },
      dayType: "REST",
      preferences: defaultPrefs,
      poolMeals: basicPool,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.meals.map((m) => m.meal_slot)).toEqual([
      "breakfast",
      "lunch",
      "dinner",
      "snack",
    ]);
    expect(Math.abs(r.totals.kcal - 2400)).toBeLessThan(150); // ±6%
  });

  it("baut einen FOOTBALL_TRAINING-Tag inklusive pre_workout", () => {
    const r = pickMealsForDay({
      target: { kcal: 2900, protein_g: 190, carbs_g: 340, fat_g: 85 },
      dayType: "FOOTBALL_TRAINING",
      preferences: defaultPrefs,
      poolMeals: basicPool,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.meals.some((m) => m.meal_slot === "pre_workout")).toBe(true);
  });

  it("baut einen DOUBLE_SESSION-Tag mit pre_workout und post_workout", () => {
    const r = pickMealsForDay({
      target: { kcal: 3400, protein_g: 210, carbs_g: 400, fat_g: 95 },
      dayType: "DOUBLE_SESSION",
      preferences: defaultPrefs,
      poolMeals: basicPool,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const slots = r.meals.map((m) => m.meal_slot);
    expect(slots).toContain("pre_workout");
    expect(slots).toContain("post_workout");
  });

  it("respektiert no_go_ingredients", () => {
    const pool = [
      meal({
        id: "b1",
        category: "breakfast",
        no_go_ingredients: ["milch"],
      }),
      meal({ id: "b2", category: "breakfast" }),
      meal({ id: "l1", category: "lunch" }),
      meal({ id: "d1", category: "dinner" }),
    ];
    const r = pickMealsForDay({
      target: { kcal: 2200, protein_g: 140, carbs_g: 240, fat_g: 70 },
      dayType: "REST",
      preferences: { no_go_ingredients: ["Milch"], wants_snack: false },
      poolMeals: pool,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.meals.find((m) => m.library_meal_id === "b1")).toBeUndefined();
  });

  it("meldet LIBRARY_TOO_SPARSE wenn ein Slot fehlt", () => {
    const pool = [meal({ id: "b1", category: "breakfast" })]; // kein Lunch/Dinner
    const r = pickMealsForDay({
      target: { kcal: 2000, protein_g: 130, carbs_g: 220, fat_g: 65 },
      dayType: "REST",
      preferences: defaultPrefs,
      poolMeals: pool,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("LIBRARY_TOO_SPARSE");
  });

  it("filtert suitable_rest=false bei REST", () => {
    const pool = [
      meal({ id: "b1", category: "breakfast", suitable_rest: false }),
      meal({ id: "b2", category: "breakfast", suitable_rest: true }),
      meal({ id: "l1", category: "lunch" }),
      meal({ id: "d1", category: "dinner" }),
      meal({ id: "s1", category: "snack" }),
    ];
    const r = pickMealsForDay({
      target: { kcal: 2200, protein_g: 140, carbs_g: 240, fat_g: 70 },
      dayType: "REST",
      preferences: defaultPrefs,
      poolMeals: pool,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.meals.find((m) => m.library_meal_id === "b1")).toBeUndefined();
  });

  it("ist deterministisch für gleichen Seed", () => {
    const a = pickMealsForDay({
      target: { kcal: 2400, protein_g: 160, carbs_g: 260, fat_g: 75 },
      dayType: "REST",
      preferences: defaultPrefs,
      poolMeals: basicPool,
      seed: "user:2026-07-07",
    });
    const b = pickMealsForDay({
      target: { kcal: 2400, protein_g: 160, carbs_g: 260, fat_g: 75 },
      dayType: "REST",
      preferences: defaultPrefs,
      poolMeals: basicPool,
      seed: "user:2026-07-07",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.meals.map((m) => m.library_meal_id)).toEqual(
      b.meals.map((m) => m.library_meal_id),
    );
  });
});

describe("reoptimizeExistingDay", () => {
  const existing: ExistingMeal[] = [
    { id: "1", library_meal_id: "b1", meal_slot: "breakfast", sort_order: 0, kcal: 500, protein_g: 30, carbs_g: 60, fat_g: 15, is_locked: false, linked_prep_group: null, modification_source: "auto_generated", is_tracked: false },
    { id: "2", library_meal_id: "l1", meal_slot: "lunch", sort_order: 1, kcal: 700, protein_g: 45, carbs_g: 75, fat_g: 20, is_locked: false, linked_prep_group: null, modification_source: "auto_generated", is_tracked: false },
    { id: "3", library_meal_id: "d1", meal_slot: "dinner", sort_order: 2, kcal: 700, protein_g: 45, carbs_g: 60, fat_g: 25, is_locked: false, linked_prep_group: null, modification_source: "auto_generated", is_tracked: false },
    { id: "4", library_meal_id: "s1", meal_slot: "snack", sort_order: 3, kcal: 260, protein_g: 15, carbs_g: 30, fat_g: 8, is_locked: false, linked_prep_group: null, modification_source: "auto_generated", is_tracked: false },
  ];

  it("NO_CHANGE bei sehr kleinem Delta", () => {
    const r = reoptimizeExistingDay({
      existingMeals: existing,
      previousDayType: "REST",
      newDayType: "REST",
      newTarget: { kcal: 2200, protein_g: 140, carbs_g: 230, fat_g: 68 },
      preferences: defaultPrefs,
      poolMeals: basicPool,
    });
    expect("action" in r && r.action).toBe("NO_CHANGE");
  });

  it("SCALE bei moderatem kcal-Delta", () => {
    const r = reoptimizeExistingDay({
      existingMeals: existing,
      previousDayType: "REST",
      newDayType: "REST",
      newTarget: { kcal: 2600, protein_g: 160, carbs_g: 270, fat_g: 78 },
      preferences: defaultPrefs,
      poolMeals: basicPool,
    });
    expect("action" in r && r.action).toBe("SCALE");
  });

  it("REBUILD bei DayType-Wechsel", () => {
    const r = reoptimizeExistingDay({
      existingMeals: existing,
      previousDayType: "REST",
      newDayType: "FOOTBALL_TRAINING",
      newTarget: { kcal: 2900, protein_g: 190, carbs_g: 340, fat_g: 85 },
      preferences: defaultPrefs,
      poolMeals: basicPool,
    });
    expect("action" in r && r.action).toBe("REBUILD");
  });

  it("schützt getrackte Mahlzeiten beim Skalieren", () => {
    const withTracked: ExistingMeal[] = existing.map((m, i) =>
      i === 0 ? { ...m, is_tracked: true } : m,
    );
    const r = reoptimizeExistingDay({
      existingMeals: withTracked,
      previousDayType: "REST",
      newDayType: "REST",
      newTarget: { kcal: 2600, protein_g: 160, carbs_g: 270, fat_g: 78 },
      preferences: defaultPrefs,
      poolMeals: basicPool,
    });
    if ("action" in r && r.action === "SCALE") {
      // Getrackte Mahlzeit darf nicht im Delta enthalten sein.
      expect(r.meals.find((m) => m.sort_order === 0)).toBeUndefined();
    }
  });

  it("respektiert is_locked", () => {
    const withLock: ExistingMeal[] = existing.map((m, i) =>
      i === 1 ? { ...m, is_locked: true } : m,
    );
    const r = reoptimizeExistingDay({
      existingMeals: withLock,
      previousDayType: "REST",
      newDayType: "REST",
      newTarget: { kcal: 2600, protein_g: 160, carbs_g: 270, fat_g: 78 },
      preferences: defaultPrefs,
      poolMeals: basicPool,
    });
    if ("action" in r && r.action === "SCALE") {
      expect(r.meals.find((m) => m.sort_order === 1)).toBeUndefined();
    }
  });

  it("mealprep-Gruppen erhalten denselben Skalierungsfaktor", () => {
    const withGroup: ExistingMeal[] = existing.map((m, i) =>
      i === 1 || i === 2
        ? { ...m, linked_prep_group: "prep-a" }
        : m,
    );
    const r = reoptimizeExistingDay({
      existingMeals: withGroup,
      previousDayType: "REST",
      newDayType: "REST",
      newTarget: { kcal: 2600, protein_g: 160, carbs_g: 270, fat_g: 78 },
      preferences: defaultPrefs,
      poolMeals: basicPool,
    });
    if ("action" in r && r.action === "SCALE" && r.scaleFactor) {
      const lunch = r.meals.find((m) => m.sort_order === 1);
      const dinner = r.meals.find((m) => m.sort_order === 2);
      if (lunch && dinner) expect(lunch.scale).toBeCloseTo(dinner.scale, 5);
    }
  });
});
