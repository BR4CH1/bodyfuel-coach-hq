import type { CalculationType, ResultStatus } from "./types";

export interface DerivedMetricInput {
  calculationType: CalculationType;
  /**
   * Config drives which inputs are read. The shape is intentionally narrow —
   * we do NOT accept free-form JS/SQL formulas.
   */
  config: {
    // direct: { input_metric_key }
    // ratio: { numerator_metric_key, denominator_metric_key }
    // percentage_difference: { a_metric_key, b_metric_key }
    // asymmetry: { left_metric_key, right_metric_key }
    // bodyweight_relative: { performance_metric_key, context_key }
    [k: string]: string | undefined;
  };
  /** Resolved raw metric values (key -> selected value). */
  metricValues: Record<string, number | null | undefined>;
  /** Resolved context snapshots (e.g. bodyweight_kg from the session, never re-read). */
  contextValues: Record<string, number | null | undefined>;
}

export interface DerivedMetricResult {
  status: ResultStatus;
  value: number | null;
  note?: string;
}

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Controlled calculation allowlist. `formula` is intentionally NOT executable in V1.
 */
export function calculateDerivedMetric(input: DerivedMetricInput): DerivedMetricResult {
  const { calculationType, config, metricValues, contextValues } = input;

  switch (calculationType) {
    case "direct": {
      const key = config.input_metric_key;
      if (!key) return { status: "CONFIGURATION_REQUIRED", value: null, note: "input_metric_key missing" };
      const v = num(metricValues[key]);
      if (v == null) return { status: "MISSING_INPUT", value: null };
      return { status: "OK", value: v };
    }
    case "ratio": {
      const a = num(metricValues[config.numerator_metric_key ?? ""]);
      const b = num(metricValues[config.denominator_metric_key ?? ""]);
      if (!config.numerator_metric_key || !config.denominator_metric_key) return { status: "CONFIGURATION_REQUIRED", value: null };
      if (a == null || b == null || b === 0) return { status: "MISSING_INPUT", value: null };
      return { status: "OK", value: a / b };
    }
    case "percentage_difference": {
      const a = num(metricValues[config.a_metric_key ?? ""]);
      const b = num(metricValues[config.b_metric_key ?? ""]);
      if (!config.a_metric_key || !config.b_metric_key) return { status: "CONFIGURATION_REQUIRED", value: null };
      if (a == null || b == null || b === 0) return { status: "MISSING_INPUT", value: null };
      return { status: "OK", value: ((a - b) / Math.abs(b)) * 100 };
    }
    case "asymmetry": {
      const l = num(metricValues[config.left_metric_key ?? ""]);
      const r = num(metricValues[config.right_metric_key ?? ""]);
      if (!config.left_metric_key || !config.right_metric_key) return { status: "CONFIGURATION_REQUIRED", value: null };
      if (l == null || r == null) return { status: "MISSING_INPUT", value: null };
      const max = Math.max(Math.abs(l), Math.abs(r));
      if (max === 0) return { status: "MISSING_INPUT", value: null };
      return { status: "OK", value: (Math.abs(l - r) / max) * 100 };
    }
    case "bodyweight_relative": {
      const perf = num(metricValues[config.performance_metric_key ?? ""]);
      const bw = num(contextValues[config.context_key ?? "bodyweight_kg"]);
      if (!config.performance_metric_key) return { status: "CONFIGURATION_REQUIRED", value: null };
      if (perf == null || bw == null || bw === 0) return { status: "MISSING_INPUT", value: null };
      return { status: "OK", value: perf / bw };
    }
    case "formula":
      return { status: "CONFIGURATION_REQUIRED", value: null, note: "formula calculation_type is not executable in V1" };
  }
}
