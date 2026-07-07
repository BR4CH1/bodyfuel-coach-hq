import { describe, expect, it } from "vitest";
import {
  applySessionIntensity,
  calculateAgeFromBirthDate,
  calculateEer,
  calculatePerformanceNutritionTarget,
  getDayPalCategory,
  getFootballPositionCluster,
  PERFORMANCE_NUTRITION_ENGINE_VERSION,
} from "@/lib/performance-nutrition";
import type { AthleteProfileInput } from "@/lib/performance-nutrition/types";

/** Helper: build a base profile so tests only override what they care about. */
function profile(overrides: Partial<AthleteProfileInput> = {}): AthleteProfileInput {
  return {
    birthDate: "1998-01-01",
    sexForEnergyCalculation: "MALE",
    heightCm: 180,
    weightKg: 80,
    position: "WR",
    performanceGoal: "PERFORMANCE",
    baselineDailyActivity: "MIXED",
    ...overrides,
  };
}

const REF_2026 = new Date("2026-07-07T00:00:00Z");

describe("DRI 2023 EER — adult male, all PAL categories", () => {
  const base = { age: 30, sex: "MALE" as const, heightCm: 180, weightKg: 80 };
  it("INACTIVE", () => {
    // 753.07 -10.83*30 +6.5*180 +14.1*80 = 753.07 -324.9 +1170 +1128 = 2726.17
    expect(calculateEer({ ...base, palCategory: "INACTIVE" })!).toBeCloseTo(2726.17, 1);
  });
  it("LOW_ACTIVE", () => {
    // 581.47 -324.9 +8.3*180 +14.94*80 = 581.47 -324.9 +1494 +1195.2 = 2945.77
    expect(calculateEer({ ...base, palCategory: "LOW_ACTIVE" })!).toBeCloseTo(2945.77, 1);
  });
  it("ACTIVE", () => {
    // 1004.82 -324.9 +6.52*180 +15.91*80 = 1004.82 -324.9 +1173.6 +1272.8 = 3126.32
    expect(calculateEer({ ...base, palCategory: "ACTIVE" })!).toBeCloseTo(3126.32, 1);
  });
  it("VERY_ACTIVE", () => {
    // -517.88 -324.9 +15.61*180 +19.11*80 = -517.88 -324.9 +2809.8 +1528.8 = 3495.82
    expect(calculateEer({ ...base, palCategory: "VERY_ACTIVE" })!).toBeCloseTo(3495.82, 1);
  });
});

describe("DRI 2023 EER — adult female, all PAL categories", () => {
  it("Female age 22, 165cm, 63kg, LOW_ACTIVE ≈ 2275.37 kcal", () => {
    // 575.77 -7.01*22 +6.60*165 +12.14*63 = 575.77 -154.22 +1089 +764.82 = 2275.37
    const kcal = calculateEer({
      age: 22,
      sex: "FEMALE",
      heightCm: 165,
      weightKg: 63,
      palCategory: "LOW_ACTIVE",
    });
    expect(kcal!).toBeCloseTo(2275.37, 1);
  });
  it("Female INACTIVE / ACTIVE / VERY_ACTIVE sanity", () => {
    const args = { age: 30, sex: "FEMALE" as const, heightCm: 165, weightKg: 60 };
    expect(calculateEer({ ...args, palCategory: "INACTIVE" })!).toBeGreaterThan(1500);
    expect(calculateEer({ ...args, palCategory: "ACTIVE" })!).toBeGreaterThan(
      calculateEer({ ...args, palCategory: "INACTIVE" })!,
    );
    expect(calculateEer({ ...args, palCategory: "VERY_ACTIVE" })!).toBeGreaterThan(
      calculateEer({ ...args, palCategory: "ACTIVE" })!,
    );
  });
});

