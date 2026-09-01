/**
 * Die Tabelle `training_exercises` erlaubt per CHECK-Constraint nur diese
 * Kategorien. Übungen aus der Bibliothek (z. B. "stretch") oder aus KI-/Import-
 * Quellen können abweichen — deshalb hier zentral normalisieren, statt den
 * Insert am Constraint scheitern zu lassen.
 */
export const ALLOWED_EXERCISE_CATEGORIES = [
  "barbell",
  "dumbbell",
  "machine",
  "cardio",
  "core",
  "bodyweight",
  "cable",
] as const;

export type AllowedExerciseCategory = (typeof ALLOWED_EXERCISE_CATEGORIES)[number];

const ALIASES: Record<string, AllowedExerciseCategory> = {
  stretch: "bodyweight",
  stretching: "bodyweight",
  mobility: "bodyweight",
  mobilitaet: "bodyweight",
  mobilität: "bodyweight",
  dehnen: "bodyweight",
  yoga: "bodyweight",
  calisthenics: "bodyweight",
  band: "cable",
  resistance_band: "cable",
  kettlebell: "dumbbell",
  freeweight: "dumbbell",
  kurzhantel: "dumbbell",
  langhantel: "barbell",
  maschine: "machine",
  smith: "machine",
  conditioning: "cardio",
  hiit: "cardio",
  ausdauer: "cardio",
  plyometric: "bodyweight",
  rumpf: "core",
  abs: "core",
};

export function normalizeExerciseCategory(value: unknown): AllowedExerciseCategory | null {
  if (value == null) return null;
  const key = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return null;
  if ((ALLOWED_EXERCISE_CATEGORIES as readonly string[]).includes(key)) {
    return key as AllowedExerciseCategory;
  }
  return ALIASES[key] ?? null;
}
