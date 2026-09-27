import { describe, expect, it } from "vitest";
import {
  applyAmountChange,
  classifyConfidence,
  isBlocking,
  itemKey,
  macrosFor,
  parseLocalCorrection,
  qualifierFactor,
  resolveAmount,
  resolveEntryDate,
  sumMacros,
  textHash,
  toCommitItem,
  type FoodRef,
  type ReviewItem,
} from "../quick-food-log.logic";

const pb: FoodRef = {
  food_id: "pb", name: "Erdnussbutter", brand: null, unit: "g",
  kcal_per_100g: 600, protein_per_100g: 25, carbs_per_100g: 12, fat_per_100g: 50,
  serving_g: null, source: "bls_4_0", verified: false,
};
const oj: FoodRef = { ...pb, food_id: "oj", name: "Orangensaft", unit: "ml", kcal_per_100g: 45, protein_per_100g: 0.7, carbs_per_100g: 9, fat_per_100g: 0.2 };
const rw: FoodRef = { ...pb, food_id: "rw", name: "Reiswaffel", kcal_per_100g: 380 };

const base = { vague_qualifier: null, is_liquid: false };

function item(key: string, food: FoodRef, amount: number, extra: Partial<ReviewItem> = {}): ReviewItem {
  return {
    key, phrase: food.name, label: food.name, meal: "snack", entry_date: "2026-09-27",
    amount, unit: food.unit, amount_note: null, amount_estimated: false, food,
    match_score: 100, estimate_level: "matched", confidence: "high", warnings: [], confirmed: false, ...extra,
  };
}

describe("Mengen", () => {
  it("übernimmt exakte Gramm/ml", () => {
    expect(resolveAmount({ ...base, quantity: 100, unit: "g", food_name_de: "Erdnussbutter" }, pb)).toMatchObject({ amount: 100, unit: "g", estimated: false });
    expect(resolveAmount({ ...base, quantity: 700, unit: "ml", food_name_de: "Orangensaft", is_liquid: true }, oj)).toMatchObject({ amount: 700, unit: "ml" });
  });
  it("rechnet Stück über Stückgewichte", () => {
    const r = resolveAmount({ ...base, quantity: 5, unit: "stueck", food_name_de: "Reiswaffel" }, rw);
    expect(r.amount).toBe(40);
    expect(r.note).toBe("5 Stück");
    expect(r.estimated).toBe(false);
  });
  it("kennzeichnet ungenaue Mengen als geschätzt", () => {
    expect(resolveAmount({ ...base, quantity: 1, unit: "handvoll", food_name_de: "Nüsse" }, pb)).toMatchObject({ amount: 30, estimated: true });
    expect(resolveAmount({ ...base, quantity: null, unit: null, food_name_de: "Nudeln" }, pb).estimated).toBe(true);
    const ord = resolveAmount({ ...base, quantity: 1, unit: "teller", vague_qualifier: "ordentlich", food_name_de: "Nudeln" }, pb);
    expect(ord.amount).toBe(455);
    expect(ord.estimated).toBe(true);
  });
  it("Flüssigkeiten bleiben ml, l wird umgerechnet", () => {
    expect(resolveAmount({ ...base, quantity: 0.5, unit: "l", food_name_de: "Saft", is_liquid: true }, oj)).toMatchObject({ amount: 500, unit: "ml" });
    expect(resolveAmount({ ...base, quantity: 1, unit: "flasche", food_name_de: "Bier", is_liquid: true }, null)).toMatchObject({ amount: 500, unit: "ml", estimated: true });
  });
  it("Qualifier-Faktoren", () => {
    expect(qualifierFactor("ein bisschen")).toBe(0.5);
    expect(qualifierFactor(null)).toBe(1);
  });
});

describe("Datum", () => {
  it("heute/gestern/vorgestern", () => {
    expect(resolveEntryDate(null, "2026-09-27", "2026-09-27").date).toBe("2026-09-27");
    expect(resolveEntryDate("yesterday", "2026-09-27", "2026-09-27").date).toBe("2026-09-26");
    expect(resolveEntryDate("day_before_yesterday", "2026-09-27", "2026-09-27").date).toBe("2026-09-25");
  });
  it("blockiert Zukunft und > 7 Tage zurück", () => {
    expect(resolveEntryDate("2026-10-01", "2026-09-27", "2026-09-27")).toEqual({ date: "2026-09-27", adjusted: true });
    expect(resolveEntryDate("2026-09-01", "2026-09-27", "2026-09-27")).toEqual({ date: "2026-09-20", adjusted: true });
  });
  it("Basistag des Trackers wird für heute genutzt", () => {
    expect(resolveEntryDate("today", "2026-09-25", "2026-09-27").date).toBe("2026-09-25");
  });
});