describe("DRI 2023 EER — youth includes growth energy cost", () => {
  it("Boy age 10, 145cm, 40kg, ACTIVE ≈ 2327.71 kcal (incl. +25 growth)", () => {
    // TEE: -388.19 + 3.68*10 + 12.66*145 + 20.46*40
    //    = -388.19 + 36.8 + 1835.7 + 818.4 = 2302.71
    // + 25 growth = 2327.71
    const kcal = calculateEer({
      age: 10,
      sex: "MALE",
      heightCm: 145,
      weightKg: 40,
      palCategory: "ACTIVE",
    });
    expect(kcal!).toBeCloseTo(2327.71, 1);
  });
  it("Girl age 10, 145cm, 40kg, ACTIVE ≈ 2053.85 kcal (incl. +30 growth)", () => {
    // TEE: -189.55 -22.25*10 + 11.74*145 + 18.34*40
    //    = -189.55 -222.5 + 1702.3 + 733.6 = 2023.85
    // + 30 growth = 2053.85
    const kcal = calculateEer({
      age: 10,
      sex: "FEMALE",
      heightCm: 145,
      weightKg: 40,
      palCategory: "ACTIVE",
    });
    expect(kcal!).toBeCloseTo(2053.85, 1);
  });
});

describe("Position clusters", () => {
  it("maps WR/DB/CB/S/RB → SPEED_SKILL", () => {
    for (const p of ["WR", "DB", "CB", "S", "RB"]) {
      expect(getFootballPositionCluster(p)).toBe("SPEED_SKILL");
    }
  });
  it("maps QB/TE/LB → HYBRID", () => {
    expect(getFootballPositionCluster("QB")).toBe("HYBRID");
    expect(getFootballPositionCluster("TE")).toBe("HYBRID");
    expect(getFootballPositionCluster("LB")).toBe("HYBRID");
    expect(getFootballPositionCluster("lb")).toBe("HYBRID"); // case-insensitive
  });
  it("maps OL/DL → POWER_CONTACT", () => {
    expect(getFootballPositionCluster("OL")).toBe("POWER_CONTACT");
    expect(getFootballPositionCluster("DL")).toBe("POWER_CONTACT");
    expect(getFootballPositionCluster("ot")).toBe("POWER_CONTACT");
  });
  it("maps K/P/LS → SPECIALIST", () => {
    expect(getFootballPositionCluster("K")).toBe("SPECIALIST");
    expect(getFootballPositionCluster("P")).toBe("SPECIALIST");
    expect(getFootballPositionCluster("LS")).toBe("SPECIALIST");
  });
});

describe("Day PAL resolution", () => {
  const baseline = "MIXED"; // → LOW_ACTIVE baseline
  it("WR moderate football → VERY_ACTIVE", () => {
    expect(
      getDayPalCategory({
        dayType: "FOOTBALL_TRAINING",
        baseline,
        positionCluster: "SPEED_SKILL",
        sessionIntensity: "MODERATE",
      }),
    ).toBe("VERY_ACTIVE");
  });
  it("WR light football → ACTIVE", () => {
    expect(
      getDayPalCategory({
        dayType: "FOOTBALL_TRAINING",
        baseline,
        positionCluster: "SPEED_SKILL",
        sessionIntensity: "LIGHT",
      }),
    ).toBe("ACTIVE");
  });
  it("OL moderate football → ACTIVE", () => {
    expect(
      getDayPalCategory({
        dayType: "FOOTBALL_TRAINING",
        baseline,
        positionCluster: "POWER_CONTACT",
        sessionIntensity: "MODERATE",
      }),
    ).toBe("ACTIVE");
  });
  it("OL hard football → VERY_ACTIVE", () => {
    expect(
      getDayPalCategory({
        dayType: "FOOTBALL_TRAINING",
        baseline,
        positionCluster: "POWER_CONTACT",
        sessionIntensity: "HARD",
      }),
    ).toBe("VERY_ACTIVE");
  });
  it("GAME_DAY → VERY_ACTIVE", () => {
    expect(
      getDayPalCategory({
        dayType: "GAME_DAY",
        baseline,
        positionCluster: null,
        sessionIntensity: null,
      }),
    ).toBe("VERY_ACTIVE");
  });
  it("DOUBLE_SESSION → VERY_ACTIVE", () => {
    expect(
      getDayPalCategory({
        dayType: "DOUBLE_SESSION",
        baseline,
        positionCluster: null,
        sessionIntensity: null,
      }),
    ).toBe("VERY_ACTIVE");
  });
  it("Football training never drops below LOW_ACTIVE (LIGHT specialist)", () => {
    expect(
      getDayPalCategory({
        dayType: "FOOTBALL_TRAINING",
        baseline: "MOSTLY_SEATED",
        positionCluster: "SPECIALIST",
        sessionIntensity: "LIGHT",
      }),
    ).toBe("LOW_ACTIVE");
  });
});

