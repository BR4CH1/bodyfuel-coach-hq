import type { Confidence, Direction, MetricScoreResult } from "./types";

// ============================================================
// METRIC SCORE (0..100 presentation scale)
// ============================================================

export interface InternalBenchmarkInput {
  benchmarkModelId: string;
  benchmarkVersion: number;
  minimumSampleSize: number;
  /** All selected values for the same metric within the comparison group (org/team/position/age). */
  peerValues: number[];
  /** Athlete's own selected value. */
  value: number;
  direction: Direction;
  comparisonGroup: Record<string, unknown>;
}

/**
 * Compute a 0..100 percentile-rank score against an internal benchmark's peer values.
 *
 * Semantics: 0..100 is a presentation scale, NOT "% Leistungsfähigkeit".
 * Below minimum_sample_size we return status=INSUFFICIENT_BENCHMARK_DATA and no score.
 */
export function calculateMetricScoreInternal(input: InternalBenchmarkInput): MetricScoreResult {
  const { peerValues, minimumSampleSize, value, direction, benchmarkModelId, benchmarkVersion, comparisonGroup } = input;
  const clean = peerValues.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (clean.length < Math.max(1, minimumSampleSize)) {
    return {
      status: "INSUFFICIENT_BENCHMARK_DATA",
      score: null,
      benchmark_model_id: benchmarkModelId,
      benchmark_version: benchmarkVersion,
      sample_size: clean.length,
      comparison_group: comparisonGroup,
    };
  }
  // Percentile rank of `value` within `clean`.
  const better = clean.filter((v) => (direction === "higher_is_better" ? v < value : direction === "lower_is_better" ? v > value : false)).length;
  const equal = clean.filter((v) => v === value).length;
  // Standard percentile-rank formula (mid-rank for ties)
  const pr = ((better + 0.5 * equal) / clean.length) * 100;
  const score = Math.max(0, Math.min(100, pr));
  return {
    status: "OK",
    score,
    benchmark_model_id: benchmarkModelId,
    benchmark_version: benchmarkVersion,
    sample_size: clean.length,
    comparison_group: comparisonGroup,
  };
}

// ============================================================
// DOMAIN SCORE
// ============================================================

export interface DomainScoreInput {
  /** Metrics contributing to this domain with their score and configured weight. */
  metrics: Array<{
    metric_definition_id: string;
    score: number | null;
    weight: number; // configured domain weight, need not sum to 100
    required?: boolean;
  }>;
}

export interface DomainScoreResult {
  score: number | null;
  data_coverage: number; // 0..1 (present required metrics with a score / required metrics)
  contributing: Array<{ metric_definition_id: string; score: number | null; weight: number }>;
}

export function calculateDomainScore(input: DomainScoreInput): DomainScoreResult {
  const scored = input.metrics.filter((m) => typeof m.score === "number" && Number.isFinite(m.score!));
  const totalWeight = scored.reduce((s, m) => s + m.weight, 0);
  const required = input.metrics.filter((m) => m.required);
  const requiredWithScore = required.filter((m) => typeof m.score === "number");
  const data_coverage = required.length === 0 ? (scored.length > 0 ? 1 : 0) : requiredWithScore.length / required.length;
  const score = totalWeight > 0 ? scored.reduce((s, m) => s + m.score! * m.weight, 0) / totalWeight : null;
  return { score, data_coverage, contributing: input.metrics.map((m) => ({ metric_definition_id: m.metric_definition_id, score: m.score, weight: m.weight })) };
}

// ============================================================
// OVERALL PROFILE
// ============================================================

export interface OverallProfileInput {
  /** Position-domain weights active for this athlete. */
  domains: Array<{ domain_id: string; score: number | null; weight: number; coverage: number }>;
  /** Position profile must be status=active for a final overall score. */
  positionProfileActive: boolean;
  /** Coverage floor below which we refuse to compute an overall score. */
  minimumCoverage?: number; // default 0.5
}

export interface OverallProfileResult {
  status: "OK" | "POSITION_PROFILE_SETUP_REQUIRED" | "INSUFFICIENT_PERFORMANCE_DATA";
  score: number | null;
  data_coverage: number;
}

export function calculateOverallPerformanceProfile(input: OverallProfileInput): OverallProfileResult {
  if (!input.positionProfileActive) {
    return { status: "POSITION_PROFILE_SETUP_REQUIRED", score: null, data_coverage: 0 };
  }
  const eligible = input.domains.filter((d) => typeof d.score === "number");
  const totalW = eligible.reduce((s, d) => s + d.weight, 0);
  const coverage = input.domains.length === 0 ? 0 : input.domains.reduce((s, d) => s + d.coverage * d.weight, 0) / (input.domains.reduce((s, d) => s + d.weight, 0) || 1);
  const floor = input.minimumCoverage ?? 0.5;
  if (totalW === 0 || coverage < floor) {
    return { status: "INSUFFICIENT_PERFORMANCE_DATA", score: null, data_coverage: coverage };
  }
  const score = eligible.reduce((s, d) => s + d.score! * d.weight, 0) / totalW;
  return { status: "OK", score, data_coverage: coverage };
}

// ============================================================
// COVERAGE + CONFIDENCE
// ============================================================

export interface ConfidenceInput {
  dataCoverage: number; // 0..1
  requiredMetricsCoverage: number; // 0..1
  testRecencyDays: number | null;
  retestWindowDays: number | null;
  benchmarkSampleSize: number | null;
  benchmarkMinSampleSize: number | null;
  positionProfileActive: boolean;
}

export interface ConfidenceResult {
  level: Confidence;
  breakdown: {
    data_coverage: number;
    required_metrics: number;
    test_recency: "CURRENT" | "STALE" | "UNKNOWN";
    benchmark_sample: "SUFFICIENT" | "INSUFFICIENT" | "UNKNOWN";
    position_profile: "ACTIVE" | "DRAFT";
  };
}

export function calculateProfileConfidence(input: ConfidenceInput): ConfidenceResult {
  const testRecency: ConfidenceResult["breakdown"]["test_recency"] =
    input.testRecencyDays == null || input.retestWindowDays == null
      ? "UNKNOWN"
      : input.testRecencyDays <= input.retestWindowDays
        ? "CURRENT"
        : "STALE";
  const benchmarkSample: ConfidenceResult["breakdown"]["benchmark_sample"] =
    input.benchmarkSampleSize == null || input.benchmarkMinSampleSize == null
      ? "UNKNOWN"
      : input.benchmarkSampleSize >= 2 * input.benchmarkMinSampleSize
        ? "SUFFICIENT"
        : "INSUFFICIENT";
  const breakdown = {
    data_coverage: input.dataCoverage,
    required_metrics: input.requiredMetricsCoverage,
    test_recency: testRecency,
    benchmark_sample: benchmarkSample,
    position_profile: (input.positionProfileActive ? "ACTIVE" : "DRAFT") as "ACTIVE" | "DRAFT",
  };

  let level: Confidence = "LOW";
  if (
    input.dataCoverage >= 0.8 &&
    testRecency === "CURRENT" &&
    benchmarkSample === "SUFFICIENT" &&
    input.positionProfileActive
  ) {
    level = "HIGH";
  } else if (input.dataCoverage >= 0.6 && benchmarkSample !== "INSUFFICIENT") {
    level = "MEDIUM";
  }
  return { level, breakdown };
}

export function calculateProfileDataCoverage(input: {
  requiredMetricsPresent: number;
  requiredMetricsTotal: number;
}): number {
  if (input.requiredMetricsTotal === 0) return 0;
  return input.requiredMetricsPresent / input.requiredMetricsTotal;
}
