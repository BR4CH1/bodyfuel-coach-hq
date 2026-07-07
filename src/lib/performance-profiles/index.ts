import type { PerformanceProfile, PerformanceTest, PositionGroup, TestResult, ModuleId } from "./types";
import { footballBullsProfile } from "./football-bulls";

const registry: Record<string, PerformanceProfile> = {
  [footballBullsProfile.id]: footballBullsProfile,
};

export function getProfile(id: string): PerformanceProfile | null {
  return registry[id] ?? null;
}

export function getPositionGroup(profile: PerformanceProfile, position?: string | null): PositionGroup | null {
  if (!position) return null;
  return profile.positions[position.toUpperCase()] ?? null;
}

export function findTest(profile: PerformanceProfile, moduleId: string, testId: string): PerformanceTest | null {
  const mod = profile.modules.find((m) => m.id === moduleId);
  if (!mod) return null;
  return mod.tests.find((t) => t.id === testId) ?? null;
}

/** Interpolated 0..100 score for a test value using position-group anchors. */
export function scoreTestValue(test: PerformanceTest, value: number, group: PositionGroup | null): number | null {
  if (!group) return null;
  const bench = test.benchmarks[group];
  if (!bench) return null;
  const [lo, hi] = bench;
  if (lo === hi) return 50;
  // Map linearly, then clamp 0..100. lo maps to 0, hi maps to 100.
  // For lower_is_better: lo > hi so a lower value scores higher naturally.
  const pct = ((value - lo) / (hi - lo)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Effective value used for scoring — respects coach corrections. */
export function effectiveValue(result: TestResult): number {
  return result.coach_corrected_value != null ? Number(result.coach_corrected_value) : Number(result.result_value);
}

/** Choose the best (verified) result per test according to direction. */
export function bestResultPerTest(
  profile: PerformanceProfile,
  results: TestResult[],
  { requireVerified = true }: { requireVerified?: boolean } = {},
): Record<string, TestResult> {
  const best: Record<string, TestResult> = {};
  for (const r of results) {
    if (requireVerified && !(r.verification_status === "verified" || r.verification_status === "corrected")) continue;
    const test = findTest(profile, r.module_id, r.test_id);
    if (!test) continue;
    const key = r.test_id;
    const currentBest = best[key];
    if (!currentBest) { best[key] = r; continue; }
    const v = effectiveValue(r);
    const cv = effectiveValue(currentBest);
    if (test.direction === "lower_is_better" ? v < cv : v > cv) best[key] = r;
  }
  return best;
}

export interface ModuleScoreOut {
  moduleId: ModuleId;
  score: number | null;
  testsDone: number;
  testsTotal: number;
  verifiedCount: number;
}

export interface OverallScoreOut {
  overall: number | null;
  positionGroup: PositionGroup | null;
  modules: ModuleScoreOut[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export function computeOverallScore(
  profile: PerformanceProfile,
  position: string | null,
  results: TestResult[],
): OverallScoreOut {
  const group = getPositionGroup(profile, position);
  const bestVerified = bestResultPerTest(profile, results, { requireVerified: true });
  const modules: ModuleScoreOut[] = profile.modules.map((mod) => {
    const total = mod.tests.length;
    let done = 0, sum = 0, count = 0;
    for (const t of mod.tests) {
      const r = bestVerified[t.id];
      if (!r) continue;
      done += 1;
      const s = scoreTestValue(t, effectiveValue(r), group);
      if (s != null) { sum += s; count += 1; }
    }
    return {
      moduleId: mod.id,
      score: count > 0 ? Math.round(sum / count) : null,
      testsDone: done,
      testsTotal: total,
      verifiedCount: done,
    };
  });

  let overall: number | null = null;
  if (group) {
    const w = profile.moduleWeights[group];
    let sum = 0, wsum = 0;
    for (const m of modules) {
      if (m.score == null) continue;
      const weight = w[m.moduleId];
      sum += m.score * weight;
      wsum += weight;
    }
    if (wsum > 0) overall = Math.round(sum / wsum);
  }

  // Confidence
  const totalTests = profile.modules.reduce((s, m) => s + m.tests.length, 0);
  const doneRatio = modules.reduce((s, m) => s + m.testsDone, 0) / totalTests;
  let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";
  if (doneRatio >= 0.8 && group) confidence = "HIGH";
  else if (doneRatio >= 0.5) confidence = "MEDIUM";

  return { overall, positionGroup: group, modules, confidence };
}

export * from "./types";
export { footballBullsProfile };
