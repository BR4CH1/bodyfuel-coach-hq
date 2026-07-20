import type { ChangeResult, Direction, Trend } from "./types";

/**
 * Direction-aware longitudinal change.
 *
 * higher_is_better: improvement = (new - prev) / prev
 * lower_is_better:  improvement = (prev - new) / prev
 * target_range:     improvement = proximity_to_range(prev) − proximity_to_range(new) (positive = improvement)
 *
 * `performance_change_percentage` is the direction-aware value (positive = improvement).
 * `raw_change` and `percentage_change` are the plain math (no direction applied).
 * `stableThreshold` defaults to 2 % if the framework has not configured one — do not
 * present that as a scientific norm; it's a UI-only tolerance.
 */
export function calculateDirectionAwareChange(input: {
  previousValue: number | null;
  currentValue: number | null;
  direction: Direction;
  targetRange?: { min: number; max: number } | null;
  /** Absolute percentage threshold under which trend = "stable". Default 2. */
  stableThreshold?: number;
}): ChangeResult {
  const { previousValue, currentValue, direction } = input;
  const stableThreshold = input.stableThreshold ?? 2;

  if (previousValue == null || currentValue == null || previousValue === 0) {
    return {
      raw_change: null,
      percentage_change: null,
      performance_change_percentage: null,
      direction,
      trend: "insufficient_data",
    };
  }

  const raw_change = currentValue - previousValue;
  const percentage_change = (raw_change / Math.abs(previousValue)) * 100;

  let performance_change_percentage: number;
  if (direction === "higher_is_better") {
    performance_change_percentage = percentage_change;
  } else if (direction === "lower_is_better") {
    performance_change_percentage = -percentage_change;
  } else {
    // target_range: closer to range midpoint = better
    if (!input.targetRange) {
      return { raw_change, percentage_change, performance_change_percentage: null, direction, trend: "insufficient_data" };
    }
    const mid = (input.targetRange.min + input.targetRange.max) / 2;
    const prevDist = Math.abs(previousValue - mid);
    const currDist = Math.abs(currentValue - mid);
    performance_change_percentage = prevDist === 0 ? 0 : ((prevDist - currDist) / prevDist) * 100;
  }

  let trend: Trend;
  if (Math.abs(performance_change_percentage) < stableThreshold) trend = "stable";
  else if (performance_change_percentage > 0) trend = "improving";
  else trend = "declining";

  return { raw_change, percentage_change, performance_change_percentage, direction, trend };
}
