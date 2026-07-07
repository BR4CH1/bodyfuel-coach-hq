/**
 * BodyFuel Performance Nutrition Engine V1 — main entry point.
 *
 * Pure. No React, no Supabase. The single source of truth for per-day
 * kcal + macro targets for an organization-context athlete.
 *
 * Priority when used by call-sites:
 *   1. Active coach override (handled by caller, NOT here)
 *   2. Engine result + personal calibration (this function)
 *
 * Position is NOT a direct calorie modifier — position influences the day PAL
 * (via football training) and the carb floor.
 */
import {
  GOAL_ENERGY_MODIFIERS_ADULT,
  GOAL_ENERGY_MODIFIERS_YOUTH,
  PERFORMANCE_NUTRITION_ENGINE_VERSION,
  getFootballPositionCluster,
  type PerformanceNutritionFlag,
} from "./constants";
import { calculateAgeFromBirthDate, calculateEer } from "./eer";
import { getDayPalCategory } from "./pal";
import { calculateMacros } from "./macros";
import type {
  AthleteProfileInput,
  CalibrationContextInput,
  DayContextInput,
  PerformanceNutritionResult,
} from "./types";

const YOUTH_AGE_CUTOFF = 19;

/** Sanity gates. Extreme values become review flags — not hard blockers, not auto-corrected. */
function collectDataFlags(profile: AthleteProfileInput): PerformanceNutritionFlag[] {
  const flags: PerformanceNutritionFlag[] = [];
  if (!profile.birthDate) flags.push("MISSING_BIRTH_DATE");
  if (!profile.sexForEnergyCalculation || profile.sexForEnergyCalculation === "UNSPECIFIED") {
    flags.push("MISSING_ENERGY_CALCULATION_SEX");
  }
  if (!profile.heightCm) flags.push("MISSING_HEIGHT");
  else if (profile.heightCm < 120 || profile.heightCm > 230) flags.push("HEIGHT_VALUE_REVIEW");
  if (!profile.weightKg) flags.push("MISSING_WEIGHT");
  else if (profile.weightKg < 25 || profile.weightKg > 200) flags.push("WEIGHT_VALUE_REVIEW");
  if (!profile.performanceGoal) flags.push("MISSING_PERFORMANCE_GOAL");
  if (!profile.baselineDailyActivity) flags.push("MISSING_BASELINE_ACTIVITY");
  return flags;
}

function emptyResult(
  profile: AthleteProfileInput,
  day: DayContextInput,
  flags: PerformanceNutritionFlag[],
  status: "MISSING_DATA" | "REVIEW_REQUIRED",
): PerformanceNutritionResult {
  return {
    status,
    engineVersion: PERFORMANCE_NUTRITION_ENGINE_VERSION,
    age: null,
    isYouth: false,
    dayType: day.dayType,
    palCategory: null,
    positionCluster: getFootballPositionCluster(profile.position),
    performanceGoal: profile.performanceGoal,
    effectiveGoal: profile.performanceGoal,
    initialEer: null,
    goalModifier: null,
    goalAdjustedEnergy: null,
    personalCalibrationKcal: 0,
    proteinG: null,
    fatG: null,
    carbsG: null,
    targetKcal: null,
    carbFloorG: null,
    energyFloorApplied: false,
    coachReviewRequired: status === "REVIEW_REQUIRED",
    flags,
  };
}

