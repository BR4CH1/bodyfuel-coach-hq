import { describe, expect, it } from "vitest";
import type { BuilderDay, CustomerPlanContext, LibraryMeal } from "@/lib/plan-builder.functions";
import {
  autoFillDayImpl,
  buildBuilderDays,
  cloneBuilderDays,
  remapMealsForCopy,
} from "../plan-builder.logic";

const context: CustomerPlanContext = {
  targets: {
    kcal_train: 2600,
    protein_train: 180,
    carbs_train: 300,
    fat_train: 75,
    kcal_rest: 2200,
    protein_rest: 180,
    carbs_rest: 210,
    fat_rest: 80,
  },
  favoriteFoods: [],
  noGoFoods: [],
  allergies: [],
  intolerances: [],
  dietStyle: null,
  budgetBand: null,
  mealPrepStyle: null,
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

describe("buildBuilderDays", () => {
  it("setzt Tagesarten aus Trainingstagen und erhält manuelle Overrides", () => {
    const previous: BuilderDay[] = [
      {
        name: "Alt",
        type: "rest",
        typeOverride: true,
        meals: [],
      },
    ];

    const days = buildBuilderDays(previous, "2026-07-20", 3, [1, 3]);

    expect(days).toHaveLength(3);
    expect(days[0].type).toBe("rest");
    expect(days[0].typeOverride).toBe(true);
    expect(days[1].type).toBe("rest");
    expect(days[2].type).toBe("training");
    expect(days[0].name).toContain("Mo 20.07");
  });
});

describe("cloneBuilderDays", () => {
  it("erstellt eine tiefe Kopie der Mahlzeiten und Zutaten", () => {
    const source: BuilderDay[] = [
      {
        name: "Tag 1",
        type: "training",
        meals: [
          {
            slot: "breakfast",
            name: "Porridge",
            ingredients: [{ name: "Haferflocken", grams: 80 }],
          },
        ],
      },
    ];

    const cloned = cloneBuilderDays(source);
    cloned[0].meals[0].ingredients[0].grams = 120;

    expect(source[0].meals[0].ingredients[0].grams).toBe(80);
  });
});

describe("remapMealsForCopy", () => {
  it("vergibt neue Gruppen-IDs und hält Partnerkopplungen synchron", () => {
    const client: BuilderDay["meals"] = [
      {
        slot: "dinner",
        name: "Bowl",
        ingredients: [],
        linked_partner_group: "shared-old",
        linked_prep_group: "prep-old",
      },
    ];
    const partner: BuilderDay["meals"] = [
      {
        slot: "dinner",
        name: "Bowl",
        ingredients: [],
        linked_partner_group: "shared-old",
        linked_prep_group: "partner-prep-old",
      },
    ];
    const partnerGroups = new Map<string, string>();

    const clientCopy = remapMealsForCopy(client, partnerGroups, new Map());
    const partnerCopy = remapMealsForCopy(partner, partnerGroups, new Map());

    expect(clientCopy[0].linked_partner_group).not.toBe("shared-old");
    expect(clientCopy[0].linked_partner_group).toBe(partnerCopy[0].linked_partner_group);
    expect(clientCopy[0].linked_prep_group).not.toBe("prep-old");
  });
});

describe("autoFillDayImpl", () => {
  it("füllt leere Slots und lässt fixierte Mahlzeiten unverändert", () => {
    const lockedMeal = {
      slot: "breakfast" as const,
      name: "Fixiertes Frühstück",
      ingredients: [],
      is_locked: true,
    };
    const day: BuilderDay = {
      name: "Tag 1",
      type: "training",
      meals: [lockedMeal],
    };
    const library = [
      libraryMeal("breakfast", "breakfast"),
      libraryMeal("lunch", "lunch"),
      libraryMeal("dinner", "dinner"),
      libraryMeal("snack", "snack"),
    ];

    const result = autoFillDayImpl(day, context, library, "all_unlocked");

    expect(result.missing).toEqual([]);
    expect(result.day.meals).toHaveLength(4);
    expect(result.day.meals.find((meal) => meal.slot === "breakfast")?.name).toBe(
      "Fixiertes Frühstück",
    );
  });
});
