import { describe, it, expect } from "vitest";
import {
  normalizePartnerParse, separationIssues, toReviewItems, buildPersonPlan,
  suggestClient, pairSharedMeals, scaleMeal, syncSharedRecipe, portionRatio,
} from "../partner-plan-import.logic";

const raw = {
  title: "Kiefer Woche",
  confidence: "high",
  persons: [
    { name: "Lukas Kiefer", days: [{ name: "Tag 1", type: "training", meals: [
      { slot: "breakfast", name: "Porridge", ingredients: [{ name: "Haferflocken", grams: 100 }, { name: "Milch", amount: 300, unit: "ml" }] },
      { slot: "dinner", name: "Chili con Carne", shared: true, ingredients: [{ name: "Rinderhack", grams: 250 }] },
    ] }] },
    { name: "Nina Kiefer", days: [{ name: "Tag 1", type: "training", meals: [
      { slot: "breakfast", name: "Skyr Bowl", ingredients: [{ name: "Skyr", grams: 250 }] },
      { slot: "dinner", name: "Chili con Carne", shared: true, ingredients: [{ name: "Rinderhack", grams: "150" }] },
    ] }] },
  ],
};
const clients = [
  { id: "l", name: "Lukas Kiefer" }, { id: "n", name: "Nina Kiefer" }, { id: "x", name: "Lukas Maier" },
];

describe("partner plan import", () => {
  it("normalizes two persons and keeps per-person amounts", () => {
    const p = normalizePartnerParse(raw);
    expect(p.persons).toHaveLength(2);
    expect(p.persons[1].days[0].meals[1].ingredients[0].grams).toBe(150);
    expect(separationIssues(p)).toEqual([]);
  });
  it("flags unsure separation", () => {
    const p = normalizePartnerParse({ ...raw, confidence: "medium", persons: [raw.persons[0]] });
    const issues = separationIssues(p);
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
  it("suggests clients only on unique names", () => {
    expect(suggestClient("Lukas Kiefer", clients)).toBe("l");
    expect(suggestClient("Nina Kiefer", clients, "l")).toBe("n");
    expect(suggestClient("Lukas", clients)).toBeNull();
    expect(suggestClient("Person 1", clients)).toBeNull();
  });
  it("review reassignment moves meals between persons", () => {
    const items = toReviewItems(normalizePartnerParse(raw));
    const moved = items.map((i) => (i.id === "0-0-0" ? { ...i, person: 1 as const } : i));
    const a = buildPersonPlan(moved, 0);
    const b = buildPersonPlan(moved, 1);
    expect(a.days[0].meals.map((m) => m.name)).toEqual(["Chili con Carne"]);
    expect(b.days[0].meals).toHaveLength(3);
  });
  it("pairs shared meals by day+slot+name", () => {
    const items = toReviewItems(normalizePartnerParse(raw));
    expect(pairSharedMeals(buildPersonPlan(items, 0), buildPersonPlan(items, 1))).toEqual([[0, 1, 1]]);
  });
  it("scales and syncs while keeping individual amounts", () => {
    const m = scaleMeal({ slot: "lunch", name: "x", ingredients: [{ name: "Reis", grams: 100 }] }, 0.8);
    expect(m.ingredients[0].grams).toBe(80);
    const src = [{ name: "Rinderhack", grams: 250 }, { name: "Bohnen", grams: 100 }];
    const dst = [{ name: "Rinderhack", grams: 150 }];
    const r = portionRatio(src, dst);
    expect(r).toBeCloseTo(0.6);
    const next = syncSharedRecipe(src, dst, r);
    expect(next).toEqual([
      { name: "Rinderhack", grams: 150, amount: null, unit: null },
      { name: "Bohnen", grams: 60, amount: undefined },
    ]);
  });
});