describe("applySessionIntensity clamping", () => {
  it("clamps upward at VERY_ACTIVE", () => {
    expect(applySessionIntensity("VERY_ACTIVE", "HARD")).toBe("VERY_ACTIVE");
  });
  it("does not drop below LOW_ACTIVE for football (INACTIVE → LOW_ACTIVE)", () => {
    // helper alone clamps only within [LOW_ACTIVE, VERY_ACTIVE]
    expect(applySessionIntensity("LOW_ACTIVE", "LIGHT")).toBe("LOW_ACTIVE");
  });
});

describe("Goal modifiers", () => {
  const base = profile({ birthDate: "1990-01-01" }); // adult
  it("Adult STRENGTH_GAIN = 1.05", () => {
    const r = calculatePerformanceNutritionTarget(
      { ...base, performanceGoal: "STRENGTH_GAIN" },
      { dayType: "REST", referenceDate: REF_2026 },
    );
    expect(r.goalModifier).toBe(1.05);
  });
  it("Adult MUSCLE_GAIN = 1.08", () => {
    const r = calculatePerformanceNutritionTarget(
      { ...base, performanceGoal: "MUSCLE_GAIN" },
      { dayType: "REST", referenceDate: REF_2026 },
    );
    expect(r.goalModifier).toBe(1.08);
  });
  it("Adult FAT_LOSS = 0.90", () => {
    const r = calculatePerformanceNutritionTarget(
      { ...base, performanceGoal: "FAT_LOSS" },
      { dayType: "REST", referenceDate: REF_2026 },
    );
    expect(r.goalModifier).toBe(0.9);
  });
});

describe("Youth safety rules", () => {
  const youth = profile({
    birthDate: "2012-01-01", // ~14 y/o at REF_2026
    performanceGoal: "FAT_LOSS",
    heightCm: 160,
    weightKg: 55,
    position: "WR",
  });
  it("Youth FAT_LOSS → no calorie deficit + coach review flag", () => {
    const r = calculatePerformanceNutritionTarget(youth, {
      dayType: "REST",
      referenceDate: REF_2026,
    });
    expect(r.status).toBe("CALCULATED");
    expect(r.isYouth).toBe(true);
    expect(r.effectiveGoal).toBe("BODY_COMPOSITION_REVIEW");
    expect(r.goalModifier).toBe(1.0);
    expect(r.coachReviewRequired).toBe(true);
    expect(r.flags).toContain("YOUTH_BODY_COMPOSITION_REVIEW");
  });
  it("Youth never applies personal calibration", () => {
    const r = calculatePerformanceNutritionTarget(
      { ...youth, performanceGoal: "PERFORMANCE" },
      { dayType: "REST", referenceDate: REF_2026 },
      { personalCalibrationKcal: 300 },
    );
    expect(r.personalCalibrationKcal).toBe(0);
  });
});

