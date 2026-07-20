/**
 * BodyFuel Performance Nutrition Engine V1 — Types
 */
import type {
  BaselineDailyActivity,
  EnergySex,
  FootballPositionCluster,
  PalCategory,
  PerformanceDayType,
  PerformanceGoal,
  PerformanceNutritionFlag,
  SessionIntensity,
} from "./constants";

export type CalculationStatus = "CALCULATED" | "REVIEW_REQUIRED" | "MISSING_DATA";

export interface AthleteProfileInput {
  /** ISO date string (YYYY-MM-DD). */
  birthDate: string | null;
  sexForEnergyCalculation: EnergySex | null;
  heightCm: number | null;
  weightKg: number | null;
  /** Raw football position string (any casing). Optional — required only for football day types. */
  position: string | null;
  performanceGoal: PerformanceGoal | null;
  baselineDailyActivity: BaselineDailyActivity | null;
}

export interface DayContextInput {
  dayType: PerformanceDayType;
  /** Optional intensity for FOOTBALL_TRAINING. Defaults to MODERATE when the day type is FOOTBALL_TRAINING and no value is given. */
  sessionIntensity?: SessionIntensity | null;
  /** Date the calculation is performed for (defaults to today). Used for age. */
  referenceDate?: Date;
}

export interface CalibrationContextInput {
  /** Adult personal calibration in kcal. Defaults to 0. Ignored for youth (see result flags). */
  personalCalibrationKcal?: number;
}

export interface PerformanceNutritionResult {
  status: CalculationStatus;
  engineVersion: number;

  age: number | null;
  isYouth: boolean;

  dayType: PerformanceDayType;
  palCategory: PalCategory | null;
  positionCluster: FootballPositionCluster | null;
  performanceGoal: PerformanceGoal | null;
  effectiveGoal: PerformanceGoal | "BODY_COMPOSITION_REVIEW" | null;

  initialEer: number | null;
  goalModifier: number | null;
  goalAdjustedEnergy: number | null;
  personalCalibrationKcal: number;

  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  targetKcal: number | null;

  carbFloorG: number | null;
  energyFloorApplied: boolean;

  coachReviewRequired: boolean;

  flags: PerformanceNutritionFlag[];
}
