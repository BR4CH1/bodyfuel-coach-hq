import { describe, it, expect } from "vitest";
import { isBlocking } from "@/features/nutrition-tracker/lib/quick-food-log.logic";

const base: any = { key: "k", confidence: "high", confirmed: true, food: { source: "bls_4_0" } };
describe("Schnell-Eintrag Sicherheit", () => {
  it("blockiert Positionen ohne Lebensmittel", () => expect(isBlocking({ ...base, food: null })).toBe(true));
  it("blockiert KI-geschätzte Nährwerte auch nach Bestätigung", () =>
    expect(isBlocking({ ...base, food: { source: "ai_estimate" } })).toBe(true));
  it("lässt bestätigte Katalogtreffer zu", () => expect(isBlocking(base)).toBe(false));
});

import { resolveAmount } from "@/features/nutrition-tracker/lib/quick-food-log.logic";
describe("Schnell-Eintrag Einheiten", () => {
  const item: any = { quantity: 300, unit: "ml", vague_qualifier: null, is_liquid: true, food_name_de: "Orangensaft" };
  it("markiert 300 ml bei einem g-Lebensmittel als geschätzt", () => {
    const r = resolveAmount(item, { unit: "g", serving_g: null, name: "Orangensaft", brand: null });
    expect(r).toMatchObject({ amount: 300, unit: "g", estimated: true });
  });
  it("übernimmt 300 ml bei einem ml-Lebensmittel exakt", () => {
    const r = resolveAmount(item, { unit: "ml", serving_g: null, name: "Orangensaft", brand: null });
    expect(r).toMatchObject({ amount: 300, unit: "ml", estimated: false });
  });
});
