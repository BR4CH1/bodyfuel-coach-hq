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

export type AthleteTrigger = { kind: string; label: string; detail: string };

/**
 * Erklärt die Klassifikation regelbasiert.
 * Einzige Wahrheit für Coach Radar / Aufmerksamkeitsliste / Drilldown-Trigger.
 * Reihenfolge bleibt mit `classifyAthlete` konsistent.
 */
export function explainAthlete(s: AthleteSignal): AthleteTrigger[] {
  const t: AthleteTrigger[] = [];
  if (s.days_inactive != null && s.days_inactive >= 14) {
    t.push({ kind: "inactivity_critical", label: "Inaktivität", detail: `${s.days_inactive} Tage keine Aktivität` });
  } else if (s.days_inactive != null && s.days_inactive >= 7) {
    t.push({ kind: "inactivity", label: "Inaktivität", detail: `${s.days_inactive} Tage keine Aktivität` });
  }
  if (s.compliance != null && s.compliance < 30) {
    t.push({ kind: "compliance_critical", label: "Compliance", detail: `nur ${s.compliance} % in dieser Woche` });
  } else if (s.compliance != null && s.compliance < 50) {
    t.push({ kind: "compliance_low", label: "Compliance", detail: `nur ${s.compliance} % in dieser Woche` });
  }
  if (s.compliance_delta != null && s.compliance_delta <= -25) {
    t.push({ kind: "compliance_drop_critical", label: "Compliance ↓", detail: `${s.compliance_delta} Prozentpunkte ggü. Vorwoche` });
  } else if (s.compliance_delta != null && s.compliance_delta <= -10) {
    t.push({ kind: "compliance_drop", label: "Compliance ↓", detail: `${s.compliance_delta} Prozentpunkte ggü. Vorwoche` });
  } else if (s.compliance_delta != null && s.compliance_delta >= 20) {
    t.push({ kind: "compliance_rise", label: "Compliance ↑", detail: `+${s.compliance_delta} Prozentpunkte ggü. Vorwoche` });
  }
  return t;
}
