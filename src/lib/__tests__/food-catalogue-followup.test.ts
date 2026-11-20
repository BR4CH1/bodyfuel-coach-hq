import { describe, expect, it } from "vitest";
import followup from "../data/food-catalogue-followup-2026-11-20.json";
import { catalogueReviewRows, reviewedNutrientChanges } from "../food-catalogue-review.logic";

describe("reviewed follow-up catalogue sources", () => {
  it("reviews all 134 remaining identities without replacing original identities", () => {
    expect(followup.rows).toHaveLength(134);
    expect(catalogueReviewRows).toHaveLength(372);
    expect(new Set(catalogueReviewRows.map((row) => row.id)).size).toBe(372);
    expect(followup.rows.filter((row) => row.status === "source_checked")).toHaveLength(23);
  });
  it("keeps cooked long-grain rice on its own USDA source", () => {
    const row = catalogueReviewRows.find((r) => r.name === "Reis weiß, langkorn, gekocht");
    expect(row?.source_record).toBe("169757");
    expect(row?.nutrients?.kcal_per_100g).toBe(130);
    expect(row?.state).toBe("cooked");
    expect(row?.nutrients?.carbs_per_100g).toBe(27.77);
  });
  it("subtracts USDA fibre but never recalculates source energy", () => {
    const row = catalogueReviewRows.find((r) => r.name === "Schwarze Bohnen (gekocht)");
    expect(row?.nutrients?.carbs_per_100g).toBe(15.01);
    expect(row?.nutrients?.fiber_per_100g).toBe(8.7);
    expect(row?.nutrients?.kcal_per_100g).toBe(132);
  });
  it("corrects smoked salmon from BLS and clears the review exclusion", () => {
    const row = catalogueReviewRows.find((r) => r.name === "Räucherlachs");
    if (!row) throw new Error("Missing reviewed salmon");
    expect(reviewedNutrientChanges(row)).toMatchObject({ kcal_per_100g: 170, protein_per_100g: 21.25, default_state: "n_a", needs_review: false });
  });
  it("never substitutes a different rice variety", () => {
    expect(catalogueReviewRows.find((r) => r.name === "Reis Basmati (gekocht)")?.status).toBe("needs_source_review");
    expect(catalogueReviewRows.find((r) => r.name === "Reis Jasmin (roh)")?.status).toBe("needs_source_review");
  });
  it("never turns a 100 ml label into verified 100 g values", () => {
    const row = catalogueReviewRows.find((r) => r.name === "Coca-Cola");
    if (!row) throw new Error("Missing cola");
    expect(reviewedNutrientChanges(row)).toBeNull();
    expect(row.status).toBe("needs_source_review");
  });
  it("does not guess missing fibre for tempeh", () => {
    expect(catalogueReviewRows.find((r) => r.name === "Tempeh")?.status).toBe("needs_source_review");
  });
});