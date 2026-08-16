import { describe, expect, it } from "vitest";
import { normalizeBuilderIngredientsForSave } from "./ingredient-save.logic";

describe("normalizeBuilderIngredientsForSave", () => {
  it("publishes Reis, Honig und Zimt with current grams", () => {
    expect(normalizeBuilderIngredientsForSave([
      { name: "Reis (roh)", grams: 80 },
      { name: "Honig", grams: 10 },
      { name: "Zimt", grams: 2 },
    ])).toEqual([
      { name: "Reis (roh)", grams: 80 },
      { name: "Honig", grams: 10 },
      { name: "Zimt", grams: 2 },
    ]);
  });

  it("recovers legacy amount_g auto-drafts", () => {
    expect(normalizeBuilderIngredientsForSave([
      { name: "Reis (roh)", amount_g: 80 },
      { name: "Honig", amount_g: 10 },
      { name: "Zimt", amount_g: 2 },
    ])).toEqual([
      { name: "Reis (roh)", grams: 80 },
      { name: "Honig", grams: 10 },
      { name: "Zimt", grams: 2 },
    ]);
  });

  it("preserves explicit ml from the Food DB", () => {
    expect(normalizeBuilderIngredientsForSave([
      { name: "Milch 1,5%", grams: 206, amount: 200, unit: "ml" },
    ])).toEqual([{ name: "Milch 1,5%", amount: 200, unit: "ml" }]);
  });

  it("does not revive an ingredient explicitly optimized to zero", () => {
    expect(normalizeBuilderIngredientsForSave([
      { name: "Reis (roh)", grams: 0, amount_g: 80 },
      { name: "Hähnchenbrust", grams: 180 },
    ])).toEqual([{ name: "Hähnchenbrust", grams: 180 }]);
  });

  it("applies portion scaling after legacy recovery", () => {
    expect(normalizeBuilderIngredientsForSave([
      { name: "Reis (roh)", amount_g: 80 },
      { name: "Zimt", grams: 2 },
    ], 0.5)).toEqual([
      { name: "Reis (roh)", grams: 40 },
      { name: "Zimt", grams: 1 },
    ]);
  });
});
