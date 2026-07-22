import { describe, expect, it } from "vitest";

import {
  amountToGrams,
  energyFromNutrients,
  foodAmountUnit,
  macroFactorForAmount,
} from "../food-units";

describe("food units", () => {
  it("uses ml only for liquids and grams for every other food", () => {
    expect(foodAmountUnit({ unit: "ml" })).toBe("ml");
    expect(foodAmountUnit({ unit: "g" })).toBe("g");
    expect(foodAmountUnit({})).toBe("g");
  });

  it("scales macros against 100 of the displayed reference unit", () => {
    expect(macroFactorForAmount(250)).toBe(2.5);
    expect(macroFactorForAmount(-10)).toBe(0);
  });

  it("keeps liquid display volume separate from legacy mass", () => {
    expect(amountToGrams({ unit: "ml", density_g_per_ml: 0.91 }, 100)).toBe(91);
    expect(amountToGrams({ unit: "g" }, 100)).toBe(100);
  });

  it("includes fibre and alcohol in EU food-energy validation", () => {
    expect(
      energyFromNutrients({
        protein_g: 10,
        carbs_g: 20,
        fat_g: 5,
        fiber_g: 8,
        alcohol_g: 2,
      }),
    ).toBe(195);
  });
});
