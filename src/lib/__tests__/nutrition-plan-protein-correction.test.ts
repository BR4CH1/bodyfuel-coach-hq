import { describe, expect, it } from "vitest";
import {
  classifyIngredient,
  correctProteinOverflow,
  scaleFallbackGrams,
} from "@/lib/nutrition-plan-protein-correction";

const meal = (name: string, ingredients: { name: string; amount: number }[]) => ({
  name,
  slot: "dinner",
  ingredients: ingredients.map((i) => ({ ...i, unit: "g" })),
});

describe("Protein-Korrektur", () => {
  it("klassifiziert protein- und kohlenhydratreiche Zutaten", () => {
    expect(classifyIngredient("Hähnchenbrust")).toBe("protein");
    expect(classifyIngredient("Reis")).toBe("carb");
  });

  it("skaliert proteinreiche Zutaten herunter, wenn die Obergrenze gerissen wird", () => {
    const result = correctProteinOverflow({
      meals: [meal("Protein-Teller", [{ name: "Hähnchenbrust", amount: 200 }, { name: "Reis", amount: 200 }])],
      proteinTotal: 160,
      proteinCap: 120,
    });
    expect(result.changed).toBe(true);
    expect(result.scaleFactor).toBeLessThan(1);
    const chicken = result.meals[0].ingredients.find((i) => i.name === "Hähnchenbrust")!;
    const rice = result.meals[0].ingredients.find((i) => i.name === "Reis")!;
    expect(chicken.amount).toBeLessThan(200);
    expect(rice.amount).toBeGreaterThanOrEqual(200);
  });

  it("lässt Tage innerhalb der Obergrenze unverändert", () => {
    const meals = [meal("Ok", [{ name: "Hähnchenbrust", amount: 150 }])];
    const result = correctProteinOverflow({ meals, proteinTotal: 100, proteinCap: 120 });
    expect(result.changed).toBe(false);
    expect(result.meals[0].ingredients[0].amount).toBe(150);
  });

  it("skaliert Fallback-Grammaturen auf das Tagesziel", () => {
    expect(scaleFallbackGrams(200, 0.5)).toBeLessThan(200);
    expect(scaleFallbackGrams(200, 1)).toBe(200);
  });
});
