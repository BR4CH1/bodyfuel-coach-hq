import { describe, expect, it } from "vitest";

import type { CustomMeal } from "@/lib/custom-meals.functions";
import {
  customMealEntryName,
  parsePortionFactor,
  scaleCustomMeal,
} from "../custom-meal-portion.logic";

const meal: CustomMeal = {
  id: "m1",
  user_id: "u1",
  name: "Reis Bowl",
  meal_slot: "lunch",
  ingredients: [
    { name: "Reis", amount: 100, unit: "g", kcal: 350, protein_g: 7.2, carbs_g: 77.5, fat_g: 1.1 },
    { name: "Hähnchen", amount: 150, unit: "g", kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
  ],
  kcal: 515,
  protein_g: 38.2,
  carbs_g: 77.5,
  fat_g: 4.7,
  notes: null,
  image_url: null,
  image_status: null,
  image_path: null,
  image_source: null,
  image_error: null,
  image_generated_at: null,
  created_at: "",
  updated_at: "",
};

describe("scaleCustomMeal", () => {
  it("keeps macros at 1x", () => {
    const scaled = scaleCustomMeal(meal, 1);
    expect(scaled).toMatchObject({ kcal: 515, protein_g: 38.2, carbs_g: 77.5, fat_g: 4.7 });
    expect(scaled.serving_g).toBe(250);
  });

  it("halves macros and ingredients at 0.5x", () => {
    const scaled = scaleCustomMeal(meal, 0.5);
    expect(scaled).toMatchObject({ kcal: 258, protein_g: 19.1, carbs_g: 38.8, fat_g: 2.4 });
    expect(scaled.serving_g).toBe(125);
    expect(scaled.ingredients[0]).toMatchObject({ name: "Reis", amount: 50, kcal: 175 });
    expect(scaled.ingredients[1]).toMatchObject({ amount: 75, protein_g: 15.5 });
  });

  it("doubles macros at 2x", () => {
    const scaled = scaleCustomMeal(meal, 2);
    expect(scaled).toMatchObject({ kcal: 1030, protein_g: 76.4, carbs_g: 155, fat_g: 9.4 });
    expect(scaled.serving_g).toBe(500);
    expect(scaled.ingredients[1]).toMatchObject({ amount: 300, kcal: 330 });
  });

  it("does not mutate the stored recipe", () => {
    scaleCustomMeal(meal, 2);
    expect(meal.ingredients[0].amount).toBe(100);
    expect(meal.kcal).toBe(515);
  });

  it("falls back to meal totals when ingredients carry no macros", () => {
    const plain: CustomMeal = {
      ...meal,
      ingredients: [{ name: "Mix", amount: 200, unit: "g" }],
    };
    expect(scaleCustomMeal(plain, 1.5)).toMatchObject({
      kcal: 773,
      protein_g: 57.3,
      serving_g: 300,
    });
  });

  it("parses comma input and rejects invalid factors", () => {
    expect(parsePortionFactor("1,5")).toBe(1.5);
    expect(parsePortionFactor("abc")).toBe(0);
    expect(parsePortionFactor("-2")).toBe(0);
  });

  it("labels scaled entries", () => {
    expect(customMealEntryName(meal, 1)).toBe("Reis Bowl");
    expect(customMealEntryName(meal, 1.5)).toBe("Reis Bowl (1,5×)");
  });
});
