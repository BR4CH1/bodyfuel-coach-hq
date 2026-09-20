import { describe, expect, it } from "vitest";
import { validateGeneratedPlan, varietyTargetFor } from "@/lib/nutrition-plan-constraints";

const target = { kcal: 1800, protein_g: 120, carbs_g: 180, fat_g: 60 };

const meal = (name: string, ingredient: string) => ({
  name,
  slot: "lunch",
  ingredients: [{ name: ingredient, amount: 100, unit: "g" }],
  kcal: 600,
  protein_g: 40,
  carbs_g: 60,
  fat_g: 20,
});

const day = (suffix: string) => ({
  name: suffix,
  meals: [
    meal(`Frühstück ${suffix}`, "Haferflocken"),
    meal(`Mittag ${suffix}`, "Reis"),
    meal(`Abend ${suffix}`, "Kartoffel"),
  ],
});

const baseConfig = {
  dietRules: [] as never[],
  exclusionGroups: [] as never[],
  customExclusions: [] as string[],
  mealsPerDay: 3,
  planDays: 2,
};

describe("erweiterte Plan-Validierung", () => {
  it("liefert Ist/Soll-Kennzahlen", () => {
    const report = validateGeneratedPlan({
      days: [day("Mo"), day("Di")],
      forbidden: [],
      config: baseConfig,
      targets: [target, target],
    });
    expect(report.ok).toBe(true);
    expect(report.metrics.kcalActual).toBe(1800);
    expect(report.metrics.proteinTarget).toBe(120);
    expect(report.metrics.carbsActual).toBe(180);
    expect(report.metrics.fatActual).toBe(60);
    expect(report.metrics.nogoViolations).toBe(0);
    expect(report.metrics.allergyViolations).toBe(0);
  });

  it("blockiert Allergene separat", () => {
    const bad = day("Mo");
    bad.meals[1] = meal("Nussmüsli", "Mandelmus");
    const report = validateGeneratedPlan({
      days: [bad, day("Di")],
      forbidden: [],
      config: baseConfig,
      targets: [target, target],
      allergyTerms: ["mandel"],
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((c) => c.id === "allergies")?.ok).toBe(false);
    expect(report.metrics.allergyViolations).toBeGreaterThan(0);
  });

  it("erkennt unvollständige Mahlzeiten", () => {
    const bad = day("Mo");
    bad.meals[0] = { ...meal("", "Reis"), kcal: 0 };
    const report = validateGeneratedPlan({
      days: [bad, day("Di")],
      forbidden: [],
      config: baseConfig,
      targets: [target, target],
    });
    expect(report.checks.find((c) => c.id === "completeness")?.ok).toBe(false);
  });

  it("setzt Abwechslungsziel je Variationsgrad", () => {
    expect(varietyTargetFor("niedrig")).toBeLessThan(varietyTargetFor("mittel"));
    expect(varietyTargetFor("hoch")).toBeGreaterThan(varietyTargetFor("mittel"));
  });
});
