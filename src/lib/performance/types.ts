// Shared types for the BodyFuel Performance Engine V1.
// Kept small and pure — no DB imports so this module is safe on client + server.

export type Direction = "higher_is_better" | "lower_is_better" | "target_range";
export type ResultSelectionMethod = "best" | "average" | "median" | "last" | "custom";
export type CalculationType =
  | "direct"
  | "ratio"
  | "percentage_difference"
  | "asymmetry"
  | "bodyweight_relative"
  | "formula";

export type Trend = "improving" | "stable" | "declining" | "insufficient_data";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type ResultStatus =
  | "OK"
  | "NO_VALID_ATTEMPTS"
  | "CONFIGURATION_REQUIRED"
  | "MISSING_INPUT";

export interface RawAttempt {
  id: string;
  raw_value: number;
  unit_snapshot: string;
  valid: boolean;
  measured_at: string; // ISO timestamp
}

export interface SelectedResult {
  status: ResultStatus;
  selected_value: number | null;
  unit: string | null;
  source_attempt_ids: string[];
  selection_method: ResultSelectionMethod | null;
  calculated_at: string;
  note?: string;
}

export interface ChangeResult {
  raw_change: number | null;
  percentage_change: number | null;
  performance_change_percentage: number | null;
  direction: Direction;
  trend: Trend;
}

export interface MetricScoreResult {
  status: "OK" | "BASELINE" | "INSUFFICIENT_BENCHMARK_DATA" | "MISSING_INPUT" | "CONFIGURATION_REQUIRED";
  score: number | null; // 0..100 presentation scale
  benchmark_model_id: string | null;
  benchmark_version: number | null;
  sample_size: number | null;
  comparison_group: Record<string, unknown>;
}
