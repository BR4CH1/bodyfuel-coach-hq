import { describe, expect, it } from "vitest";

import {
  amountInGrams,
  calculateNutritionTotals,
  cleanPlanEntryName,
  favoriteKey,
  localFoodMatches,
  parseFoodAmount,
  shiftIsoDate,
} from "../nutrition-tracker.logic";
import type { FoodEntry } from "../../types";

const food = {
  name: "Proteinriegel",
  brand: "BodyFuel",
  barcode: null,
  unit: "g" as const,
  density_g_per_ml: null,
  serving_g: 50,
  serving_label: "Riegel",
  kcal_per_100g: 400,
  protein_per_100g: 30,
  carbs_per_100g: 40,
  fat_per_100g: 10,
};

describe("nutrition tracker logic", () => {
  it("finds umlaut and compact local-food matches", () => {
    expect(localFoodMatches("Körniger Frischkäse", "koerniger frischkaese")).toBe(true);
    expect(localFoodMatches("High Protein Pudding", "highprotein")).toBe(true);
  });

  it("calculates totals with numeric database values", () => {
    const entries = [
      {
        id: "1",
        food_id: null,
        meal: "breakfast",
        name: "Skyr",
        brand: null,
        serving_amount: 250,
        amount_unit: "g",
        serving_g: 250,
        kcal: 150,
        protein_g: 27,
        carbs_g: 10,
        fat_g: 1,
        source: null,
      },
      {
        id: "2",
        food_id: null,
        meal: "snack",
        name: "Banane",
        brand: null,
        serving_amount: 120,
        amount_unit: "g",
        serving_g: 120,
        kcal: 105,
        protein_g: 1.2,
        carbs_g: 27,
        fat_g: 0.3,
        source: null,
      },
    ] satisfies FoodEntry[];

    expect(calculateNutritionTotals(entries)).toEqual({
      kcal: 255,
      protein_g: 28.2,
      carbs_g: 37,
      fat_g: 1.3,
    });
  });

  it("uses grams for solids, density for liquid mass and accepts decimal commas", () => {
    expect(parseFoodAmount("1,5")).toBe(1.5);
    expect(amountInGrams(food, "g", 80)).toBe(80);
    expect(amountInGrams({ ...food, unit: "ml", density_g_per_ml: 1.03 }, "ml", 250)).toBe(257.5);
  });

  it("cleans plan prefixes without changing manual entries", () => {
    expect(cleanPlanEntryName("Frühstück — Skyr Bowl", "plan:123")).toBe("Skyr Bowl");
    expect(cleanPlanEntryName("Frühstück — Skyr Bowl", "manual")).toBe("Frühstück — Skyr Bowl");
  });

  it("builds stable favorite keys and shifts ISO dates", () => {
    expect(favoriteKey(food)).toBe("Proteinriegel|BodyFuel");
    expect(shiftIsoDate("2026-07-19", -1)).toBe("2026-07-18");
  });
});
