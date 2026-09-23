import { describe, expect, it } from "vitest";
import {
  buildForbiddenTerms,
  planConfigFromProfile,
  type PlanConstraintConfig,
} from "@/lib/nutrition-plan-constraints";

const BASE: PlanConstraintConfig = {
  goal: "halten",
  dietRules: [],
  exclusionGroups: [],
  customExclusions: [],
  preferences: [],
  lifestyle: [],
  mealsPerDay: 3,
  planDays: 7,
  partner: false,
  variation: "mittel",
};

describe("planConfigFromProfile", () => {
  it("stellt gespeicherte No-Gos, Vorlieben und Regeln wieder her", () => {
    const stored = buildForbiddenTerms({
      dietRules: ["glutenfrei"],
      exclusionGroups: ["fisch", "nuesse"],
      customExclusions: ["rosenkohl"],
    });
    const config = planConfigFromProfile(
      {
        nogo_foods: stored,
        extra_nogos: "rosenkohl",
        favorite_foods: ["Lachs-Bowl", "Skyr"],
        diet_notes: "Ziel: abnehmen | Regeln: glutenfrei | Alltag: meal_prep | Mahlzeiten/Tag: 4",
      },
      BASE,
    );

    expect(config.goal).toBe("abnehmen");
    expect(config.dietRules).toEqual(["glutenfrei"]);
    expect(config.exclusionGroups).toEqual(expect.arrayContaining(["fisch", "nuesse"]));
    expect(config.customExclusions).toEqual(["rosenkohl"]);
    expect(config.preferences).toEqual(["Lachs-Bowl", "Skyr"]);
    expect(config.lifestyle).toEqual(["meal_prep"]);
    expect(config.mealsPerDay).toBe(4);
  });

  it("ein hydrierter Round-Trip verliert keine harten Begriffe", () => {
    const stored = buildForbiddenTerms({
      dietRules: [],
      exclusionGroups: ["fisch", "nuesse"],
      customExclusions: [],
    });
    const config = planConfigFromProfile(
      { nogo_foods: stored, diet_notes: "Ziel: halten | Mahlzeiten/Tag: 3" },
      BASE,
    );
    const again = buildForbiddenTerms(config);
    for (const term of stored) expect(again).toContain(term);
  });

  it("leeres Profil ändert die Basis nicht", () => {
    expect(planConfigFromProfile(null, BASE)).toEqual(BASE);
    expect(planConfigFromProfile({}, BASE)).toEqual(BASE);
  });
});
