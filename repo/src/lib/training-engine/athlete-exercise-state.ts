import type { ProgressionDecision } from "./progression";

/** Normalize an exercise name to a stable "family" key.
 *  Lowercase, strip diacritics/punctuation, collapse whitespace, drop side markers.
 */
export function normalizeExerciseKey(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(left|right|links|rechts|einarmig|einbein|unilateral|obere|untere)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}

export function parseRepRange(range: string | null | undefined): { min: number; max: number } {
  const s = String(range ?? "").replace(/[–—]/g, "-").trim();
  const m = s.match(/(\d+)\s*-\s*(\d+)/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const single = s.match(/^\d+$/);
  if (single) return { min: Number(s), max: Number(s) };
  return { min: 8, max: 12 };
}

/** Map a progression decision to the fields we persist in athlete_exercise_state. */
export function stateFromDecision(args: {
  exerciseName: string;
  repRange: string | null | undefined;
  decision: ProgressionDecision;
  /**
   * Optional Readiness-Kontext. `gateActive` = das aktuelle Gate hat die
   * Entscheidung tatsächlich verändert. `cooldownActive` = innerhalb der
   * 7-Tage-Nachwehen nach dem letzten harten Gate (auch ohne akutes Gate).
   */
  readiness?: {
    gateActive: boolean;
    cooldownActive: boolean;
    gateSeverity?: "hold" | "reduce" | null;
  };
}): {
  progression_status: "progressing" | "holding" | "deloading" | "stalled";
  confidence: "low" | "medium" | "high";
  trend: "up" | "flat" | "down";
  recommended_next_load: number | null;
  target_rep_min: number;
  target_rep_max: number;
  last_decision: string;
  last_reason: string;
} {
  const rr = parseRepRange(args.repRange);
  const d = args.decision;
  let status: "progressing" | "holding" | "deloading" | "stalled" = "holding";
  let trend: "up" | "flat" | "down" = "flat";
  switch (d.action) {
    case "increase_load":
    case "increase_reps_target":
      status = "progressing";
      trend = "up";
      break;
    case "reduce_load":
    case "reduce_volume":
      status = "deloading";
      trend = "down";
      break;
    case "keep_load":
      status = "holding";
      trend = "flat";
      break;
    case "hold_for_more_data":
      status = "holding";
      trend = "flat";
      break;
  }
  // Confidence: high when we have a real load, medium on keep, low on hold_for_more_data
  let confidence: "low" | "medium" | "high" = "medium";
  if (d.action === "hold_for_more_data") confidence = "low";
  else if (d.action === "increase_load" || d.action === "reduce_load") confidence = "high";

  // Phase 6 — Confidence-Cap + Cooldown:
  //  · Aktives hartes Gate (reduce)       → cap "low"
  //  · Aktives weiches Gate (hold)        → cap "medium"
  //  · Cooldown (7d nach letztem harten Gate, kein akutes Gate)
  //                                       → cap "medium"
  let reasonSuffix = "";
  if (args.readiness?.gateActive) {
    if (args.readiness.gateSeverity === "reduce" && confidence !== "low") {
      confidence = "low";
      reasonSuffix = " · Confidence gedeckelt (aktive harte Bremse).";
    } else if (
      args.readiness.gateSeverity === "hold" &&
      confidence === "high"
    ) {
      confidence = "medium";
      reasonSuffix = " · Confidence gedeckelt (aktive weiche Bremse).";
    }
  } else if (args.readiness?.cooldownActive && confidence === "high") {
    confidence = "medium";
    reasonSuffix = " · Confidence gedeckelt (Gate-Cooldown, 7 Tage Nachwirkung).";
  }

  return {
    progression_status: status,
    confidence,
    trend,
    recommended_next_load: d.next_load,
    target_rep_min: rr.min,
    target_rep_max: rr.max,
    last_decision: d.action,
    last_reason: d.reason + reasonSuffix,
  };
}

/**
 * Cooldown-Erkennung: gab es innerhalb der letzten 7 Tage ein hartes Gate
 * (readiness_gate = "reduce") für diesen Athleten?
 * `gateDates` ist eine Liste von ISO-Datums-Strings (source_session_date)
 * jener Events, die zuletzt zum Athleten gehören.
 */
export function readinessCooldownActive(
  hardGateSessionDates: string[],
  now: Date = new Date(),
): boolean {
  if (!hardGateSessionDates.length) return false;
  const cutoff = now.getTime() - 7 * 86400000;
  for (const d of hardGateSessionDates) {
    const t = new Date(d + "T00:00:00Z").getTime();
    if (!Number.isFinite(t)) continue;
    if (t >= cutoff) return true;
  }
  return false;
}
