import type { ProgressionDecision } from "./progression";

export type SmartLock = "none" | "locked" | "weight_only" | "reps_only" | "volume_only";

/**
 * Respect the coach's smart_lock setting on the exercise instance.
 * Rewrites a ProgressionDecision into a "keep_load" no-op when the lock
 * forbids the intended change.
 */
export function applySmartLock(
  decision: ProgressionDecision,
  lock: SmartLock | null | undefined,
): ProgressionDecision {
  const l: SmartLock = (lock ?? "none") as SmartLock;
  if (l === "none") return decision;

  const nope = (reason: string): ProgressionDecision => ({
    ...decision,
    action: "keep_load",
    next_load: decision.previous_load,
    next_target_weights: null,
    next_target_reps: null,
    reason: `Coach-Lock (${l}): ${reason} · Original-Entscheidung: ${decision.reason}`,
  });

  if (l === "locked") return nope("Übung ist gesperrt");

  switch (decision.action) {
    case "increase_load":
    case "reduce_load":
      return l === "weight_only" ? decision : nope("Nur diese Dimension darf angepasst werden");
    case "increase_reps_target":
      return l === "reps_only" ? decision : nope("Nur diese Dimension darf angepasst werden");
    case "reduce_volume":
      return l === "volume_only" ? decision : nope("Nur diese Dimension darf angepasst werden");
    case "keep_load":
    case "hold_for_more_data":
      return decision;
    default:
      return decision;
  }
}