describe("Adult calibration additive", () => {
  it("adult applies personal calibration to goal-adjusted energy", () => {
    const p = profile({ birthDate: "1990-01-01" });
    const r = calculatePerformanceNutritionTarget(
      p,
      { dayType: "REST", referenceDate: REF_2026 },
      { personalCalibrationKcal: 150 },
    );
    expect(r.personalCalibrationKcal).toBe(150);
  });
});

describe("Macros — protein stays stable between REST and FOOTBALL_TRAINING", () => {
  it("protein grams unchanged, carbs increase for training", () => {
    const p = profile({
      birthDate: "1998-01-01",
      performanceGoal: "PERFORMANCE",
      weightKg: 80,
      position: "WR",
    });
    const rest = calculatePerformanceNutritionTarget(p, {
      dayType: "REST",
      referenceDate: REF_2026,
    });
    const training = calculatePerformanceNutritionTarget(p, {
      dayType: "FOOTBALL_TRAINING",
      sessionIntensity: "MODERATE",
      referenceDate: REF_2026,
    });
    expect(rest.proteinG).toBe(training.proteinG);
    expect((training.carbsG ?? 0)).toBeGreaterThan(rest.carbsG ?? 0);
    expect((training.targetKcal ?? 0)).toBeGreaterThan(rest.targetKcal ?? 0);
  });
});

describe("Carb floor can raise final target kcal", () => {
  it("FAT_LOSS athlete on DOUBLE_SESSION triggers carb floor", () => {
    const p = profile({
      birthDate: "1996-01-01",
      performanceGoal: "FAT_LOSS",
      position: "WR",
      weightKg: 90,
      heightCm: 180,
    });
    const r = calculatePerformanceNutritionTarget(p, {
      dayType: "DOUBLE_SESSION",
      referenceDate: REF_2026,
    });
    expect(r.energyFloorApplied).toBe(true);
    expect(r.flags).toContain("CARBOHYDRATE_PERFORMANCE_FLOOR_APPLIED");
    expect((r.targetKcal ?? 0)).toBeGreaterThan((r.goalAdjustedEnergy ?? 0));
  });
});

describe("Missing data / review-required", () => {
  it("UNSPECIFIED sex → REVIEW_REQUIRED + flag, no numbers", () => {
    const r = calculatePerformanceNutritionTarget(
      profile({ sexForEnergyCalculation: "UNSPECIFIED" }),
      { dayType: "REST", referenceDate: REF_2026 },
    );
    expect(r.status).toBe("REVIEW_REQUIRED");
    expect(r.flags).toContain("MISSING_ENERGY_CALCULATION_SEX");
    expect(r.targetKcal).toBeNull();
  });
  it("Missing weight → MISSING_DATA", () => {
    const r = calculatePerformanceNutritionTarget(
      profile({ weightKg: null }),
      { dayType: "REST", referenceDate: REF_2026 },
    );
    expect(r.status).toBe("MISSING_DATA");
  });
});

describe("Engine version + kcal consistency", () => {
  it("engineVersion is exposed and targetKcal equals sum of macro kcal", () => {
    const p = profile({ birthDate: "1998-01-01", performanceGoal: "STRENGTH_GAIN" });
    const r = calculatePerformanceNutritionTarget(p, {
      dayType: "STRENGTH",
      referenceDate: REF_2026,
    });
    expect(r.engineVersion).toBe(PERFORMANCE_NUTRITION_ENGINE_VERSION);
    const derived = (r.proteinG ?? 0) * 4 + (r.carbsG ?? 0) * 4 + (r.fatG ?? 0) * 9;
    expect(r.targetKcal).toBe(derived);
  });
});

describe("Age calculation", () => {
  it("computes decimal age", () => {
    const age = calculateAgeFromBirthDate(new Date("2000-01-01"), new Date("2026-07-07"));
    expect(age).toBeGreaterThan(26.5);
    expect(age).toBeLessThan(26.6);
  });
});
