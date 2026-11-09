import { describe, expect, it } from "vitest";
import { normalizeNutritionPlan } from "@/lib/coach-plan-import.functions";
import { toEngineIngredientAmount } from "@/lib/nutrition-ingredient-units";

function normalizeIngredient(ingredient: Record<string, unknown>) {
  const plan = normalizeNutritionPlan({
    days: [
      {
        name: "Tag 1",
        meals: [
          {
            slot: "lunch",
            name: "Testgericht",
            ingredients: [{ name: "Zutat", ...ingredient }],
          },
        ],
      },
    ],
  });
  return plan.days[0].meals[0].ingredients[0];
}

describe("normalizeNutritionPlan Zutatenmengen", () => {
  it.each([
    ["Reis roh", 80],
    ["Honig", 15],
    ["Zimt", 2],
  ])("behält positive grams für %s", (name, grams) => {
    const normalized = normalizeIngredient({ name, grams });
    expect(normalized).toEqual({ name, grams });
    expect(toEngineIngredientAmount(normalized)).toEqual({ grams, amount: grams });
  });

  it.each([
    ["Reis roh", 80],
    ["Honig", 15],
    ["Zimt", 2],
  ])("übernimmt Legacy-amount_g für %s", (name, amount_g) => {
    const normalized = normalizeIngredient({ name, amount_g });
    expect(normalized).toEqual({ name, amount_g });
    expect(toEngineIngredientAmount(normalized)).toEqual({ grams: amount_g, amount: amount_g });
  });

  it("behält Milch mit expliziten 200 ml", () => {
    const normalized = normalizeIngredient({ name: "Milch", grams: 206, amount: 200, unit: "ml" });
    expect(normalized).toEqual({ name: "Milch", amount: 200, unit: "ml" });
    expect(toEngineIngredientAmount(normalized)).toEqual({ grams: 200, amount: 200, unit: "ml" });
  });

  it("nutzt amount ohne Einheit als Legacy-Grammangabe", () => {
    expect(normalizeIngredient({ amount: 80 })).toEqual({ name: "Zutat", grams: 80 });
  });

  it("nutzt amount_g, wenn eine explizite Mengenangabe ungültig ist", () => {
    expect(normalizeIngredient({ amount: 0, unit: "g", amount_g: 80 })).toEqual({
      name: "Zutat",
      amount_g: 80,
    });
  });

  it.each([
    { grams: null, amount_g: null, amount: null },
    { grams: 0, amount_g: 0, amount: 0, unit: "g" },
    { grams: undefined, amount_g: undefined, amount: undefined },
  ])("lässt ungültige Mengen nicht als 0 g durchgehen", (amounts) => {
    const normalized = normalizeIngredient(amounts);
    expect(normalized.grams).not.toBe(0);
    expect(normalized.amount).not.toBe(0);
    expect(toEngineIngredientAmount(normalized)).toBeNull();
  });
});
