import { describe, expect, it } from "vitest";

import {
  computeTrackerTargetsFromPlan,
  isNutritionPlanActiveOnDate,
  resolveNutritionPlanDayType,
} from "@/lib/nutrition-tracker-targets.logic";

describe("nutrition tracker active plan targets", () => {
  it("uses persisted day_type before a generic day name", () => {
    expect(
      resolveNutritionPlanDayType({
        name: "Tag 2 · So 16.08",
        day_type: "rest",
      }),
    ).toBe("rest");
  });

  it("keeps legacy rest-day name matching as fallback", () => {
    expect(resolveNutritionPlanDayType({ name: "Ruhetag", day_type: null })).toBe("rest");
    expect(resolveNutritionPlanDayType({ name: "Tag 3", day_type: null })).toBe("training");
  });

  it("derives Stefan-like training/rest targets from the active plan instead of stale generic targets", () => {
    const days = [
      { id: "d1", name: "Tag 1 · Sa 15.08", day_type: "training" },
      { id: "d2", name: "Tag 2 · So 16.08", day_type: "rest" },
      { id: "d3", name: "Tag 3 · Mo 17.08", day_type: "training" },
      { id: "d4", name: "Tag 4 · Di 18.08", day_type: "training" },
      { id: "d5", name: "Tag 5 · Mi 19.08", day_type: "training" },
      { id: "d6", name: "Tag 6 · Do 20.08", day_type: "training" },
      { id: "d7", name: "Tag 7 · Fr 21.08", day_type: "training" },
    ];
    const totals = [
      ["d1", 1625, 156, 129, 49],
      ["d2", 1352, 147, 105, 34],
      ["d3", 1666, 167, 145, 41],
      ["d4", 1546, 154, 119, 49],
      ["d5", 1546, 154, 119, 49],
      ["d6", 1546, 154, 119, 49],
      ["d7", 1762, 105, 208, 52],
    ] as const;
    const meals = totals.map(([day_id, kcal, protein_g, carbs_g, fat_g]) => ({
      day_id,
      kcal,
      protein_g,
      carbs_g,
      fat_g,
    }));

    expect(computeTrackerTargetsFromPlan(days, meals)).toEqual({
      kcal: 1600,
      protein_g: 148,
      carbs_g: 140,
      fat_g: 48,
      kcal_rest: 1350,
      protein_g_rest: 147,
      carbs_g_rest: 105,
      fat_g_rest: 34,
    });
  });

  it("prefers explicit per-day targets when present", () => {
    expect(
      computeTrackerTargetsFromPlan(
        [
          {
            id: "rest",
            name: "Sonntag",
            day_type: "rest",
            target_kcal: 1450,
            target_protein_g: 150,
            target_carbs_g: 110,
            target_fat_g: 45,
          },
          {
            id: "training",
            name: "Montag",
            day_type: "training",
            target_kcal: 1650,
            target_protein_g: 150,
            target_carbs_g: 150,
            target_fat_g: 50,
          },
        ],
        [],
      ),
    ).toEqual({
      kcal: 1650,
      protein_g: 150,
      carbs_g: 150,
      fat_g: 50,
      kcal_rest: 1450,
      protein_g_rest: 150,
      carbs_g_rest: 110,
      fat_g_rest: 45,
    });
  });

  it("uses the active plan only inside its scheduled date window", () => {
    expect(isNutritionPlanActiveOnDate("2026-08-15", "2026-08-15", "2026-08-21")).toBe(true);
    expect(isNutritionPlanActiveOnDate("2026-08-21", "2026-08-15", "2026-08-21")).toBe(true);
    expect(isNutritionPlanActiveOnDate("2026-08-14", "2026-08-15", "2026-08-21")).toBe(false);
    expect(isNutritionPlanActiveOnDate("2026-08-22", "2026-08-15", "2026-08-21")).toBe(false);
  });
});
