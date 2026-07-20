// Canonical training goal definitions (must match compute_macro_targets in DB).
export type TrainingGoal =
  | "performance"
  | "lean_bulk"
  | "fat_loss"
  | "aggressive_cut"
  | "recovery";

export const TRAINING_GOAL_LABELS: Record<string, string> = {
  performance: "Performance",
  lean_bulk: "Lean Bulk (Muskelaufbau)",
  fat_loss: "Fettabbau",
  aggressive_cut: "Aggressiver Cut",
  recovery: "Regeneration / Verletzung",
  // legacy aliases — kept readable for older profiles
  muscle_gain: "Lean Bulk (Muskelaufbau)",
  strength: "Performance",
  maintenance: "Performance",
  recomposition: "Performance",
  health: "Regeneration",
  weight_loss: "Fettabbau",
  cut: "Aggressiver Cut",
};

export const TRAINING_GOAL_DESCRIPTIONS: Record<string, string> = {
  performance:
    "Fokus auf Leistung, Regeneration und Trainingsqualität – für Athleten, Football, Hyrox.",
  lean_bulk: "Sauberer Muskelaufbau mit minimalem Fettzuwachs.",
  fat_loss: "Maximaler Fettverlust bei Muskelerhalt und guter Trainingsleistung.",
  aggressive_cut: "Kurzfristige Diätphase für schnelle Gewichtsreduktion.",
  recovery: "Optimiert Heilung und Muskelerhalt während einer Verletzungspause.",
};

export function labelForTrainingGoal(g?: string | null): string {
  if (!g) return "—";
  return TRAINING_GOAL_LABELS[g] ?? g;
}

/**
 * Berechnet die nötige Wochenrate (kg/Woche) und Tages-Kaloriendelta
 * basierend auf aktuellem Gewicht, Wunschgewicht und Zieldatum.
 * Negativ = Abnehmen, positiv = Aufbauen.
 */
export function weeklyRate(
  currentKg?: number | null,
  goalKg?: number | null,
  targetDate?: string | null,
): { weeks: number; kgPerWeek: number; kcalPerDay: number; intensity: "moderate" | "ambitious" | "aggressive" | "capped" } | null {
  if (currentKg == null || goalKg == null || !targetDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const td = new Date(targetDate);
  if (Number.isNaN(td.getTime())) return null;
  const days = Math.max(14, Math.round((td.getTime() - today.getTime()) / 86_400_000));
  const weeks = Math.max(2, days / 7);
  const kgDiff = goalKg - currentKg;
  const rawRate = kgDiff / weeks;

  // Clamps (synchron zur DB-Funktion)
  const maxLoss = -(currentKg * 0.01);
  const maxGain = currentKg * 0.005;
  let rate = rawRate;
  let capped = false;
  if (rate < maxLoss) { rate = maxLoss; capped = true; }
  if (rate > maxGain) { rate = maxGain; capped = true; }

  const kcalPerDay = Math.round((rate * 7700) / 7);
  const absPct = Math.abs(rate) / currentKg;
  const intensity: "moderate" | "ambitious" | "aggressive" | "capped" = capped
    ? "capped"
    : absPct < 0.004
      ? "moderate"
      : absPct < 0.008
        ? "ambitious"
        : "aggressive";
  return { weeks: Math.round(weeks * 10) / 10, kgPerWeek: Math.round(rate * 100) / 100, kcalPerDay, intensity };
}
