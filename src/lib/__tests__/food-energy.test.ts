import { describe, expect, it } from "vitest";

import { checkFoodEnergy, withValidatedEnergy } from "../food-energy";

describe("Nährwertvalidierung (EU 1169/2011)", () => {
  it("akzeptiert plausible kcal-Werte", () => {
    const result = checkFoodEnergy({
      kcal_per_100g: 372,
      protein_per_100g: 13.5,
      carbs_per_100g: 58.7,
      fat_per_100g: 7,
    });
    expect(result.flagged).toBe(false);
    expect(result.kcal_per_100g).toBe(372);
  });

  it("markiert widersprüchliche 29 kcal, ohne aus möglicherweise falschen Makros neue kcal zu erfinden", () => {
    const result = checkFoodEnergy({
      kcal_per_100g: 29,
      protein_per_100g: 14,
      carbs_per_100g: 56,
      fat_per_100g: 6.7,
    });
    expect(result.flagged).toBe(true);
    // 4*14 + 4*56 + 9*6.7 = 340.3
    expect(result.kcal_per_100g).toBe(29);
    expect(result.corrected).toBe(false);
    expect(result.computed_kcal).toBe(340);
    expect(result.reason).toBeTruthy();
  });

  it("berücksichtigt Ballaststoffe und Alkohol", () => {
    const result = checkFoodEnergy({
      kcal_per_100g: 195,
      protein_per_100g: 10,
      carbs_per_100g: 20,
      fat_per_100g: 5,
      fiber_per_100g: 8,
      alcohol_per_100g: 2,
    });
    expect(result.flagged).toBe(false);
  });

  it("markiert 250 kcal ohne passende Makros als ungeklärt", () => {
    const result = checkFoodEnergy({
      kcal_per_100g: 250,
      protein_per_100g: 0,
      carbs_per_100g: 0,
      fat_per_100g: 0,
    });
    expect(result.flagged).toBe(true);
    expect(result.kcal_per_100g).toBe(250);
  });

  it("lässt kleine Rundungsabweichungen zu", () => {
    const result = checkFoodEnergy({
      kcal_per_100g: 139,
      protein_per_100g: 12.6,
      carbs_per_100g: 0.7,
      fat_per_100g: 9.5,
    });
    expect(result.flagged).toBe(false);
    expect(result.kcal_per_100g).toBe(139);
  });

  it("withValidatedEnergy behält alle übrigen Felder bei", () => {
    const food = withValidatedEnergy({
      name: "Kölln Blütenzarte Haferflocken",
      kcal_per_100g: 29,
      protein_per_100g: 14,
      carbs_per_100g: 56,
      fat_per_100g: 6.7,
    });
    expect(food.name).toBe("Kölln Blütenzarte Haferflocken");
    expect(food.energy_flagged).toBe(true);
    expect(food.kcal_per_100g).toBe(29);
  });

  it("bewahrt exakte Quellenwerte bis zur Anzeigerundung", () => {
    expect(checkFoodEnergy({ kcal_per_100g: 48.41, protein_per_100g: 3.5, carbs_per_100g: 4.8, fat_per_100g: 1.5 }).kcal_per_100g).toBe(48.41);
  });

  it("erfindet keine kcal bei fehlender Quellenenergie", () => {
    const result = checkFoodEnergy({ kcal_per_100g: null, protein_per_100g: 20, carbs_per_100g: 10, fat_per_100g: 5 });
    expect(result.kcal_per_100g).toBe(0);
    expect(result.flagged).toBe(true);
    expect(result.corrected).toBe(false);
  });
});
