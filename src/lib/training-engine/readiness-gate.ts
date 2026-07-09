// Readiness-Gate für die Progressionsentscheidung.
// Nutzt die zentrale Readiness-SoT aus src/lib/readiness. Verändert eine
// bestehende Progressionsentscheidung konservativ — startet KEINE parallele
// Plan-Engine, sondern moduliert nur, wenn der Athlet aktuell erhöhte
// Belastung / Beschwerden / niedrige Readiness zeigt.

import { summarize, type ReadinessCheckin } from "@/lib/readiness";
import type { ProgressionDecision } from "./progression";

export type ReadinessGateContext = {
  /** Warum das Gate ausgelöst hat, z. B. "avg7=38", "pain_events_7=3". */
  reason: string;
  severity: "hold" | "reduce";
};

/** Entscheidet, ob & wie die Progression durch aktuelle Readiness gedämpft wird. */
export function evaluateReadinessGate(rows: ReadinessCheckin[]): ReadinessGateContext | null {
  if (!rows || rows.length === 0) return null;
  const s = summarize(rows);

  // Harte Bremse: sehr niedrige 7-Tage-Readiness ODER >=3 Schmerz-Meldungen
  if ((s.avg7 != null && s.avg7 < 30) || s.pain_events_7 >= 3) {
    return {
      reason:
        s.pain_events_7 >= 3
          ? `${s.pain_events_7} Schmerz-Meldungen in 7 Tagen`
          : `Ø Readiness 7d = ${s.avg7}`,
      severity: "reduce",
    };
  }

  // Weiche Bremse: niedrige Readiness, ≥2 Schmerzmeldungen oder steigende Belastung
  if (
    (s.avg7 != null && s.avg7 < 45) ||
    s.pain_events_7 >= 2 ||
    s.load_trend === "rising" ||
    (s.delta7v30 != null && s.delta7v30 <= -10)
  ) {
    const bits: string[] = [];
    if (s.avg7 != null && s.avg7 < 45) bits.push(`Ø Readiness 7d = ${s.avg7}`);
    if (s.pain_events_7 >= 2) bits.push(`${s.pain_events_7} Schmerzmeldungen 7d`);
    if (s.load_trend === "rising") bits.push("Belastungstrend steigt");
    if (s.delta7v30 != null && s.delta7v30 <= -10)
      bits.push(`Readiness ${s.delta7v30} unter 30-Tage-Schnitt`);
    return { reason: bits.join(", "), severity: "hold" };
  }

  return null;
}

/** Wendet das Gate auf eine Progressionsentscheidung an (pure). */
export function applyReadinessGate(
  decision: ProgressionDecision,
  gate: ReadinessGateContext | null,
): ProgressionDecision {
  if (!gate) return decision;

  // Bereits konservative Aktionen — nichts zu tun.
  if (
    decision.action === "reduce_load" ||
    decision.action === "reduce_volume" ||
    decision.action === "hold_for_more_data"
  ) {
    return {
      ...decision,
      reason: `${decision.reason} · Readiness bestätigt Vorsicht (${gate.reason}).`,
    };
  }

  // Harte Bremse: Load-Steigerung → auf halten. Reduce-Load bauen wir NICHT
  // aktiv ein (kein doppeltes Engine-Verhalten).
  if (gate.severity === "reduce") {
    if (decision.action === "increase_load") {
      const prev = decision.previous_load;
      return {
        action: "keep_load",
        previous_load: prev,
        next_load: prev,
        next_target_weights:
          prev != null
            ? Array(Math.max(1, (decision.next_target_weights?.split(",").length ?? 1)))
                .fill(Number.isInteger(prev) ? String(prev) : prev.toFixed(1))
                .join(",")
            : decision.next_target_weights,
        next_target_reps: null,
        reason: `Progression pausiert wegen niedriger Readiness (${gate.reason}). Gewicht wird gehalten.`,
      };
    }
    if (decision.action === "increase_reps_target") {
      return {
        action: "keep_load",
        previous_load: decision.previous_load,
        next_load: decision.next_load,
        next_target_weights: decision.next_target_weights,
        next_target_reps: null,
        reason: `Rep-Progression pausiert wegen niedriger Readiness (${gate.reason}).`,
      };
    }
  }

  // Weiche Bremse: Steigerung → halten. Sonst durchlassen.
  if (gate.severity === "hold" && decision.action === "increase_load") {
    const prev = decision.previous_load;
    return {
      action: "keep_load",
      previous_load: prev,
      next_load: prev,
      next_target_weights:
        prev != null
          ? Array(Math.max(1, (decision.next_target_weights?.split(",").length ?? 1)))
              .fill(Number.isInteger(prev) ? String(prev) : prev.toFixed(1))
              .join(",")
          : decision.next_target_weights,
      next_target_reps: null,
      reason: `Steigerung aufgeschoben — ${gate.reason}. Gewicht halten und Readiness beobachten.`,
    };
  }

  if (gate.severity === "hold" && decision.action === "increase_reps_target") {
    return {
      ...decision,
      action: "keep_load",
      next_target_reps: null,
      reason: `Rep-Steigerung aufgeschoben — ${gate.reason}.`,
    };
  }

  return decision;
}
