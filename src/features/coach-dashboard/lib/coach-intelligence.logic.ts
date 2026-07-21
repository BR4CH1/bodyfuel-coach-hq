import type {
  CoachDashboardViewModel,
  CoachIntelligenceSignal,
  CoachIntelligenceViewModel,
} from "@/features/coach-dashboard/types";

function nameOf(value: string | null) {
  return value?.trim() || "Unbenannter Kunde";
}

function uniqueByUser(signals: CoachIntelligenceSignal[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    if (seen.has(signal.userId)) return false;
    seen.add(signal.userId);
    return true;
  });
}

export function buildCoachIntelligence(
  view: CoachDashboardViewModel,
  clients?: CoachDashboardViewModel["clients"],
): CoachIntelligenceViewModel {
  const intelligenceClients = clients ?? view.clients ?? [];

  const stagnating = intelligenceClients
    .filter((client) => (client.plateau_days ?? 0) >= 7)
    .sort((left, right) => (right.plateau_days ?? 0) - (left.plateau_days ?? 0))
    .slice(0, 4)
    .map<CoachIntelligenceSignal>((client) => ({
      id: `stagnation-${client.id}`,
      userId: client.id,
      name: nameOf(client.display_name),
      category: "stagnation",
      severity: (client.plateau_days ?? 0) >= 14 ? "urgent" : "attention",
      headline: `${nameOf(client.display_name)} stagniert`,
      detail: `Seit ${client.plateau_days ?? 0} Tagen ist kein klarer Fortschritt erkennbar.`,
    }));

  const atRisk = view.redClients.slice(0, 4).map<CoachIntelligenceSignal>((client) => ({
    id: `risk-${client.id}`,
    userId: client.id,
    name: nameOf(client.display_name),
    category: "risk",
    severity: "urgent",
    headline: `${nameOf(client.display_name)} hat erhöhten Betreuungsbedarf`,
    detail:
      client._score.reasons.slice(0, 2).join(" · ") || `Coach Score ${client._score.score}/100`,
  }));

  const attentionCandidates: CoachIntelligenceSignal[] = [
    ...view.openWeek.map((client) => ({
      id: `checkin-${client.id}`,
      userId: client.id,
      name: nameOf(client.display_name),
      category: "attention" as const,
      severity: "attention" as const,
      headline: `${nameOf(client.display_name)} hat keinen aktuellen Check-in`,
      detail: "Fuely empfiehlt eine persönliche Erinnerung.",
    })),
    ...view.inactive.map((client) => ({
      id: `inactive-${client.id}`,
      userId: client.id,
      name: nameOf(client.display_name),
      category: "attention" as const,
      severity: "attention" as const,
      headline: `${nameOf(client.display_name)} ist inaktiv`,
      detail:
        client.days === null
          ? "Aktivität konnte nicht bestimmt werden."
          : `Seit ${client.days} Tagen keine relevante Aktivität.`,
    })),
  ];

  const needsAttention = uniqueByUser(attentionCandidates)
    .filter((signal) => !atRisk.some((risk) => risk.userId === signal.userId))
    .slice(0, 4);

  const total = stagnating.length + atRisk.length + needsAttention.length;

  return {
    title: total > 0 ? "Fuely Coach Intelligence" : "Coach Intelligence ist ruhig",
    summary:
      total > 0
        ? `Fuely hat ${total} relevante Signale aus Fortschritt, Risiko und Aktivität priorisiert.`
        : "Aktuell gibt es keine auffälligen Kundensignale.",
    stagnating,
    atRisk,
    needsAttention,
  };
}
