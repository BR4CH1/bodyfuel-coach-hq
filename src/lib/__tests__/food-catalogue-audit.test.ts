import { describe, expect, it } from "vitest";
import manifest from "../data/food-catalogue-audit-2026-11-20.json";
import { mapOffProduct } from "../open-food-facts.server";

describe("source-reviewed catalogue", () => {
  it("accounts for every one of the 372 food identities exactly once", () => {
    expect(manifest.rows).toHaveLength(372);
    expect(new Set(manifest.rows.map((r) => r.id)).size).toBe(372);
  });
  for (const name of ["Rucola (roh)", "Schweinefilet (roh)", "Thunfisch in Wasser (abgetropft)", "Wassermelone (roh)", "Weintrauben (roh)"]) {
    it(`${name} is not a liquid`, () => {
      const row = manifest.rows.find((r) => r.name === name);
      expect(row?.status).toBe("source_checked");
      expect(row?.reference_unit).toBe("g");
    });
  }
  for (const name of ["Bulgur gekocht", "Couscous gekocht", "Quinoa gekocht"]) {
    it(`${name} keeps cooked values separate`, () => {
      expect(manifest.rows.find((r) => r.name === name)?.state).toBe("cooked");
    });
  }
  it("stores BLS R258100 pepper carbs separately from fibre", () => {
    const row = manifest.rows.find((r) => r.name === "Pfeffer");
    expect(row?.nutrients?.carbs_per_100g).toBe(46.07);
    expect(row?.nutrients?.fiber_per_100g).toBe(25.5);
    expect(row?.nutrients?.kcal_per_100g).toBe(304);
  });
});

describe("label imports", () => {
  it("rejects serving-only energy rather than interpreting it as 100 g energy", () => {
    expect(mapOffProduct({ product_name: "Oats", nutriments: { "energy-kcal": 29, proteins_100g: 14, carbohydrates_100g: 56, fat_100g: 6.7 } })).toBeNull();
  });
  it("never mixes explicit 100 ml and 100 g nutrient values", () => {
    const food = mapOffProduct({ product_name: "Milch", quantity: "1 l", nutriments: {
      "energy-kcal_100ml": 48.41, proteins_100ml: 3.5, carbohydrates_100ml: 4.8, fat_100ml: 1.5,
      "energy-kcal_100g": 900, proteins_100g: 90, carbohydrates_100g: 80, fat_100g: 70,
    } });
    expect(food?.kcal_per_100g).toBe(48.41);
    expect(food?.protein_per_100g).toBe(3.5);
    expect(food?.unit).toBe("ml");
  });
  it("rejects conflicting 29 kcal with oat macros instead of fabricating a replacement", () => {
    expect(mapOffProduct({ product_name: "Oats", nutriments: { "energy-kcal_100g": 29, proteins_100g: 14, carbohydrates_100g: 56, fat_100g: 6.7 } })).toBeNull();
  });
});