import { describe, expect, it } from "vitest";
import {
  buildForbiddenTerms,
  computeVarietyRatio,
  describeConstraintFailure,
  findMealViolations,
  mealIsAllowed,
  rankMealsByPreference,
  summarizeActiveRules,
  validateGeneratedPlan,
  type MealLike,
} from "@/lib/nutrition-plan-constraints";

const meal = (
  name: string,
  ingredients: { name: string; tags?: string[]; category?: string }[],
  macros = { kcal: 600, protein_g: 40, carbs_g: 60, fat_g: 18 },
): MealLike => ({
  name,
  slot: "lunch",
  ingredients: ingredients.map((i) => ({ ...i, amount: 100, unit: "g" })),
  ...macros,
});

describe("harte Constraints", () => {
  it("expandiert Ernährungsregeln zu Ausschluss-Begriffen", () => {
    const vegan = buildForbiddenTerms({
      dietRules: ["vegan"],
      exclusionGroups: [],
      customExclusions: [],
    });
    expect(vegan).toContain("hähnchen");
    expect(vegan).toContain("ei");
    expect(vegan.some((t) => t.includes("milch"))).toBe(true);
  });

  it("findet No-Gos in Zutaten, nicht nur im Rezeptnamen", () => {
    const forbidden = buildForbiddenTerms({
      dietRules: [],
      exclusionGroups: ["schweinefleisch"],
      customExclusions: [],
    });
    const bad = meal("Bunte Pfanne", [{ name: "Schweinefilet" }, { name: "Reis" }]);
    expect(mealIsAllowed(bad, forbidden)).toBe(false);
    expect(findMealViolations(bad, forbidden)[0]?.ingredient.toLowerCase()).toContain("schwein");
  });

  it("erkennt No-Gos über Tags und Kategorien", () => {
    const forbidden = buildForbiddenTerms({
      dietRules: [],
      exclusionGroups: ["nuesse"],
      customExclusions: [],
    });
    const bad = meal("Müsli", [{ name: "Riegel", tags: ["mandel"] }]);
    expect(mealIsAllowed(bad, forbidden)).toBe(false);
  });

  it("respektiert individuelle Ausschlüsse", () => {
    const forbidden = buildForbiddenTerms({
      dietRules: [],
      exclusionGroups: [],
      customExclusions: ["Paprika"],
    });
    expect(mealIsAllowed(meal("Salat", [{ name: "Paprika rot" }]), forbidden)).toBe(false);
    expect(mealIsAllowed(meal("Salat", [{ name: "Gurke" }]), forbidden)).toBe(true);
  });
});

describe("weiche Vorlieben", () => {
  it("rankt Vorlieben nach oben, schließt aber nichts aus", () => {
    const meals = [meal("Reispfanne", [{ name: "Reis" }]), meal("Lachsbowl", [{ name: "Lachs" }])];
    const ranked = rankMealsByPreference(meals, ["Lachs"]);
    expect(ranked[0].name).toBe("Lachsbowl");
    expect(ranked).toHaveLength(2);
  });

  it("ohne Vorlieben bleibt die Auswahl vollständig", () => {
    const meals = [meal("A", [{ name: "Reis" }]), meal("B", [{ name: "Quinoa" }])];
    expect(rankMealsByPreference(meals, [])).toHaveLength(2);
  });
});

describe("Abwechslung", () => {
  it("bewertet Wiederholungen niedriger", () => {
    const repeated = [
      { meals: [meal("Gleiches", [{ name: "Reis" }])] },
      { meals: [meal("Gleiches", [{ name: "Reis" }])] },
    ];
    const varied = [
      { meals: [meal("Eins", [{ name: "Reis" }])] },
      { meals: [meal("Zwei", [{ name: "Quinoa" }])] },
    ];
    expect(computeVarietyRatio(repeated)).toBeLessThan(computeVarietyRatio(varied));
  });
});

describe("Plan-Validierung", () => {
  const target = { kcal: 1800, protein_g: 120, carbs_g: 180, fat_g: 60 };
  const day = (name: string) => ({
    name,
    meals: [
      meal("Frühstück " + name, [{ name: "Haferflocken" }], {
        kcal: 600,
        protein_g: 40,
        carbs_g: 60,
        fat_g: 20,
      }),
      meal("Mittag " + name, [{ name: "Reis" }], {
        kcal: 600,
        protein_g: 40,
        carbs_g: 60,
        fat_g: 20,
      }),
      meal("Abend " + name, [{ name: "Kartoffel" }], {
        kcal: 600,
        protein_g: 40,
        carbs_g: 60,
        fat_g: 20,
      }),
    ],
  });

  it("besteht bei sauberem Plan", () => {
    const report = validateGeneratedPlan({
      days: [day("Mo"), day("Di")],
      forbidden: ["schwein"],
      config: {
        dietRules: [],
        exclusionGroups: [],
        customExclusions: ["schwein"],
        mealsPerDay: 3,
        planDays: 2,
      },
      targets: [target, target],
    });
    expect(report.ok).toBe(true);
    expect(report.blockingReasons).toHaveLength(0);
  });

  it("scheitert bei No-Go-Verletzung und nennt die Ursache", () => {
    const bad = day("Mo");
    bad.meals[0] = meal("Schnitzel", [{ name: "Schweineschnitzel" }], {
      kcal: 600,
      protein_g: 40,
      carbs_g: 60,
      fat_g: 20,
    });
    const report = validateGeneratedPlan({
      days: [bad, day("Di")],
      forbidden: ["schwein"],
      config: {
        dietRules: [],
        exclusionGroups: ["schweinefleisch"],
        customExclusions: [],
        mealsPerDay: 3,
        planDays: 2,
      },
      targets: [target, target],
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((c) => c.id === "nogos")?.ok).toBe(false);
    expect(describeConstraintFailure(report).toLowerCase()).toContain("schwein");
  });

  it("prüft Zeitraum und Mahlzeitenanzahl", () => {
    const report = validateGeneratedPlan({
      days: [day("Mo")],
      forbidden: [],
      config: {
        dietRules: [],
        exclusionGroups: [],
        customExclusions: [],
        mealsPerDay: 4,
        planDays: 7,
      },
      targets: [target],
    });
    expect(report.checks.find((c) => c.id === "period")?.ok).toBe(false);
    expect(report.checks.find((c) => c.id === "meals")?.ok).toBe(false);
  });
});

describe("Regelzusammenfassung", () => {
  it("fasst aktive Regeln lesbar zusammen", () => {
    const parts = summarizeActiveRules({
      goal: "muskelaufbau",
      dietRules: ["vegetarisch"],
      exclusionGroups: ["nuesse"],
      customExclusions: ["Paprika"],
      preferences: ["Lachs"],
      lifestyle: ["meal_prep"],
      mealsPerDay: 4,
      planDays: 14,
      partner: true,
    });
    const text = parts.join(" | ");
    expect(text).toContain("vegetarisch");
    expect(text).toContain("Nüsse");
    expect(text).toContain("Partnerplan");
    expect(text).toContain("14 Tage");
  });
});
