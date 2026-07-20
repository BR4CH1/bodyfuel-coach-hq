/**
 * BodyFuel Performance Nutrition Engine V1 — Constants
 *
 * Source of truth for all numeric factors. No magic numbers in components,
 * routes or engine functions — everything lives here so we can version it.
 *
 * EER equations basis:
 *   Dietary Reference Intakes for Energy (2023)
 *   National Academies of Sciences, Engineering, and Medicine
 *   DOI: 10.17226/26818
 *
 * BodyFuel-specific product logic (goal modifiers, macro factors, carb floors,
 * weight-trend ranges, calibration rules) is kept separate from the DRI EER
 * equations so it can evolve independently.
 */

export const PERFORMANCE_NUTRITION_ENGINE_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// PAL categories
// ---------------------------------------------------------------------------

export const PAL_CATEGORIES = ["INACTIVE", "LOW_ACTIVE", "ACTIVE", "VERY_ACTIVE"] as const;
export type PalCategory = (typeof PAL_CATEGORIES)[number];

export const PAL_RANK: Record<PalCategory, number> = {
  INACTIVE: 0,
  LOW_ACTIVE: 1,
  ACTIVE: 2,
  VERY_ACTIVE: 3,
};

export function palFromRank(rank: number): PalCategory {
  const clamped = Math.max(0, Math.min(3, rank));
  return PAL_CATEGORIES[clamped];
}

// ---------------------------------------------------------------------------
// Sex for energy calculation
// ---------------------------------------------------------------------------

export type EnergySex = "MALE" | "FEMALE" | "UNSPECIFIED";

// ---------------------------------------------------------------------------
// Baseline daily activity — the athlete's non-training everyday load
// ---------------------------------------------------------------------------

export type BaselineDailyActivity =
  | "MOSTLY_SEATED"
  | "MIXED"
  | "PHYSICALLY_ACTIVE"
  | "VERY_PHYSICALLY_ACTIVE";

export const BASELINE_ACTIVITY_PAL: Record<BaselineDailyActivity, PalCategory> = {
  MOSTLY_SEATED: "INACTIVE",
  MIXED: "LOW_ACTIVE",
  PHYSICALLY_ACTIVE: "ACTIVE",
  VERY_PHYSICALLY_ACTIVE: "VERY_ACTIVE",
};

// ---------------------------------------------------------------------------
// Day types
// ---------------------------------------------------------------------------

export const DAY_TYPES = [
  "REST",
  "STRENGTH",
  "FOOTBALL_TRAINING",
  "GAME_DAY",
  "DOUBLE_SESSION",
  // reserved / future
  "SPEED",
  "CONDITIONING",
  "RECOVERY",
] as const;
export type PerformanceDayType = (typeof DAY_TYPES)[number];

// ---------------------------------------------------------------------------
// Football position clusters
// ---------------------------------------------------------------------------

export type FootballPositionCluster =
  | "SPEED_SKILL"
  | "HYBRID"
  | "POWER_CONTACT"
  | "SPECIALIST";

/** Raw position → cluster. Keys are normalized to upper case. */
const POSITION_CLUSTER_MAP: Record<string, FootballPositionCluster> = {
  WR: "SPEED_SKILL",
  DB: "SPEED_SKILL",
  CB: "SPEED_SKILL",
  S: "SPEED_SKILL",
  FS: "SPEED_SKILL",
  SS: "SPEED_SKILL",
  RB: "SPEED_SKILL",
  HB: "SPEED_SKILL",
  FB: "SPEED_SKILL",

  QB: "HYBRID",
  TE: "HYBRID",
  LB: "HYBRID",
  OLB: "HYBRID",
  ILB: "HYBRID",
  MLB: "HYBRID",

  OL: "POWER_CONTACT",
  OT: "POWER_CONTACT",
  OG: "POWER_CONTACT",
  C: "POWER_CONTACT",
  DL: "POWER_CONTACT",
  DT: "POWER_CONTACT",
  DE: "POWER_CONTACT",
  NT: "POWER_CONTACT",

  K: "SPECIALIST",
  P: "SPECIALIST",
  LS: "SPECIALIST",
};

export function normalizeFootballPosition(position: string | null | undefined): string | null {
  if (!position) return null;
  const key = position.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return key || null;
}

