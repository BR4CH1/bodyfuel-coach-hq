/**
 * BodyFuel Strength Score V2 — single source of truth.
 *
 * Bewertet Krafttests relativ zum Körpergewicht auf Basis eines
 * RPE-adjustierten e1RM. Neue Kalibrierung: 50 Punkte = solide Basis,
 * 65–85 = gute Trainingsroutine, 90+ = außergewöhnlich / Elite.
 */

export type StrengthTestKey =
  | "leg_press"
  | "leg_curl"
  | "chest_press"
  | "shoulder_press"
  | "lat_pulldown"
  | "cable_row"
  | "plank";

export const SCORE_ALGORITHM_VERSION = 2 as const;

// ────────────────────────────────────────────────────────────
// 1. RPE → RIR (max. 4 RIR)
// ────────────────────────────────────────────────────────────
export function getRIRFromRPE(rpe: number | null | undefined): number {
  if (rpe == null || !Number.isFinite(rpe)) return 0;
  if (rpe >= 10) return 0;
  if (rpe >= 9.5) return 0.5;
  if (rpe >= 9) return 1;
  if (rpe >= 8.5) return 1.5;
  if (rpe >= 8) return 2;
  if (rpe >= 7.5) return 2.5;
  if (rpe >= 7) return 3;
  if (rpe >= 6.5) return 3.5;
  return 4;
}

// ────────────────────────────────────────────────────────────
// 2. e1RM (roh + RPE-adjustiert, Epley)
// ────────────────────────────────────────────────────────────
export function calculateRawE1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export function calculateAdjustedE1RM(weight: number, reps: number, rpe: number): number {
  const rir = getRIRFromRPE(rpe);
  const estimatedMaxReps = reps + rir;
  return weight * (1 + estimatedMaxReps / 30);
}

// ────────────────────────────────────────────────────────────
// 3. Lineare Interpolation zwischen Benchmark-Ankern
// ────────────────────────────────────────────────────────────
type Anchor = { value: number; score: number };

export function interpolateScore(value: number, benchmarks: Anchor[]): number {
  const sorted = [...benchmarks].sort((a, b) => a.value - b.value);
  if (value <= sorted[0].value) {
    return Math.max(0, (value / sorted[0].value) * sorted[0].score);
  }
  if (value >= sorted[sorted.length - 1].value) return 100;
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (value >= lo.value && value <= hi.value) {
      const p = (value - lo.value) / (hi.value - lo.value);
      return lo.score + p * (hi.score - lo.score);
    }
  }
  return 0;
}

const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)));

// ────────────────────────────────────────────────────────────
// 4. Benchmarks pro Übung (ratio = adjE1RM / bodyweight)
// ────────────────────────────────────────────────────────────
const WEIGHTED_BENCHMARKS: Record<Exclude<StrengthTestKey, "plank">, Anchor[]> = {
  leg_press: [
    { value: 0.75, score: 20 },
    { value: 1.25, score: 35 },
    { value: 2.0, score: 50 },
    { value: 3.0, score: 70 },
    { value: 4.0, score: 85 },
    { value: 5.0, score: 100 },
  ],
  leg_curl: [
    { value: 0.25, score: 20 },
    { value: 0.4, score: 35 },
    { value: 0.6, score: 50 },
    { value: 0.8, score: 70 },
    { value: 1.0, score: 85 },
    { value: 1.2, score: 100 },
  ],
  chest_press: [
    { value: 0.5, score: 20 },
    { value: 0.75, score: 35 },
    { value: 1.0, score: 50 },
    { value: 1.25, score: 70 },
    { value: 1.5, score: 85 },
    { value: 1.8, score: 100 },
  ],
  shoulder_press: [
    { value: 0.25, score: 20 },
    { value: 0.4, score: 35 },
    { value: 0.55, score: 50 },
    { value: 0.75, score: 70 },
    { value: 1.0, score: 85 },
    { value: 1.25, score: 100 },
  ],
  lat_pulldown: [
    { value: 0.5, score: 20 },
    { value: 0.75, score: 35 },
    { value: 1.0, score: 50 },
    { value: 1.25, score: 70 },
    { value: 1.5, score: 85 },
    { value: 1.8, score: 100 },
  ],
  cable_row: [
    { value: 0.5, score: 20 },
    { value: 0.75, score: 35 },
    { value: 1.0, score: 50 },
    { value: 1.25, score: 70 },
    { value: 1.5, score: 85 },
    { value: 1.8, score: 100 },
  ],
};