export function calculatePerformanceNutritionTarget(
  profile: AthleteProfileInput,
  day: DayContextInput,
  calibration: CalibrationContextInput = {},
): PerformanceNutritionResult {
  const flags = collectDataFlags(profile);

  // Missing critical numeric inputs → MISSING_DATA
  if (
    !profile.birthDate ||
    !profile.heightCm ||
    !profile.weightKg ||
    !profile.performanceGoal ||
    !profile.baselineDailyActivity
  ) {
    return emptyResult(profile, day, flags, "MISSING_DATA");
  }

  // Missing sex → REVIEW_REQUIRED, no scheinpräzise Berechnung
  if (!profile.sexForEnergyCalculation || profile.sexForEnergyCalculation === "UNSPECIFIED") {
    return emptyResult(profile, day, flags, "REVIEW_REQUIRED");
  }

  const referenceDate = day.referenceDate ?? new Date();
  const birthDate = new Date(profile.birthDate + "T00:00:00Z");
  const age = calculateAgeFromBirthDate(birthDate, referenceDate);

  if (age < 3) {
    flags.push("AGE_VALUE_REVIEW");
    return emptyResult(profile, day, flags, "REVIEW_REQUIRED");
  }

  const isYouth = age < YOUTH_AGE_CUTOFF;
  const positionCluster = getFootballPositionCluster(profile.position);

  // Session intensity default flag (transparency for coaches)
  if (
    day.dayType === "FOOTBALL_TRAINING" &&
    (day.sessionIntensity === undefined || day.sessionIntensity === null)
  ) {
    flags.push("SESSION_INTENSITY_DEFAULT_APPLIED");
  }

  const palCategory = getDayPalCategory({
    dayType: day.dayType,
    baseline: profile.baselineDailyActivity,
    positionCluster,
    sessionIntensity: day.sessionIntensity ?? null,
  });

  const initialEer = calculateEer({
    age,
    sex: profile.sexForEnergyCalculation,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    palCategory,
  });
  if (initialEer == null) {
    return emptyResult(profile, day, flags, "REVIEW_REQUIRED");
  }

  // Goal modifier — Youth FAT_LOSS is overridden to BODY_COMPOSITION_REVIEW
  let effectiveGoal: PerformanceNutritionResult["effectiveGoal"] = profile.performanceGoal;
  let coachReviewRequired = false;
  let goalModifier: number;

  if (isYouth && profile.performanceGoal === "FAT_LOSS") {
    effectiveGoal = "BODY_COMPOSITION_REVIEW";
    goalModifier = 1.0;
    coachReviewRequired = true;
    flags.push("YOUTH_BODY_COMPOSITION_REVIEW");
  } else if (isYouth) {
    goalModifier = GOAL_ENERGY_MODIFIERS_YOUTH[profile.performanceGoal];
  } else {
    goalModifier = GOAL_ENERGY_MODIFIERS_ADULT[profile.performanceGoal];
  }

  const goalAdjustedEnergy = initialEer * goalModifier;

  // Personal calibration — adults only. Youth never auto-applies (see engine doc §26).
  const personalCalibrationKcal = isYouth ? 0 : calibration.personalCalibrationKcal ?? 0;
  const targetEnergyKcal = goalAdjustedEnergy + personalCalibrationKcal;

  // Macros — always use the actual performance goal for protein/fat factors,
  // even if effectiveGoal is BODY_COMPOSITION_REVIEW (goal is what drives macros in practice;
  // energy is what was neutralized).
  const macroGoal =
    effectiveGoal === "BODY_COMPOSITION_REVIEW" ? "PERFORMANCE" : profile.performanceGoal;

  const macros = calculateMacros({
    isYouth,
    age,
    weightKg: profile.weightKg,
    goal: macroGoal,
    dayType: day.dayType,
    positionCluster,
    targetEnergyKcal,
  });

  if (macros.energyFloorApplied) {
    flags.push("CARBOHYDRATE_PERFORMANCE_FLOOR_APPLIED");
  }

  return {
    status: "CALCULATED",
    engineVersion: PERFORMANCE_NUTRITION_ENGINE_VERSION,
    age,
    isYouth,
    dayType: day.dayType,
    palCategory,
    positionCluster,
    performanceGoal: profile.performanceGoal,
    effectiveGoal,
    initialEer,
    goalModifier,
    goalAdjustedEnergy,
    personalCalibrationKcal,
    proteinG: macros.proteinG,
    fatG: macros.fatG,
    carbsG: macros.carbsG,
    targetKcal: macros.finalTargetKcal,
    carbFloorG: macros.carbFloorG,
    energyFloorApplied: macros.energyFloorApplied,
    coachReviewRequired,
    flags,
  };
}

export * from "./constants";
export * from "./types";
export { calculateEer, calculateAgeFromBirthDate } from "./eer";
export { getDayPalCategory, applySessionIntensity, getBaselinePal, getFootballTrainingPal } from "./pal";
