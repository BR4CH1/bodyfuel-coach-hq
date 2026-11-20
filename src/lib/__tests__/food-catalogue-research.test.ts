import { describe, expect, it } from "vitest";
import { catalogueReviewRows, reviewedNutrientChanges } from "../food-catalogue-review.logic";

describe("additional independently researched sources", () => {
  for (const [name, code, kcal, fat] of [
    ["Ahornsirup", "169661", 260, 0.06],
    ["Kokosöl", "171412", 892, 99.06],
    ["Gouda", "171241", 356, 27.44],
  ] as const) {
    it(`${name} uses its exact USDA record with complete fibre`, () => {
      const row = catalogueReviewRows.find((r) => r.name === name && r.status === "source_checked");
      if (!row) throw new Error(`Missing ${name}`);
      expect(row.source_record).toBe(code);
      expect(reviewedNutrientChanges(row)).toMatchObject({ kcal_per_100g: kcal, fat_per_100g: fat, fiber_per_100g: 0, needs_review: false });
    });
  }
  for (const [name, code, kcal, fibre, state] of [
    ["Bagel", "2707684", 264, 1.6, "n_a"],
    ["Bohnen weiß, gekocht (Dose)", "175204", 114, 4.8, "n_a"],
    ["Fischstäbchen (gekocht)", "174195", 277, 1.5, "cooked"],
    ["Hähnchenschenkel ohne Haut (roh)", "173627", 121, 0, "raw"],
  ] as const) {
    it(`${name} keeps its source preparation and complete nutrients`, () => {
      const row = catalogueReviewRows.find((r) => r.name === name);
      if (!row) throw new Error(`Missing ${name}`);
      expect(row.source_record).toBe(code);
      expect(reviewedNutrientChanges(row)).toMatchObject({ kcal_per_100g: kcal, fiber_per_100g: fibre, default_state: state, needs_review: false });
    });
  }
  it("preserves researched cocoa energy while keeping the conflict excluded", () => {
    const row = catalogueReviewRows.find((r) => r.name === "Kakaopulver");
    if (!row) throw new Error("Missing cocoa");
    expect(row.nutrients?.kcal_per_100g).toBe(228);
    expect(reviewedNutrientChanges(row)).toBeNull();
  });
  it("uses the complete dry whey source, including its declared fibre", () => {
    const row = catalogueReviewRows.find((r) => r.name === "Whey Protein Pulver (trocken)");
    if (!row) throw new Error("Missing whey");
    expect(reviewedNutrientChanges(row)).toMatchObject({ kcal_per_100g: 352, protein_per_100g: 78.1, fiber_per_100g: 3.1, carbs_per_100g: 3.15, default_state: "n_a" });
  });
});