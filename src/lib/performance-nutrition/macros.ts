/**
 * Macro calculation (protein, fat, carbs) with carb-floor logic.
 * Pure.
 */
import {
  CARB_FLOOR_FACTORS_ADULT,
  CARB_FLOOR_FACTORS_YOUTH,
  FAT_DEFAULT_YOUTH,
  FAT_FACTORS_ADULT,
  FAT_HARD_MIN_ADULT,
  FAT_HARD_MIN_YOUTH,
  PROTEIN_FACTORS_ADULT,
  getYouthProteinFactor,
  type FootballPositionCluster,
  type PerformanceDayType,
  type PerformanceGoal,
} from "./constants";
import { MAX_PROTEIN_G_PER_KG } from "../nutrition-protein-policy";

function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}

export interface MacroInput {
  isYouth: boolean;
  age: number;
  weightKg: number;
  goal: PerformanceGoal;
  dayType: PerformanceDayType;
  positionCluster: FootballPositionCluster | null;
  /** kcal target coming out of EER × goalModifier + calibration */
  targetEnergyKcal: number;
}

export interface MacroResult {
  proteinG: number;
  fatG: number;
  carbsG: number;
  finalTargetKcal: number;
  carbFloorG: number;
  energyFloorApplied: boolean;
}

function resolveCarbFloorFactor(
  isYouth: boolean,
  dayType: PerformanceDayType,
  cluster: FootballPositionCluster | null,
): number {
  const table = isYouth ? CARB_FLOOR_FACTORS_YOUTH : CARB_FLOOR_FACTORS_ADULT;
  const entry = table[dayType];
  if (typeof entry === "number") return entry;
  // cluster-scoped table
  const key: FootballPositionCluster = cluster ?? "HYBRID";
  return entry[key] ?? entry.HYBRID ?? 3.5;
}

export function calculateMacros(input: MacroInput): MacroResult {
  const { isYouth, age, weightKg, goal, dayType, positionCluster, targetEnergyKcal } = input;

  // 1) Protein
  const proteinFactor = isYouth ? getYouthProteinFactor(age) : PROTEIN_FACTORS_ADULT[goal];
  let proteinG = weightKg * proteinFactor;

  // 2) Fat (with hard minimum)
  const fatFactor = isYouth ? FAT_DEFAULT_YOUTH : FAT_FACTORS_ADULT[goal];
  const fatHardMin = isYouth ? FAT_HARD_MIN_YOUTH : FAT_HARD_MIN_ADULT;
  let fatG = Math.max(weightKg * fatFactor, weightKg * fatHardMin);

  // 3) Carbs — fill remaining calories, then apply floor
  const carbFloorFactor = resolveCarbFloorFactor(isYouth, dayType, positionCluster);
  const carbFloorG = weightKg * carbFloorFactor;

  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const remainingKcal = targetEnergyKcal - proteinKcal - fatKcal;
  const calculatedCarbsG = remainingKcal / 4;
  let carbsG = Math.max(calculatedCarbsG, carbFloorG);

  const energyFloorApplied = carbsG > calculatedCarbsG;

  // 4) Round all macros to nearest 5 g
  proteinG = Math.min(roundToNearest5(proteinG), Math.floor(weightKg * MAX_PROTEIN_G_PER_KG));
  fatG = roundToNearest5(fatG);
  carbsG = roundToNearest5(carbsG);

  // 5) Recompute kcal from final macros so display is consistent
  const finalTargetKcal = proteinG * 4 + carbsG * 4 + fatG * 9;

  return {
    proteinG,
    fatG,
    carbsG,
    finalTargetKcal,
    carbFloorG: Math.round(carbFloorG),
    energyFloorApplied,
  };
}
