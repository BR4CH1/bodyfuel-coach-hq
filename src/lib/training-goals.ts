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
