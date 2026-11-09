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

  it("uses edited grams instead of the stale amount from a reopened plan", () => {
    expect(normalizeBuilderIngredientsForSave([
      { name: "Reis (roh)", grams: 150, amount: 200, unit: "g" },
      { name: "Honig", grams: 15, amount: 25, unit: "g" },
    ])).toEqual([
      { name: "Reis (roh)", amount: 150, unit: "g" },
      { name: "Honig", amount: 15, unit: "g" },
    ]);
  });

  it("scales an optimized ml amount from its immutable baseline", () => {
    expect(normalizeBuilderIngredientsForSave([
      { name: "Milch 1,5%", grams: 150, base_grams: 200, amount: 200, unit: "ml" },
    ])).toEqual([{ name: "Milch 1,5%", amount: 150, unit: "ml" }]);
  });

  it("keeps explicit optimized zero amounts deleted", () => {
    expect(normalizeBuilderIngredientsForSave([
      { name: "Reis (roh)", grams: 0, base_grams: 200, amount: 200, unit: "g" },
    ])).toEqual([]);
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
