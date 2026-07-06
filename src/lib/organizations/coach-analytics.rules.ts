export type AthleteSignal = {
  user_id: string;
  name: string;
  position: string | null;
  team_id: string | null;
  team_name: string | null;
  compliance: number | null;
  prev_compliance: number | null;
  compliance_delta: number | null;
  days_inactive: number | null;
  onboarding_completed: boolean;
};

export type AthleteStatus = "critical" | "attention" | "watch" | "stable" | "positive";

/**
 * Klassifikation eines Athleten. Regel-Reihenfolge = Priorität.
 * Werte, für die Datenlage fehlt, führen zu "watch" (nicht "critical").
 */
export function classifyAthlete(s: AthleteSignal): AthleteStatus {
  if (s.days_inactive != null && s.days_inactive >= 14) return "critical";
  if (s.compliance != null && s.compliance < 30) return "critical";
  if (s.compliance_delta != null && s.compliance_delta <= -25) return "critical";

  if (s.days_inactive != null && s.days_inactive >= 7) return "attention";
  if (s.compliance != null && s.compliance < 50) return "attention";
  if (s.compliance_delta != null && s.compliance_delta <= -10) return "attention";

  if (s.compliance_delta != null && s.compliance_delta >= 20) return "positive";
  if (s.compliance != null && s.compliance >= 80) return "positive";

  if (s.compliance == null && s.days_inactive == null) return "watch";
  return "stable";
}

/** Sortierte Attention-Liste (kritisch zuerst). */
export function buildAttentionList(signals: AthleteSignal[]): AthleteSignal[] {
  const priority: Record<AthleteStatus, number> = {
    critical: 0, attention: 1, watch: 2, stable: 3, positive: 4,
  };
  return [...signals].sort((a, b) => {
    const pa = priority[classifyAthlete(a)];
    const pb = priority[classifyAthlete(b)];
    if (pa !== pb) return pa - pb;
    // Innerhalb gleicher Priorität: schlechtere Compliance zuerst
    const ca = a.compliance ?? 101;
    const cb = b.compliance ?? 101;
    return ca - cb;
  });
}

export const STATUS_LABEL: Record<AthleteStatus, string> = {
  critical: "Kritisch",
  attention: "Aufmerksamkeit",
  watch: "Beobachten",
  stable: "Stabil",
  positive: "Positiv",
};
