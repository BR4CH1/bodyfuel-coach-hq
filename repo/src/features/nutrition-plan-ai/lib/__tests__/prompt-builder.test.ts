import { describe, expect, it } from "vitest";
import { buildNutritionPlanGenerationContext } from "@/features/nutrition-plan-ai/lib/prompt-builder";
import type {
  GenerateNutritionPlanOpts,
  NutritionPlanSourceData,
} from "@/features/nutrition-plan-ai/types";

const BASE_OPTS: GenerateNutritionPlanOpts = {
  target: "user-1",
  title: "Testplan",
  apiKey: "test-key",
};

function createSource(overrides: Partial<NutritionPlanSourceData> = {}): NutritionPlanSourceData {
  return {
    profile: {},
    clientProfile: {},
    weightSeries: [],
    targets: {
      kcal: 2500,
      protein_g: 180,
      carbs_g: 300,
      fat_g: 65,
      kcal_rest: 2200,
      protein_g_rest: 180,
      carbs_g_rest: 220,
      fat_g_rest: 70,
    },
    ratings: [],
    favorites: [],
    skips: [],
    swaps: [],
    wishes: [],
    safeFoods: [],
    ...overrides,
  };
}

describe("nutrition plan prompt builder", () => {
  it("clamps explicit plan duration and creates AI templates per day type", () => {
    const context = buildNutritionPlanGenerationContext({
      source: createSource({
        profile: { training_weekdays: ["monday", "friday"] },
      }),
      opts: { ...BASE_OPTS, plan_days: 99, scheduled_start_date: "2026-07-20" },
      now: new Date("2026-07-19T12:00:00.000Z"),
    });

    expect(context.planDays).toBe(31);
    expect(context.schedule).toHaveLength(31);
    expect(context.aiSchedule.map((day) => day.type)).toEqual(["training", "rest"]);
    expect(context.prompt).toContain("exakt mit 2 Basistagen");
  });

  it("detects a no-cook kitchen and places the hard restriction in the prompt", () => {
    const context = buildNutritionPlanGenerationContext({
      source: createSource({
        profile: {
          kitchen_equipment: ["Kühlschrank"],
          kitchen_equipment_notes: "Keine Küche, alles muss kalt sein",
        },
      }),
      opts: BASE_OPTS,
      now: new Date("2026-07-19T12:00:00.000Z"),
    });

    expect(context.isNoCook).toBe(true);
    expect(context.prompt).toContain("ABSOLUTE NO-COOK-REGEL");
    expect(context.prompt).toContain("Keine Küche, alles muss kalt sein");
  });

  it("expands exclusions and embeds only safe food ids", () => {
    const context = buildNutritionPlanGenerationContext({
      source: createSource({
        profile: { allergies: ["Fisch"], nogo_foods: ["Nüsse"] },
        safeFoods: [
          { text_id: "haferflocken", name: "Haferflocken", aliases: ["Oats"] },
          { text_id: "skyr_natur", name: "Skyr natur", aliases: [] },
        ],
      }),
      opts: BASE_OPTS,
      now: new Date("2026-07-19T12:00:00.000Z"),
    });

    expect(context.forbidden).toContain("lachs");
    expect(context.prompt).toContain("haferflocken | Haferflocken (aka Oats)");
    expect(context.prompt).toContain("skyr_natur | Skyr natur");
  });

  it("includes approved wishes and a deterministic plateau note", () => {
    const context = buildNutritionPlanGenerationContext({
      source: createSource({
        weightSeries: [
          { weight_kg: 80.1, measured_at: "2026-07-19T08:00:00.000Z" },
          { weight_kg: 80, measured_at: "2026-07-05T08:00:00.000Z" },
        ],
        wishes: [{ id: "wish-1", wish: "Lasagne", applies_to: "dinner" }],
      }),
      opts: BASE_OPTS,
      now: new Date("2026-07-19T12:00:00.000Z"),
    });

    expect(context.prompt).toContain("GEWICHTSPLATEAU erkannt");
    expect(context.prompt).toContain("1. Lasagne");
    expect(context.wishesData).toEqual([{ id: "wish-1", wish: "Lasagne", applies_to: "dinner" }]);
  });
});