export function getFootballPositionCluster(
  position: string | null | undefined,
): FootballPositionCluster | null {
  const key = normalizeFootballPosition(position);
  if (!key) return null;
  return POSITION_CLUSTER_MAP[key] ?? null;
}

/** Base PAL for a football training day by cluster (before session intensity). */
export const FOOTBALL_POSITION_DEFAULT_PAL: Record<FootballPositionCluster, PalCategory> = {
  SPEED_SKILL: "VERY_ACTIVE",
  HYBRID: "ACTIVE",
  POWER_CONTACT: "ACTIVE",
  SPECIALIST: "ACTIVE",
};

// ---------------------------------------------------------------------------
// Session intensity
// ---------------------------------------------------------------------------

export type SessionIntensity = "LIGHT" | "MODERATE" | "HARD";

export const SESSION_INTENSITY_PAL_SHIFT: Record<SessionIntensity, number> = {
  LIGHT: -1,
  MODERATE: 0,
  HARD: 1,
};

// ---------------------------------------------------------------------------
// Performance goals
// ---------------------------------------------------------------------------

export const PERFORMANCE_GOALS = [
  "PERFORMANCE",
  "STRENGTH_GAIN",
  "MUSCLE_GAIN",
  "SPEED_EXPLOSIVENESS",
  "FAT_LOSS",
] as const;
export type PerformanceGoal = (typeof PERFORMANCE_GOALS)[number];

export const GOAL_ENERGY_MODIFIERS_ADULT: Record<PerformanceGoal, number> = {
  PERFORMANCE: 1.0,
  STRENGTH_GAIN: 1.05,
  MUSCLE_GAIN: 1.08,
  SPEED_EXPLOSIVENESS: 1.0,
  FAT_LOSS: 0.9,
};

/**
 * Youth (age < 19) modifiers. FAT_LOSS is intentionally NOT a deficit — it
 * becomes a coach-review body-composition goal (see engine).
 */
export const GOAL_ENERGY_MODIFIERS_YOUTH: Record<PerformanceGoal, number> = {
  PERFORMANCE: 1.0,
  STRENGTH_GAIN: 1.03,
  MUSCLE_GAIN: 1.05,
  SPEED_EXPLOSIVENESS: 1.0,
  FAT_LOSS: 1.0, // overridden to BODY_COMPOSITION_REVIEW
};

// ---------------------------------------------------------------------------
// Protein factors (g/kg)
// ---------------------------------------------------------------------------

export const PROTEIN_FACTORS_ADULT: Record<PerformanceGoal, number> = {
  PERFORMANCE: 1.6,
  STRENGTH_GAIN: 1.8,
  MUSCLE_GAIN: 1.8,
  SPEED_EXPLOSIVENESS: 1.6,
  FAT_LOSS: 2.0,
};

/** Youth protein: age-based, goal-independent. */
export function getYouthProteinFactor(age: number): number {
  if (age < 14) return 1.4;
  return 1.6; // 14 .. <19
}

// ---------------------------------------------------------------------------
// Fat factors (g/kg)
// ---------------------------------------------------------------------------

export const FAT_FACTORS_ADULT: Record<PerformanceGoal, number> = {
  PERFORMANCE: 1.0,
  STRENGTH_GAIN: 0.9,
  MUSCLE_GAIN: 0.9,
  SPEED_EXPLOSIVENESS: 1.0,
  FAT_LOSS: 0.8,
};

export const FAT_HARD_MIN_ADULT = 0.8;
export const FAT_DEFAULT_YOUTH = 1.1;
export const FAT_HARD_MIN_YOUTH = 1.0;

// ---------------------------------------------------------------------------
// Carbohydrate floors (g/kg)
// ---------------------------------------------------------------------------

type CarbFloorTable = Record<
  PerformanceDayType,
  number | Partial<Record<FootballPositionCluster, number>>
>;

