/**
 * Zentrale Nährwert-Plausibilisierung (EU 1169/2011).
 *
 * Regel: kcal je 100 g/ml müssen zu den Makros passen
 * (4*Protein + 4*Kohlenhydrate + 9*Fett, zzgl. Ballaststoffe/Alkohol/Polyole/Säuren).
 * Ist die Abweichung zu groß, wird der offensichtlich falsche kcal-Wert NICHT angezeigt,
 * sondern durch den berechneten Wert ersetzt und der Datensatz markiert.
 *
 * Bestehende Tracking-Einträge werden dadurch nicht verändert — die Korrektur
 * greift ausschließlich bei der Anzeige/Übernahme neuer Werte.
 */

import { energyFromNutrients } from "@/lib/food-units";

export type EnergyCheckInput = {
  kcal_per_100g: number | null | undefined;
  protein_per_100g: number | null | undefined;
  carbs_per_100g: number | null | undefined;
  fat_per_100g: number | null | undefined;
  fiber_per_100g?: number | null;
  alcohol_per_100g?: number | null;
  polyols_per_100g?: number | null;
  organic_acids_per_100g?: number | null;
};

export type EnergyCheckResult = {
  /** kcal-Wert, der angezeigt/gespeichert werden darf. */
  kcal_per_100g: number;
  /** Aus den Makros berechnete Energie. */
  computed_kcal: number;
  /** Prozentuale Abweichung zum berechneten Wert (0 wenn nicht berechenbar). */
  deviation_pct: number;
  /** true, wenn der gelieferte kcal-Wert unplausibel war und ersetzt wurde. */
  corrected: boolean;
  /** true, wenn der Datensatz als fehlerhaft markiert werden sollte. */
  flagged: boolean;
  reason: string | null;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Toleranz: 25 % bzw. mindestens 25 kcal — deckt Rundungen und Ballaststoff-Modelle ab. */
export const ENERGY_TOLERANCE_PCT = 0.25;
export const ENERGY_TOLERANCE_ABS = 25;

export function checkFoodEnergy(input: EnergyCheckInput): EnergyCheckResult {
  const protein = num(input.protein_per_100g);
  const carbs = num(input.carbs_per_100g);
  const fat = num(input.fat_per_100g);
  const kcal = num(input.kcal_per_100g);

  const computed = energyFromNutrients({
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fiber_g: num(input.fiber_per_100g),
    alcohol_g: num(input.alcohol_per_100g),
    polyols_g: num(input.polyols_per_100g),
    organic_acids_g: num(input.organic_acids_per_100g),
  });
  const computedRounded = Math.round(computed);

  // Ohne Makros lässt sich nichts prüfen — Originalwert bleibt bestehen.
  if (computed <= 0) {
    return {
      kcal_per_100g: kcal,
      computed_kcal: 0,
      deviation_pct: 0,
      corrected: false,
      flagged: kcal <= 0,
      reason: kcal <= 0 ? "Keine Nährwerte hinterlegt" : null,
    };
  }

  // kcal fehlt komplett → aus Makros ableiten (sicherer Fallback).
  if (kcal <= 0) {
    return {
      kcal_per_100g: computedRounded,
      computed_kcal: computedRounded,
      deviation_pct: 100,
      corrected: true,
      flagged: true,
      reason: "kcal fehlten und wurden aus den Makros berechnet",
    };
  }

  const diff = Math.abs(computed - kcal);
  const tolerance = Math.max(ENERGY_TOLERANCE_ABS, computed * ENERGY_TOLERANCE_PCT);
  const deviation = Math.round((diff / computed) * 100);

  if (diff <= tolerance) {
    return {
      kcal_per_100g: Math.round(kcal),
      computed_kcal: computedRounded,
      deviation_pct: deviation,
      corrected: false,
      flagged: false,
      reason: null,
    };
  }

  return {
    kcal_per_100g: computedRounded,
    computed_kcal: computedRounded,
    deviation_pct: deviation,
    corrected: true,
    flagged: true,
    reason: `Energieabweichung ${deviation}% — kcal aus Makros berechnet`,
  };
}

/** Wendet die Prüfung auf ein Objekt mit *_per_100g-Feldern an. */
export function withValidatedEnergy<
  T extends EnergyCheckInput & {
    energy_flagged?: boolean;
    energy_note?: string | null;
  },
>(food: T): T {
  const result = checkFoodEnergy(food);
  return {
    ...food,
    kcal_per_100g: result.kcal_per_100g,
    energy_flagged: result.flagged,
    energy_note: result.reason,
  };
}
