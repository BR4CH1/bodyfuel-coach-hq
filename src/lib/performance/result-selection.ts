import type { Direction, RawAttempt, ResultSelectionMethod, SelectedResult } from "./types";

/**
 * Pure result selection engine.
 *
 * Never mutates raw attempts. Only considers valid=true attempts.
 * `custom` is a reserved type — no free-form formula executed in V1.
 */
export function selectPerformanceResult(input: {
  attempts: RawAttempt[];
  method: ResultSelectionMethod;
  direction: Direction;
  unit?: string | null;
  targetRange?: { min: number; max: number } | null;
}): SelectedResult {
  const now = new Date().toISOString();
  const valid = input.attempts.filter((a) => a.valid);
  const unit = input.unit ?? valid[0]?.unit_snapshot ?? null;

  if (valid.length === 0) {
    return {
      status: "NO_VALID_ATTEMPTS",
      selected_value: null,
      unit,
      source_attempt_ids: [],
      selection_method: input.method,
      calculated_at: now,
    };
  }

  switch (input.method) {
    case "best": {
      if (input.direction === "target_range") {
        if (!input.targetRange) {
          return {
            status: "CONFIGURATION_REQUIRED",
            selected_value: null,
            unit,
            source_attempt_ids: valid.map((a) => a.id),
            selection_method: input.method,
            calculated_at: now,
            note: "target_range direction requires config.target_range { min, max }",
          };
        }
        // Pick attempt closest to midpoint of range
        const mid = (input.targetRange.min + input.targetRange.max) / 2;
        const best = valid.reduce((a, b) =>
          Math.abs(a.raw_value - mid) <= Math.abs(b.raw_value - mid) ? a : b,
        );
        return { status: "OK", selected_value: best.raw_value, unit, source_attempt_ids: [best.id], selection_method: "best", calculated_at: now };
      }
      const best =
        input.direction === "higher_is_better"
          ? valid.reduce((a, b) => (a.raw_value >= b.raw_value ? a : b))
          : valid.reduce((a, b) => (a.raw_value <= b.raw_value ? a : b));
      return { status: "OK", selected_value: best.raw_value, unit, source_attempt_ids: [best.id], selection_method: "best", calculated_at: now };
    }
    case "average": {
      const avg = valid.reduce((s, a) => s + Number(a.raw_value), 0) / valid.length;
      return { status: "OK", selected_value: avg, unit, source_attempt_ids: valid.map((a) => a.id), selection_method: "average", calculated_at: now };
    }
    case "median": {
      const sorted = [...valid].sort((a, b) => a.raw_value - b.raw_value);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0 ? (sorted[mid - 1].raw_value + sorted[mid].raw_value) / 2 : sorted[mid].raw_value;
      return { status: "OK", selected_value: median, unit, source_attempt_ids: valid.map((a) => a.id), selection_method: "median", calculated_at: now };
    }
    case "last": {
      const last = [...valid].sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()).at(-1)!;
      return { status: "OK", selected_value: last.raw_value, unit, source_attempt_ids: [last.id], selection_method: "last", calculated_at: now };
    }
    case "custom":
      return {
        status: "CONFIGURATION_REQUIRED",
        selected_value: null,
        unit,
        source_attempt_ids: valid.map((a) => a.id),
        selection_method: "custom",
        calculated_at: now,
        note: "custom selection is a reserved type — no formula runtime in V1",
      };
  }
}
