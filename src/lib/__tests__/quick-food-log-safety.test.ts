import { describe, it, expect } from "vitest";
import { isBlocking } from "@/features/nutrition-tracker/lib/quick-food-log.logic";

const base: any = { key: "k", confidence: "high", confirmed: true, food: { source: "bls_4_0" } };
describe("Schnell-Eintrag Sicherheit", () => {
  it("blockiert Positionen ohne Lebensmittel", () => expect(isBlocking({ ...base, food: null })).toBe(true));
  it("blockiert KI-geschätzte Nährwerte auch nach Bestätigung", () =>
    expect(isBlocking({ ...base, food: { source: "ai_estimate" } })).toBe(true));
  it("lässt bestätigte Katalogtreffer zu", () => expect(isBlocking(base)).toBe(false));
});
