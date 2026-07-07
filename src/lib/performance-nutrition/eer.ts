/**
 * DRI 2023 EER equations — pure, unit-tested, no BodyFuel-specific logic in here.
 *
 * Inputs: age in years (decimal ok), height in cm, weight in kg.
 * Output: kcal / day.
 *
 * IMPORTANT: the equation itself already encodes PAL. Do NOT multiply the
 * result by another PAL factor.
 */
import {
  type EnergySex,
  type PalCategory,
  getYouthGrowthEnergyCost,
} from "./constants";

function adultMale(pal: PalCategory, age: number, h: number, w: number): number {
  switch (pal) {
    case "INACTIVE":
      return 753.07 - 10.83 * age + 6.5 * h + 14.1 * w;
    case "LOW_ACTIVE":
      return 581.47 - 10.83 * age + 8.3 * h + 14.94 * w;
    case "ACTIVE":
      return 1004.82 - 10.83 * age + 6.52 * h + 15.91 * w;
    case "VERY_ACTIVE":
      return -517.88 - 10.83 * age + 15.61 * h + 19.11 * w;
  }
}

function adultFemale(pal: PalCategory, age: number, h: number, w: number): number {
  switch (pal) {
    case "INACTIVE":
      return 584.9 - 7.01 * age + 5.72 * h + 11.71 * w;
    case "LOW_ACTIVE":
      return 575.77 - 7.01 * age + 6.6 * h + 12.14 * w;
    case "ACTIVE":
      return 710.25 - 7.01 * age + 6.54 * h + 12.34 * w;
    case "VERY_ACTIVE":
      return 511.83 - 7.01 * age + 9.07 * h + 12.56 * w;
  }
}

function youthBoy(pal: PalCategory, age: number, h: number, w: number): number {
  switch (pal) {
    case "INACTIVE":
      return -447.51 + 3.68 * age + 13.01 * h + 13.15 * w;
    case "LOW_ACTIVE":
      return 19.12 + 3.68 * age + 8.62 * h + 20.28 * w;
    case "ACTIVE":
      return -388.19 + 3.68 * age + 12.66 * h + 20.46 * w;
    case "VERY_ACTIVE":
      return -671.75 + 3.68 * age + 15.38 * h + 23.25 * w;
  }
}

function youthGirl(pal: PalCategory, age: number, h: number, w: number): number {
  switch (pal) {
    case "INACTIVE":
      return 55.59 - 22.25 * age + 8.43 * h + 17.07 * w;
    case "LOW_ACTIVE":
      return -297.54 - 22.25 * age + 12.77 * h + 14.73 * w;
    case "ACTIVE":
      return -189.55 - 22.25 * age + 11.74 * h + 18.34 * w;
    case "VERY_ACTIVE":
      return -709.59 - 22.25 * age + 18.22 * h + 14.25 * w;
  }
}

export interface EerInput {
  age: number;
  sex: EnergySex; // must be MALE or FEMALE — caller must gate on UNSPECIFIED
  heightCm: number;
  weightKg: number;
  palCategory: PalCategory;
}

/**
 * Compute EER (kcal/day) using DRI 2023.
 * For youth (age < 19), growth energy cost is added on top of TEE.
 * Returns null for age < 3 (out of validated range) or UNSPECIFIED sex.
 */
export function calculateEer(input: EerInput): number | null {
  const { age, sex, heightCm, weightKg, palCategory } = input;
  if (sex === "UNSPECIFIED") return null;
  if (age < 3) return null;

  if (age >= 19) {
    const kcal =
      sex === "MALE"
        ? adultMale(palCategory, age, heightCm, weightKg)
        : adultFemale(palCategory, age, heightCm, weightKg);
    return kcal;
  }

  const tee =
    sex === "MALE"
      ? youthBoy(palCategory, age, heightCm, weightKg)
      : youthGirl(palCategory, age, heightCm, weightKg);
  return tee + getYouthGrowthEnergyCost(age, sex);
}

/**
 * Exact decimal age in years between birthDate and referenceDate.
 * Uses 365.25 days/year (accounts for leap years) — good enough for EER math.
 */
export function calculateAgeFromBirthDate(birthDate: Date, referenceDate: Date): number {
  const ms = referenceDate.getTime() - birthDate.getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}
