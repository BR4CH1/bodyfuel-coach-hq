import { describe, expect, it } from "vitest";
import type { LibraryMeal } from "@/lib/plan-builder.functions";
import { isFoodQueryValid, matchesMealQuery, mealFromFood } from "../plan-builder.logic";

const food = {
  name: "Magerquark",
  brand: "Milbona",
  unit: "g" as const,
  density_g_per_ml: null,
  kcal_per_100g: 67,
  protein_per_100g: 12,
  carbs_per_100g: 4,
  fat_per_100g: 0.3,
};

describe("mealFromFood", () => {
  it("skaliert Makros auf die gewählte Menge", () => {
    const meal = mealFromFood(food, 250, "breakfast");
    expect(meal.slot).toBe("breakfast");
    expect(meal.library_meal_id).toBeNull();
    expect(meal.portion_factor).toBe(1);
    expect(meal.kcal).toBeCloseTo(167.5, 1);
    expect(meal.protein_g).toBe(30);
    expect(meal.carbs_g).toBe(10);
    expect(meal.fat_g).toBeCloseTo(0.8, 1);
    expect(meal.ingredients).toEqual([{ name: "Magerquark (Milbona)", grams: 250 }]);
  });

  it("nutzt Dichte für Flüssigkeiten in ml", () => {
    const meal = mealFromFood(
      { ...food, name: "Olivenöl", brand: null, unit: "ml", density_g_per_ml: 0.92 },
      50,
      "lunch",
    );
    expect(meal.ingredients[0]!.grams).toBe(46);
    expect(meal.name).toContain("50 ml");
  });

  it("liefert 0-Werte bei ungültiger Menge", () => {
    const meal = mealFromFood(food, -5, "snack");
    expect(meal.kcal).toBe(0);
    expect(meal.protein_g).toBe(0);
  });
});

describe("Suchlogik", () => {
  it("verlangt mindestens 2 Zeichen", () => {
    expect(isFoodQueryValid(" a ")).toBe(false);
    expect(isFoodQueryValid("qu")).toBe(true);
  });

  it("findet Gerichte über Zutaten und Tags", () => {
    const meal = {
      name: "Skyr Bowl",
      description: null,
      main_protein: null,
      main_carb: null,
      tags: ["high_protein"],
      ingredients: [{ name: "Haferflocken", amount_g: 60 }],
    } as unknown as LibraryMeal;
    expect(matchesMealQuery(meal, "hafer")).toBe(true);
    expect(matchesMealQuery(meal, "high_protein")).toBe(true);
    expect(matchesMealQuery(meal, "lachs")).toBe(false);
    expect(matchesMealQuery(meal, "")).toBe(true);
  });
});
