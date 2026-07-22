import { describe, expect, it } from "vitest";
import {
  calculateProteinTarget,
  capProteinAndShiftToCarbs,
  getProteinCap,
  proteinFactorForGoal,
} from "../nutrition-protein-policy";

describe("nutrition protein policy", () => {
  it("uses goal-specific factors from 1.6 to 2.0 g/kg", () => {
    expect(proteinFactorForGoal("performance")).toBe(1.6);
    expect(proteinFactorForGoal("lean_bulk")).toBe(1.8);
    expect(proteinFactorForGoal("fat_loss")).toBe(2);
    expect(calculateProteinTarget(100, "performance")).toBe(160);
    expect(calculateProteinTarget(100, "lean_bulk")).toBe(180);
    expect(calculateProteinTarget(100, "fat_loss")).toBe(200);
  });

  it("never returns a cap above 2 g/kg", () => {
    expect(getProteinCap(83.4)).toBe(166);
    expect(calculateProteinTarget(83.4, "aggressive_cut")).toBe(166);
  });

  it("moves capped protein calories to equal grams of carbohydrates", () => {
    expect(capProteinAndShiftToCarbs({ proteinG: 240, carbsG: 180, weightKg: 100 })).toEqual({
      proteinG: 200,
      carbsG: 220,
      capped: true,
      cap: 200,
    });
  });
});
