import { selectPerformanceResult } from "./result-selection";
import type { Direction, RawAttempt, ResultSelectionMethod, SelectedResult } from "./types";

/**
 * Test-level result computation wrapper.
 *
 * Respects test.config.required_valid_attempts (exact match) and
 * test.config.max_valid_attempts (upper bound). Used by both live UI and
 * the completion pipeline so RAST-style rules are enforced consistently.
 */
export type TestConfig = {
  required_valid_attempts?: number | null;
  max_valid_attempts?: number | null;
  recommended_attempts?: number | null;
  target_range?: { min: number; max: number } | null;
};

export type TestResultStatus =
  | "OK"
  | "INCOMPLETE"
  | "REVIEW_REQUIRED"
  | "NO_VALID_ATTEMPTS"
  | "PROVISIONAL"
  | "CONFIGURATION_REQUIRED";

export type TestResult = SelectedResult & {
  test_status: TestResultStatus;
  valid_count: number;
  required_valid_attempts: number | null;
  recommended_attempts: number | null;
  incomplete_reason?: string;
};

export function computeTestResult(input: {
  attempts: RawAttempt[];
  method: ResultSelectionMethod;
  direction: Direction;
  unit?: string | null;
  config?: TestConfig | null;
}): TestResult {
  const cfg = input.config ?? {};
  const validCount = input.attempts.filter((a) => a.valid).length;
  const required = cfg.required_valid_attempts ?? null;
  const max = cfg.max_valid_attempts ?? null;
  const recommended = cfg.recommended_attempts ?? null;

  const base = selectPerformanceResult({
    attempts: input.attempts,
    method: input.method,
    direction: input.direction,
    unit: input.unit,
    targetRange: cfg.target_range ?? null,
  });

  // Hard rule: too many valid attempts → coach must review/invalidate.
  if (max != null && validCount > max) {
    return {
      ...base,
      test_status: "REVIEW_REQUIRED",
      valid_count: validCount,
      required_valid_attempts: required,
      recommended_attempts: recommended,
      incomplete_reason: `Mehr als ${max} gültige Attempts — bitte überschüssige Attempts invalidieren.`,
    };
  }

  // Hard rule: exact required count → below is INCOMPLETE with provisional value.
  if (required != null) {
    if (validCount < required) {
      return {
        ...base,
        test_status: validCount > 0 ? "PROVISIONAL" : "INCOMPLETE",
        valid_count: validCount,
        required_valid_attempts: required,
        recommended_attempts: recommended,
        incomplete_reason: `Nur ${validCount}/${required} gültige Attempts — kein finales Ergebnis.`,
      };
    }
    if (validCount > required) {
      return {
        ...base,
        test_status: "REVIEW_REQUIRED",
        valid_count: validCount,
        required_valid_attempts: required,
        recommended_attempts: recommended,
        incomplete_reason: `Mehr als ${required} gültige Attempts — Coach muss review durchführen.`,
      };
    }
  }

  const status: TestResultStatus =
    base.status === "OK" ? "OK" : base.status === "NO_VALID_ATTEMPTS" ? "NO_VALID_ATTEMPTS" : "CONFIGURATION_REQUIRED";

  return {
    ...base,
    test_status: status,
    valid_count: validCount,
    required_valid_attempts: required,
    recommended_attempts: recommended,
  };
}