export const CARB_FLOOR_FACTORS_ADULT: CarbFloorTable = {
  REST: 2.0,
  STRENGTH: 3.0,
  FOOTBALL_TRAINING: {
    SPEED_SKILL: 4.5,
    HYBRID: 4.0,
    POWER_CONTACT: 3.5,
    SPECIALIST: 3.0,
  },
  GAME_DAY: {
    SPEED_SKILL: 5.5,
    HYBRID: 5.0,
    POWER_CONTACT: 4.5,
    SPECIALIST: 4.0,
  },
  DOUBLE_SESSION: 6.0,
  // reserved
  SPEED: 4.0,
  CONDITIONING: 4.0,
  RECOVERY: 2.5,
};

export const CARB_FLOOR_FACTORS_YOUTH: CarbFloorTable = {
  REST: 2.5,
  STRENGTH: 3.5,
  FOOTBALL_TRAINING: {
    SPEED_SKILL: 5.0,
    HYBRID: 4.5,
    POWER_CONTACT: 4.0,
    SPECIALIST: 3.5,
  },
  GAME_DAY: {
    SPEED_SKILL: 6.0,
    HYBRID: 5.5,
    POWER_CONTACT: 5.0,
    SPECIALIST: 4.5,
  },
  DOUBLE_SESSION: 6.5,
  SPEED: 4.5,
  CONDITIONING: 4.5,
  RECOVERY: 3.0,
};

// ---------------------------------------------------------------------------
// Goal weight-trend ranges (% body weight per week)
// ---------------------------------------------------------------------------

export interface WeightTrendRange {
  min: number; // % / week
  max: number; // % / week
}

export const GOAL_WEIGHT_TREND_RANGES: Record<PerformanceGoal, WeightTrendRange> = {
  PERFORMANCE: { min: -0.15, max: 0.15 },
  SPEED_EXPLOSIVENESS: { min: -0.15, max: 0.15 },
  STRENGTH_GAIN: { min: 0.05, max: 0.25 },
  MUSCLE_GAIN: { min: 0.1, max: 0.35 },
  FAT_LOSS: { min: -0.6, max: -0.25 },
};

// ---------------------------------------------------------------------------
// Adaptive calibration rules
// ---------------------------------------------------------------------------

export const CALIBRATION_RULES = {
  MIN_DAYS_BETWEEN_CALIBRATIONS: 14,
  MIN_WEIGHT_ENTRIES_PER_WINDOW: 3,
  MIN_TRACKING_ADHERENCE: 0.7,
  ADULT_STEP_KCAL: 150,
  YOUTH_SUGGESTION_STEP_KCAL: 100,
  MAX_CUMULATIVE_KCAL: 600,
  MIN_CUMULATIVE_KCAL: -600,
} as const;

// ---------------------------------------------------------------------------
// Youth growth energy cost (kcal/day, added to TEE)
// ---------------------------------------------------------------------------

export function getYouthGrowthEnergyCost(age: number, sex: EnergySex): number {
  if (sex === "MALE") {
    if (age >= 3 && age < 4) return 20;
    if (age >= 4 && age < 9) return 15;
    if (age >= 9 && age < 14) return 25;
    if (age >= 14 && age < 19) return 20;
    return 0;
  }
  if (sex === "FEMALE") {
    if (age >= 3 && age < 9) return 15;
    if (age >= 9 && age < 14) return 30;
    if (age >= 14 && age < 19) return 20;
    return 0;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Calculation flags
// ---------------------------------------------------------------------------

export type PerformanceNutritionFlag =
  | "MISSING_ENERGY_CALCULATION_SEX"
  | "MISSING_BIRTH_DATE"
  | "MISSING_HEIGHT"
  | "MISSING_WEIGHT"
  | "MISSING_POSITION"
  | "MISSING_PERFORMANCE_GOAL"
  | "MISSING_BASELINE_ACTIVITY"
  | "HEIGHT_VALUE_REVIEW"
  | "WEIGHT_VALUE_REVIEW"
  | "AGE_VALUE_REVIEW"
  | "YOUTH_BODY_COMPOSITION_REVIEW"
  | "YOUTH_CALIBRATION_REVIEW_REQUIRED"
  | "CARBOHYDRATE_PERFORMANCE_FLOOR_APPLIED"
  | "INSUFFICIENT_TRACKING_FOR_CALIBRATION"
  | "COACH_OVERRIDE_ACTIVE"
  | "SESSION_INTENSITY_DEFAULT_APPLIED";
