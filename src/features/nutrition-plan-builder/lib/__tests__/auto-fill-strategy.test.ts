import { describe, expect, it } from "vitest";
import type { BuilderDay, CustomerPlanContext, LibraryMeal } from "@/lib/plan-builder.functions";
import {
  autoFillWeekPairWithStrategy,
  autoFillWeekWithStrategy,
  contextForAutoFillStrategy,
} from "../auto-fill-strategy";

const baseContext: CustomerPlanContext = {
  targets: {
    kcal_train: 2000,
    protein_train: 160,
    carbs_train: 210,
    fat_train: 60,
    kcal_rest: 1800,
    protein_rest: 160,
    carbs_rest: 170,
    fat_rest: 60,
  },
  favoriteFoods: [],
  noGoFoods: [],
  allergies: [],
  intolerances: [],
  dietStyle: null,
  budgetBand: null,
  mealPrepStyle: "meal_prep",
  eatingStyle: "meal_prep",
  mealPrepDays: 3,
  varietyLevel: "low",
  trainingWeekdays: [],
};

function meal(id: string, category: LibraryMeal["category"], kcal = 450): LibraryMeal {
  return {
    id,
    name: id,
    description: null,
    category,
    kcal,
    protein_g: 40,
    carbs_g: 45,
    fat_g: 12,
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
  };
}

const library = (["breakfast", "lunch", "dinner", "snack"] as const).flatMap((slot) => [
  meal(`${slot}-a`, slot),
  meal(`${slot}-b`, slot),
  meal(`${slot}-c`, slot),
]);

const emptyDays: BuilderDay[] = Array.from({ length: 4 }, (_, index) => ({
  name: `Tag ${index + 1}`,
  type: "rest",
  meals: [],
}));

describe("nutrition builder auto-fill strategy", () => {
  it("does not mutate the stored profile when a strategy overrides planning preferences", () => {
    const original = structuredClone(baseContext);
    const variety = contextForAutoFillStrategy(baseContext, "variety");

    expect(variety.varietyLevel).toBe("high");
    expect(variety.mealPrepDays).toBe(1);
    expect(baseContext).toEqual(original);
  });

  it("forces Variety to rotate meals even when the profile prefers mealprep", () => {
    const result = autoFillWeekWithStrategy(
      emptyDays.slice(0, 3),
      baseContext,
      library,
      "empty_only",
      "variety",
    );
    const breakfastIds = result.days.map(
      (day) => day.meals.find((entry) => entry.slot === "breakfast")?.library_meal_id,
    );

    expect(new Set(breakfastIds).size).toBe(3);
  });

  it("forces Mealprep to repeat suitable meals even when the profile prefers variety", () => {
    const result = autoFillWeekWithStrategy(
      emptyDays,
      {
        ...baseContext,
        mealPrepStyle: "daily",
        eatingStyle: null,
        mealPrepDays: 1,
        varietyLevel: "high",
      },
      library,
      "empty_only",
      "mealprep",
    );
    const breakfastIds = result.days.map(
      (day) => day.meals.find((entry) => entry.slot === "breakfast")?.library_meal_id,
    );

    expect(breakfastIds[1]).toBe(breakfastIds[0]);
    expect(breakfastIds[2]).toBe(breakfastIds[0]);
    expect(breakfastIds[3]).not.toBe(breakfastIds[0]);
  });

  it("keeps shared partner slots on the same recipes while portions remain person-specific", () => {
    const clientContext = {
      ...baseContext,
      targets: {
        ...baseContext.targets,
        kcal_rest: 1800,
        protein_rest: 150,
        carbs_rest: 180,
        fat_rest: 55,
      },
    };
    const partnerContext = {
      ...baseContext,
      targets: {
        ...baseContext.targets,
        kcal_rest: 2400,
        protein_rest: 190,
        carbs_rest: 260,
        fat_rest: 75,
      },
    };
    const result = autoFillWeekPairWithStrategy(
      emptyDays.slice(0, 3),
      emptyDays.slice(0, 3),
      clientContext,
      partnerContext,
      library,
      "empty_only",
      { breakfast: false, lunch: false, dinner: true, snack: false },
      "mealprep",
    );

    for (let index = 0; index < result.clientDays.length; index += 1) {
      const clientDinner = result.clientDays[index].meals.find((entry) => entry.slot === "dinner");
      const partnerDinner = result.partnerDays[index].meals.find((entry) => entry.slot === "dinner");
      expect(clientDinner?.library_meal_id).toBe(partnerDinner?.library_meal_id);
      expect(clientDinner?.linked_partner_group).toBeTruthy();
      expect(clientDinner?.linked_partner_group).toBe(partnerDinner?.linked_partner_group);
    }

    const clientDinner = result.clientDays[0].meals.find((entry) => entry.slot === "dinner");
    const partnerDinner = result.partnerDays[0].meals.find((entry) => entry.slot === "dinner");
    expect(clientDinner?.portion_factor).not.toBe(partnerDinner?.portion_factor);
  });
});
