import { describe, expect, it } from "vitest";
import { toEngineIngredientAmount } from "@/lib/nutrition-ingredient-units";

describe("toEngineIngredientAmount", () => {
  it.each([
    ["Reis", 100],
    ["Honig", 15],
    ["Zimt", 2],
  ])("lässt bei Legacy-%s die Einheit für die Food-DB offen", (_name, grams) => {
    expect(toEngineIngredientAmount({ grams })).toEqual({ grams, amount: grams });
  });

  it.each([
    ["Reis roh", 100],
    ["Honig", 15],
    ["Zimt", 2],
  ])("übernimmt bei Legacy-%s amount_g", (_name, amount_g) => {
    expect(toEngineIngredientAmount({ amount_g })).toEqual({ grams: amount_g, amount: amount_g });
  });

  it("bewahrt eine explizite Flüssigkeitsmenge in ml", () => {
    expect(toEngineIngredientAmount({ grams: 206, amount: 200, unit: "ml" })).toEqual({
      grams: 200,
      amount: 200,
      unit: "ml",
    });
  });

  it("bewahrt eine explizite feste Menge in g", () => {
    expect(toEngineIngredientAmount({ amount: 80, unit: "g" })).toEqual({
      grams: 80,
      amount: 80,
      unit: "g",
    });
  });

  it("weist fehlende oder nicht-positive Mengen ab", () => {
    expect(toEngineIngredientAmount({})).toBeNull();
    expect(toEngineIngredientAmount({ grams: 0 })).toBeNull();
    expect(toEngineIngredientAmount({ amount: -1, unit: "ml" })).toBeNull();
  });
});