describe("Konfidenz", () => {
  it("kein Treffer = unsicher und blockierend", () => {
    const c = classifyConfidence({ food: null, matchScore: 0, brandRequested: false, brandMatched: false, amountEstimated: false, amount: 100 });
    expect(c.confidence).toBe("low");
    expect(isBlocking(item("a", pb, 100, { confidence: "low" }))).toBe(true);
    expect(isBlocking(item("a", pb, 100, { confidence: "low", confirmed: true }))).toBe(false);
  });
  it("KI-Schätzung ist nie hoch", () => {
    const c = classifyConfidence({ food: { ...pb, source: "ai_estimate" }, matchScore: 120, brandRequested: false, brandMatched: false, amountEstimated: false, amount: 100 });
    expect(c.confidence).toBe("low");
    expect(c.level).toBe("estimated");
  });
  it("Marke nicht gefunden = mittel mit Hinweis", () => {
    const c = classifyConfidence({ food: pb, matchScore: 120, brandRequested: true, brandMatched: false, amountEstimated: false, amount: 100 });
    expect(c.confidence).toBe("medium");
    expect(c.warnings.join()).toMatch(/Marke/);
  });
  it("guter Katalogtreffer = hoch", () => {
    expect(classifyConfidence({ food: pb, matchScore: 120, brandRequested: false, brandMatched: false, amountEstimated: false, amount: 100 }).confidence).toBe("high");
  });
  it("unrealistische Mengen sind unsicher", () => {
    expect(classifyConfidence({ food: pb, matchScore: 120, brandRequested: false, brandMatched: false, amountEstimated: false, amount: 5000 }).confidence).toBe("low");
  });
});

describe("Makros & Korrektur", () => {
  it("rechnet proportional aus pro-100-Werten", () => {
    expect(macrosFor(pb, 70).kcal).toBeCloseTo(420);
    const t = sumMacros([item("a", pb, 100), item("b", oj, 700)]);
    expect(Math.round(t.kcal)).toBe(915);
  });
  it("lokale Korrektur 'Erdnussbutter waren eher 70 g' ohne KI", () => {
    const items = [item("0:rw", rw, 40), item("1:pb", pb, 100), item("2:oj", oj, 700)];
    expect(parseLocalCorrection("Die Erdnussbutter waren eher 70 g", items)).toEqual([{ key: "1:pb", amount: 70, unit: "g" }]);
    expect(parseLocalCorrection("Saft waren 0,5 l", items)).toEqual([{ key: "2:oj", amount: 500, unit: "ml" }]);
    expect(parseLocalCorrection("das war eher weniger", items)).toBeNull();
  });
  it("Mengenänderung aktualisiert nur die Position", () => {
    const next = applyAmountChange(item("1", pb, 100, { amount_estimated: true }), 70);
    expect(next.amount).toBe(70);
    expect(next.amount_estimated).toBe(false);
  });
});

describe("Duplikatschutz", () => {
  it("Positionsschlüssel sind stabil", () => {
    expect(itemKey(1, "100 g Erdnussbutter")).toBe(itemKey(1, "100 g Erdnussbutter"));
    expect(itemKey(1, "x")).not.toBe(itemKey(2, "x"));
  });
  it("Text-Hash ignoriert Groß-/Leerzeichen", () => {
    expect(textHash("Hallo  Welt")).toBe(textHash("hallo welt "));
    expect(textHash("a")).not.toBe(textHash("b"));
  });
  it("Commit-Payload ist deterministisch", () => {
    const it1 = item("1:pb", pb, 70);
    expect(toCommitItem(it1)).toEqual(toCommitItem({ ...it1 }));
    expect(toCommitItem(it1)).toMatchObject({ key: "1:pb", kcal: 420, protein_g: 17.5, food_id: "pb" });
  });
});
