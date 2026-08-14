import { describe, expect, it } from "vitest";
import { shoppingIngredientLines } from "@/lib/shopping-list-ingredients.logic";

describe("shoppingIngredientLines", () => {
  it("prefers existing recipe ingredient strings", () => {
    expect(
      shoppingIngredientLines({
        recipe_ingredients: ["250 g Hähnchenbrust", "100 g Reis"],
        ingredients_json: [{ name: "ignored", grams: 1 }],
      }),
    ).toEqual(["250 g Hähnchenbrust", "100 g Reis"]);
  });

  it("converts manual builder ingredients_json to parser lines", () => {
    expect(
      shoppingIngredientLines({
        ingredients_json: [
          { name: "Hähnchenbrust", grams: 250 },
          { name: "Milch", amount: 200, unit: "ml" },
          { name: "Reis", amount: 100, unit: "g" },
        ],
      }),
    ).toEqual(["250 g Hähnchenbrust", "200 ml Milch", "100 g Reis"]);
  });

  it("keeps a named ingredient even when an amount is unavailable", () => {
    expect(shoppingIngredientLines({ ingredients_json: [{ name: "Salz" }] })).toEqual(["Salz"]);
  });
});