const PLANK_BENCHMARKS: Anchor[] = [
  { value: 20, score: 20 },
  { value: 35, score: 35 },
  { value: 50, score: 50 },
  { value: 75, score: 70 },
  { value: 100, score: 85 },
  { value: 150, score: 100 },
];

// ────────────────────────────────────────────────────────────
// 5. Single-Exercise Score
// ────────────────────────────────────────────────────────────
export type ExerciseCalc = {
  testKey: StrengthTestKey;
  rawE1RM: number | null;
  adjustedE1RM: number | null;
  relativeStrength: number | null;
  exerciseScore: number | null;
  testStatus: "complete" | "incomplete";
};

export type RawResult = {
  test_key: StrengthTestKey;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  rpe: number | null;
};

export function calculateExerciseScore(
  r: RawResult,
  bodyweightKg: number | null,
): ExerciseCalc {
  const incomplete: ExerciseCalc = {
    testKey: r.test_key,
    rawE1RM: null,
    adjustedE1RM: null,
    relativeStrength: null,
    exerciseScore: null,
    testStatus: "incomplete",
  };

  if (r.test_key === "plank") {
    if (r.duration_seconds == null || r.duration_seconds <= 0 || r.rpe == null) return incomplete;
    const rir = getRIRFromRPE(r.rpe);
    const adjDur = r.duration_seconds * (1 + rir * 0.08);
    return {
      testKey: r.test_key,
      rawE1RM: null,
      adjustedE1RM: null,
      relativeStrength: null,
      exerciseScore: clamp(interpolateScore(adjDur, PLANK_BENCHMARKS)),
      testStatus: "complete",
    };
  }

  // Weighted lifts require weight, reps, rpe, bodyweight.
  const bw = bodyweightKg;
  if (
    r.weight_kg == null || r.weight_kg <= 0 ||
    r.reps == null || r.reps <= 0 ||
    r.rpe == null ||
    bw == null || bw <= 0
  ) return incomplete;

  const raw = calculateRawE1RM(r.weight_kg, r.reps);
  const adj = calculateAdjustedE1RM(r.weight_kg, r.reps, r.rpe);
  const ratio = adj / bw;
  const bench = WEIGHTED_BENCHMARKS[r.test_key];
  const score = clamp(interpolateScore(ratio, bench));

  return {
    testKey: r.test_key,
    rawE1RM: Math.round(raw * 100) / 100,
    adjustedE1RM: Math.round(adj * 100) / 100,
    relativeStrength: Math.round(ratio * 100) / 100,
    exerciseScore: score,
    testStatus: "complete",
  };
}

// ────────────────────────────────────────────────────────────
// 6. Dynamische Kategorie-Gewichtung
// ────────────────────────────────────────────────────────────
type WeightedItem = { score: number | null; weight: number };

function dynamicWeighted(items: WeightedItem[]): { score: number | null; confidence: number; used: number; total: number } {
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const valid = items.filter((i) => i.score != null && Number.isFinite(i.score));
  const usedWeight = valid.reduce((s, i) => s + i.weight, 0);
  if (usedWeight <= 0) return { score: null, confidence: 0, used: 0, total: items.length };
  const weighted = valid.reduce((s, i) => s + (i.score as number) * i.weight, 0) / usedWeight;
  return {
    score: Math.round(weighted),
    confidence: Math.round((usedWeight / totalWeight) * 100),
    used: valid.length,
    total: items.length,
  };
}

