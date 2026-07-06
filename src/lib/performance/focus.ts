import type { Trend } from "./types";

export interface FocusInput {
  domains: Array<{
    domain_id: string;
    domain_name: string;
    score: number | null;
    coverage: number;
    position_weight: number;
    trend: Trend | null;
  }>;
  /** Existing coach-authored focus entries — never removed by the engine. */
  coachOverrides: Array<{ domain_id?: string | null; metric_definition_id?: string | null; label: string; priority: number; status: string }>;
}

export interface FocusOutput {
  engine: Array<{
    domain_id: string;
    label: string;
    priority: number;
    reason_codes: string[];
    confidence: "HIGH" | "MEDIUM" | "LOW";
  }>;
}

/**
 * Rule-based V1 focus derivation. No black-box scoring.
 *
 * Priority signal = position_weight × (1 − score/100) + trend penalty − confidence penalty.
 * Only domains with enough data (score present, coverage ≥ 0.5, position_weight > 0)
 * are eligible. Coach overrides are not consumed here — the caller merges them.
 */
export function deriveDevelopmentFocusAreas(input: FocusInput): FocusOutput {
  const eligible = input.domains.filter(
    (d) => typeof d.score === "number" && d.coverage >= 0.5 && d.position_weight > 0,
  );

  const scored = eligible.map((d) => {
    const gap = 1 - (d.score! / 100);
    const trendPenalty = d.trend === "declining" ? 0.1 : 0;
    const signal = d.position_weight * gap + trendPenalty;
    const reasons: string[] = [];
    if (d.position_weight >= 0.15) reasons.push("HIGH_POSITION_IMPORTANCE");
    if (d.score! < 50) reasons.push("BELOW_INTERNAL_PROFILE");
    if (d.trend === "declining") reasons.push("NEGATIVE_TREND");
    if (d.trend === "stable" && d.score! < 60) reasons.push("STAGNANT_TREND");
    const confidence: FocusOutput["engine"][number]["confidence"] = d.coverage >= 0.8 ? "HIGH" : d.coverage >= 0.6 ? "MEDIUM" : "LOW";
    return { domain_id: d.domain_id, label: d.domain_name, signal, reason_codes: reasons, confidence };
  });

  scored.sort((a, b) => b.signal - a.signal);
  return {
    engine: scored.slice(0, 5).map((s, i) => ({
      domain_id: s.domain_id,
      label: s.label,
      priority: i + 1,
      reason_codes: s.reason_codes,
      confidence: s.confidence,
    })),
  };
}
