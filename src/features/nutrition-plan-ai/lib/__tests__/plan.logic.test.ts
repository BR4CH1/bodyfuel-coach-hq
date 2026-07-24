import { describe, expect, it } from "vitest";
import {
  buildAiSchedule,
  buildPlanSchedule,
  containsForbiddenFood,
  ensureRequiredMealSlots,
  expandFoodTerms,
  expandGeneratedDays,
  extractJsonObject,
  resolveGoalDirection,
  resolveNutritionTargets,
  splitOversizedMeals,
} from "@/features/nutrition-plan-ai/lib/plan.logic";
import type { ComputedGeneratedMeal, GeneratedMeal } from "@/features/nutrition-plan-ai/types";

describe("nutrition plan AI domain logic", () => {
  it("resolves explicit training goals before weight heuristics", () => {
    expect(
      resolveGoalDirection({
        trainingGoal: "muscle_gain",
        currentWeight: 100,
        goalWeight: 80,
      }),
    ).toBe("bulk");
    expect(resolveGoalDirection({ coachingGoal: "Ich möchte Fett verlieren" })).toBe("cut");
    expect(resolveGoalDirection({ currentWeight: 80, goalWeight: 80.4 })).toBe("maintain");
  });

  it("prefers stored macro targets and derives a lower-carb rest day", () => {
    const stored = resolveNutritionTargets({
      source: {
        kcal: 2500,
        protein_g: 180,
        carbs_g: 300,
        fat_g: 65,
        kcal_rest: 2200,
        protein_g_rest: 180,
        carbs_g_rest: 220,
        fat_g_rest: 70,
      },
      goalDirection: "maintain",
    });
    expect(stored.rest.kcal).toBe(2200);

    const derived = resolveNutritionTargets({
      source: { kcal: 2500, protein_g: 180, carbs_g: 300, fat_g: 65 },
      goalDirection: "maintain",
    });
    expect(derived.rest.kcal).toBeLessThan(derived.training.kcal);
    expect(derived.rest.carbs_g).toBeLessThan(derived.training.carbs_g);
    expect(derived.rest.protein_g).toBe(derived.training.protein_g);
  });

  it("caps stored and calculated protein at 2 g/kg and shifts the remainder to carbs", () => {
    const stored = resolveNutritionTargets({
      source: {
        kcal: 2600,
        protein_g: 230,
        carbs_g: 260,
        fat_g: 70,
        kcal_rest: 2300,
        protein_g_rest: 220,
        carbs_g_rest: 210,
        fat_g_rest: 75,
      },
      currentWeight: 100,
      goalDirection: "cut",
    });
    expect(stored.training).toMatchObject({ protein_g: 200, carbs_g: 290 });
    expect(stored.rest).toMatchObject({ protein_g: 200, carbs_g: 230 });

    const calculated = resolveNutritionTargets({
      currentWeight: 80,
      height: 180,
      ageYears: 30,
      gender: "male",
      activityLevel: "active",
      goalDirection: "cut",
    });
    expect(calculated.training.protein_g).toBe(160);
    expect(calculated.rest.protein_g).toBe(160);
  });

  it("builds weekday-aligned schedules and one AI template per day type", () => {
    const schedule = buildPlanSchedule({
      start: new Date("2026-07-20T12:00:00.000Z"),
      planDays: 7,
      trainingWeekdays: ["monday", "friday"],
    });
    expect(schedule[0]).toMatchObject({ wkKey: "monday", wkLabel: "Mo", type: "training" });
    expect(schedule[1].type).toBe("rest");
    expect(schedule[4].type).toBe("training");
    expect(buildAiSchedule(schedule).map((day) => day.type)).toEqual(["training", "rest"]);
  });

  it("expands category exclusions and matches whole food terms", () => {
    const expanded = expandFoodTerms(["Fisch"]);
    expect(expanded).toContain("lachs");
    expect(expanded).toContain("thunfisch");
    expect(containsForbiddenFood("Lachs mit Reis", expanded)).toBe(true);
    expect(containsForbiddenFood("Fischersalat", ["fisch"])).toBe(false);
  });

  it("extracts fenced JSON and removes trailing commas", () => {
    expect(extractJsonObject('Text ```json\n{"days":[],}\n``` Ende')).toBe('{"days":[]}');
    expect(extractJsonObject("   ")).toBeNull();
  });

  it("adds every required meal slot and respects no-cook fallbacks", () => {
    const existing: GeneratedMeal[] = [
      {
        slot: "breakfast",
        name: "Vorhandenes Frühstück",
        description: "80g Haferflocken",
        ingredients: [{ name: "Haferflocken", grams: 80 }],
        kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      },
    ];
    const meals = ensureRequiredMealSlots(
      existing,
      "rest",
      { kcal: 2000, protein_g: 150, carbs_g: 180, fat_g: 70 },
      ["fisch"],
      true,
    );
    expect(new Set(meals.map((meal) => meal.slot))).toEqual(
      new Set(["breakfast", "lunch", "dinner", "snack"]),
    );
    expect(meals.find((meal) => meal.slot === "lunch")?.description).not.toMatch(/gekocht/i);
  });

  it("splits oversized meals and proportionally clones ingredients", () => {
    const meal: ComputedGeneratedMeal = {
      slot: "dinner",
      name: "Große Bowl",
      description: "400g Reis",
      ingredients: [{ name: "Reis", amount: 400, grams: 400, unit: "g" }],
      kcal: 1200,
      protein_g: 60,
      carbs_g: 180,
      fat_g: 30,
    };
    const result = splitOversizedMeals([meal]);
    expect(result).toHaveLength(2);
    expect(result[0].kcal).toBe(600);
    expect(result[1].slot).toBe("snack");
    expect(result[0].ingredients?.[0].grams).toBe(200);
  });

  it("expands base days without sharing mutable ingredient arrays", () => {
    const expanded = expandGeneratedDays(
      [
        {
          name: "Training",
          type: "training",
          meals: [
            {
              slot: "breakfast",
              name: "Bowl",
              description: "80g Haferflocken",
              ingredients: [{ name: "Haferflocken", grams: 80 }],
              kcal: 400,
              protein_g: 20,
              carbs_g: 60,
              fat_g: 8,
            },
          ],
        },
      ],
      [
        { wkLabel: "Mo", type: "training" },
        { wkLabel: "Di", type: "training" },
      ],
      2,
    );
    expanded[0].meals[0].ingredients![0].grams = 20;
    expect(expanded[1].meals[0].ingredients![0].grams).toBe(80);
  });
});
