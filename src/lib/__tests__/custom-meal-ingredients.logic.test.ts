import { describe, expect, it } from "vitest";

import {
  formatIngredientAmount,
  resolveIngredientAmount,
  scaleIngredientToAmount,
  sumIngredientMacros,
} from "../custom-meal-ingredients.logic";

const rice = {
  name: "Reis, gekocht",
  amount: 200,
  unit: "g" as const,
  amount_g: 200,
  kcal: 260,
  protein_g: 5,
  carbs_g: 56,
  fat_g: 0.6,
};

describe("custom meal ingredients", () => {
  it("liest neue und Legacy-Mengen", () => {
    expect(resolveIngredientAmount(rice)).toEqual({ amount: 200, unit: "g", scalable: true });
    expect(resolveIngredientAmount({ name: "Alt", amount_g: 150 })).toEqual({
      amount: 150,
      unit: "g",
      scalable: true,
    });
    expect(resolveIngredientAmount({ name: "Ohne" }).scalable).toBe(false);
  });

  it("skaliert Makros linear zur neuen Menge", () => {
    const scaled = scaleIngredientToAmount(rice, 150);
    expect(scaled).toMatchObject({ amount: 150, amount_g: 150, kcal: 195, protein_g: 3.8 });
  });

  it("lässt nicht skalierbare Zutaten unverändert", () => {
    const ing = { name: "Gewürze", kcal: 5 };
    expect(scaleIngredientToAmount(ing, 50)).toBe(ing);
  });

  it("summiert Mahlzeiten-Makros", () => {
    expect(sumIngredientMacros([rice, { name: "Öl", amount: 10, unit: "ml", kcal: 90, fat_g: 10 }]))
      .toEqual({ kcal: 350, protein_g: 5, carbs_g: 56, fat_g: 10.6 });
  });

  it("formatiert Mengen lesbar", () => {
    expect(formatIngredientAmount({ amount: 150, unit: "g", scalable: true })).toBe("150 g");
    expect(formatIngredientAmount({ amount: 0, unit: "g", scalable: false })).toBe(
      "Menge unbekannt",
    );
  });
});
