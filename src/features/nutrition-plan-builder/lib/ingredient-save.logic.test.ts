import { describe, expect, it } from "vitest";
import { normalizeBuilderIngredientsForSave } from "./ingredient-save.logic";

describe("normalizeBuilderIngredientsForSave", () => {
  it("keeps current gram amounts for rice, honey and cinnamon", () => {
    expect(
      normalizeBuilderIngredientsForSave([
        { name: "Reis (roh)", grams: 80 },
        { name: "Honig", grams: 10 },
        { name: "Zimt", grams: 2 },
      ]),
    ).toEqual([
      { name: "Reis (roh)", grams: 80 },
      { name: "Honig", grams: 10 },
      { name: "Zimt", grams: 2 },
    ]);
  });

  it("recovers legacy amount_g drafts instead of converting every ingredient to 0 g", () => {
    expect(
      normalizeBuilderIngredientsForSave([
        { name: "Reis (roh)", amount_g: 80 },
        { name: "Honig", amount_g: 10 },
        { name: "Zimt", amount_g: 2 },
      ]),
    ).toEqual([
      { name: "Reis (roh)", grams: 80 },
      { name: "Honig", grams: 10 },
      { name: "Zimt", grams: 2 },
    ]);
  });

  it("drops ingredients deliberately optimized to zero grams", () => {
    expect(
      normalizeBuilderIngredientsForSave([
        { name: "Reis (roh)", grams: 0, amount_g: 80 },
        { name: "Hähnchenbrust", grams: 180 },
      ]),
    ).toEqual([{ name: "Hähnchenbrust", grams: 180 }]);
  });

  it("applies the portion factor after recovering the amount", () => {
    expect(
      normalizeBuilderIngredientsForSave(
        [
          { name: "Reis (roh)", amount_g: 80 },
          { name: "Zimt", grams: 2 },
        ],
        0.5,
      ),
    ).toEqual([
      { name: "Reis (roh)", grams: 40 },
      { name: "Zimt", grams: 1 },
    ]);
  });
});
