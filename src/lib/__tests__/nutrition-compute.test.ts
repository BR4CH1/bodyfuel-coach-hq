import { describe, expect, it } from "vitest";

import { computeItemMacros, type NutritionFood } from "../nutrition-compute";

const oliveOil: NutritionFood = {
  id: "oil",
  name: "Olivenöl",
  kcal_per_100g: 805,
  protein_per_100g: 0,
  carbs_per_100g: 0,
  fat_per_100g: 91,
  unit_type: "ml",
  default_state: "n_a",
  density_g_per_ml: 0.91,
  verified_by_coach: true,
  source: "bodyfuel_verified",
};

describe("nutrition compute units", () => {
  it("scales liquid macros per 100 ml while retaining its legacy mass", () => {
    const result = computeItemMacros({ food: oliveOil, amount: 100, unit: "ml" });

    expect(result).toMatchObject({ grams: 91, kcal: 805, fat_g: 91 });
  });

  it("blocks macros when a liquid is entered in grams", () => {
    const result = computeItemMacros({ food: oliveOil, amount: 100, unit: "g" });

    expect(result).toMatchObject({ grams: 0, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    expect(result.warnings[0]).toContain("muss in ml eingegeben werden");
  });
});
