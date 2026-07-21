import { describe, expect, it } from "vitest";

import {
  buildMealImagePrompt,
  coerceMealImageIngredients,
  firstIngredientImageUrl,
} from "@/lib/meal-image.logic";

describe("meal image logic", () => {
  it("builds a bounded prompt from the meal and its ingredients", () => {
    const prompt = buildMealImagePrompt({
      name: "Hähnchen-Reis-Bowl",
      description: "Mealprep für einen Trainingstag",
      ingredients: [
        { name: "Hähnchenbrust", amount_g: 180 },
        { name: "Basmatireis", amount_g: 150 },
      ],
    });

    expect(prompt).toContain("Hähnchen-Reis-Bowl");
    expect(prompt).toContain("180 g Hähnchenbrust");
    expect(prompt).toContain("150 g Basmatireis");
    expect(prompt).toContain("No people");
    expect(prompt.length).toBeLessThan(1800);
  });

  it("coerces both stored ingredient shapes", () => {
    expect(
      coerceMealImageIngredients([
        { name: "Skyr", amount_g: 250 },
        { display_name: "Beeren", grams: 100 },
        "Honig",
      ]),
    ).toEqual([
      { name: "Skyr", amount_g: 250 },
      { name: "Beeren", amount_g: 100 },
      { name: "Honig" },
    ]);
  });

  it("uses an ingredient image only as a valid http fallback", () => {
    expect(
      firstIngredientImageUrl([
        { name: "Skyr", image_url: "javascript:alert(1)" },
        { name: "Beeren", image_url: "https://cdn.example.test/berries.webp" },
      ]),
    ).toBe("https://cdn.example.test/berries.webp");
  });
});
