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

const findAmount = (
  ingredients: { name?: string | null; amount?: number | null }[] | null | undefined,
  name: string,
): number => {
  const hit = (ingredients ?? []).find((i) => i.name === name);
  return Number(hit?.amount ?? 0);
};

describe("Protein-Korrektur", () => {
  it("klassifiziert protein- und kohlenhydratreiche Zutaten", () => {
    expect(classifyIngredient("Hähnchenbrust")).toBe("protein");
    expect(classifyIngredient("Reis")).toBe("carb");
  });

  it("skaliert proteinreiche Zutaten herunter, wenn die Obergrenze gerissen wird", () => {
    const result = correctProteinOverflow(
      [
        meal("Protein-Teller", [
          { name: "Hähnchenbrust", amount: 200 },
          { name: "Reis", amount: 200 },
        ]),
      ],
      160,
      120,
    );
    expect(result.changed).toBe(true);
    expect(result.scaleFactor).toBeLessThan(1);
    expect(findAmount(result.meals[0]?.ingredients, "Hähnchenbrust")).toBeLessThan(200);
    expect(findAmount(result.meals[0]?.ingredients, "Reis")).toBeGreaterThanOrEqual(200);
  });

  it("lässt Tage innerhalb der Obergrenze unverändert", () => {
    const result = correctProteinOverflow(
      [meal("Ok", [{ name: "Hähnchenbrust", amount: 150 }])],
      100,
      120,
    );
    expect(result.changed).toBe(false);
    expect(findAmount(result.meals[0]?.ingredients, "Hähnchenbrust")).toBe(150);
  });

  it("skaliert Fallback-Grammaturen auf das Tagesziel", () => {
    const low = scaleFallbackGrams({ grams: 200, targetKcal: 1200, referenceKcal: 2400 });
    const even = scaleFallbackGrams({ grams: 200, targetKcal: 2400, referenceKcal: 2400 });
    expect(low).toBeLessThan(200);
    expect(even).toBe(200);
  });
});