// ────────────────────────────────────────────────────────────
// 7. Category & Overall
// ────────────────────────────────────────────────────────────
export type CategoryKey = "lower" | "push" | "pull" | "core";

export type CategoryScore = {
  score: number | null;
  confidence: number; // %
  used: number;
  total: number;
};

export type CheckV2Result = {
  algorithmVersion: 2;
  bodyweightKg: number | null;
  exercises: Record<StrengthTestKey, ExerciseCalc>;
  categories: Record<CategoryKey, CategoryScore>;
  overall: CategoryScore;
};

export function computeCheckV2(
  results: RawResult[],
  bodyweightKg: number | null,
): CheckV2Result {
  const byKey: Partial<Record<StrengthTestKey, ExerciseCalc>> = {};
  const allKeys: StrengthTestKey[] = [
    "leg_press", "leg_curl", "chest_press", "shoulder_press",
    "lat_pulldown", "cable_row", "plank",
  ];
  for (const k of allKeys) {
    const r = results.find((x) => x.test_key === k);
    byKey[k] = r
      ? calculateExerciseScore(r, bodyweightKg)
      : {
          testKey: k, rawE1RM: null, adjustedE1RM: null,
          relativeStrength: null, exerciseScore: null, testStatus: "incomplete",
        };
  }

  const lower = dynamicWeighted([
    { score: byKey.leg_press!.exerciseScore, weight: 0.6 },
    { score: byKey.leg_curl!.exerciseScore, weight: 0.4 },
  ]);
  const push = dynamicWeighted([
    { score: byKey.chest_press!.exerciseScore, weight: 0.6 },
    { score: byKey.shoulder_press!.exerciseScore, weight: 0.4 },
  ]);
  const pull = dynamicWeighted([
    { score: byKey.lat_pulldown!.exerciseScore, weight: 0.5 },
    { score: byKey.cable_row!.exerciseScore, weight: 0.5 },
  ]);
  const core = dynamicWeighted([
    { score: byKey.plank!.exerciseScore, weight: 1 },
  ]);

  const overall = dynamicWeighted([
    { score: lower.score, weight: 0.30 },
    { score: push.score, weight: 0.25 },
    { score: pull.score, weight: 0.25 },
    { score: core.score, weight: 0.20 },
  ]);

  return {
    algorithmVersion: 2,
    bodyweightKg,
    exercises: byKey as Record<StrengthTestKey, ExerciseCalc>,
    categories: { lower, push, pull, core },
    overall,
  };
}

// ────────────────────────────────────────────────────────────
// 8. Score → Farbe / Label (zentral)
// ────────────────────────────────────────────────────────────
export type StrengthScoreColor =
  | "muted" | "red" | "orange" | "yellow" | "light-green" | "green" | "performance";

export function getStrengthScoreColor(score: number | null | undefined): StrengthScoreColor {
  if (score == null || !Number.isFinite(score)) return "muted";
  if (score < 35) return "red";
  if (score < 50) return "orange";
  if (score < 60) return "yellow";
  if (score < 70) return "light-green";
  if (score < 85) return "green";
  return "performance";
}

export const STRENGTH_SCORE_COLOR_HEX: Record<StrengthScoreColor, string> = {
  muted: "var(--muted-foreground)",
  red: "rgb(248 113 113)",         // red-400
  orange: "rgb(251 146 60)",        // orange-400
  yellow: "rgb(250 204 21)",        // yellow-400
  "light-green": "rgb(134 239 172)", // green-300
  green: "rgb(52 211 153)",         // emerald-400
  performance: "var(--gold, #d4a82e)",
};

export function getStrengthScoreLabel(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "—";
  if (score < 20) return "Sehr niedrig";
  if (score < 35) return "Niedrig";
  if (score < 50) return "Unterdurchschnittlich";
  if (score < 60) return "Solide Basis";
  if (score < 70) return "Überdurchschnittlich";
  if (score < 80) return "Stark";
  if (score < 90) return "Sehr stark";
  if (score < 95) return "Außergewöhnlich";
  return "Elite Performance";
}
