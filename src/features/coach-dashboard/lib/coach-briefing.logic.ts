import type {
  CoachBriefingItem,
  CoachBriefingViewModel,
  CoachDashboardViewModel,
  CoachLead,
} from "@/features/coach-dashboard/types";

type BuildCoachBriefingInput = {
  view: CoachDashboardViewModel;
  leads: CoachLead[];
  performancePending: number;
  showPerformanceNavigation: boolean;
};

type PrioritizedBriefingItem = CoachBriefingItem & { priority: number };

function plural(count: number, singular: string, pluralForm: string) {
  return count === 1 ? singular : pluralForm;
}

export function buildCoachBriefing({
  view,
  leads,
  performancePending,
  showPerformanceNavigation,
}: BuildCoachBriefingInput): CoachBriefingViewModel {
  const candidates: PrioritizedBriefingItem[] = [];
  const highestRiskClient = view.redClients[0];

  if (highestRiskClient) {
    const name = highestRiskClient.display_name ?? "Dieser Kunde";
    const reasons = highestRiskClient._score.reasons.slice(0, 2).join(" · ");

    candidates.push({
      id: `risk-${highestRiskClient.id}`,
      priority: 10,
      tone: "urgent",
      title: `${name} zuerst prüfen`,
      description: reasons || `Coach Score ${highestRiskClient._score.score}/100`,
      actionLabel: "Kunden öffnen",
      target: { kind: "customer", userId: highestRiskClient.id },
    });
  }

  const expiredPlans = view.expiringPlans.filter((plan) => plan.days < 0);
  if (expiredPlans.length > 0) {
    candidates.push({
      id: "expired-plans",
      priority: 20,
      tone: "urgent",
      title: `${expiredPlans.length} ${plural(expiredPlans.length, "Plan ist", "Pläne sind")} abgelaufen`,
      description: "Neue Laufzeit oder neuen Plan festlegen.",
      actionLabel: "Pläne prüfen",
      target: { kind: "customers" },
    });
  }

  if (view.pendingCheckins.length > 0) {
    candidates.push({
      id: "pending-checkins",
      priority: 25,
      tone: "attention",
      title: `${view.pendingCheckins.length} ${plural(view.pendingCheckins.length, "Check-in ist", "Check-ins sind")} bereit`,
      description: "Eingereichte Check-ins prüfen und Coach-Feedback ergänzen.",
      actionLabel: "Check-ins prüfen",
      target: { kind: "customers" },
    });
  }

  if (leads.length > 0) {
    candidates.push({
      id: "new-leads",
      priority: 30,
      tone: "attention",
      title: `${leads.length} ${plural(leads.length, "neue Anfrage", "neue Anfragen")}`,
      description: "Schnelle Antworten erhöhen die Chance auf einen Abschluss.",
      actionLabel: "Anfragen öffnen",
      target: { kind: "leads" },
    });
  }

  if (showPerformanceNavigation && performancePending > 0) {
    candidates.push({
      id: "performance-checks",
      priority: 40,
      tone: "attention",
      title: `${performancePending} ${plural(performancePending, "Performance Check ist", "Performance Checks sind")} offen`,
      description: "Ergebnisse prüfen und für die Athleten freigeben.",
      actionLabel: "Checks öffnen",
      target: { kind: "performance" },
    });
  }

  if (view.openWeek.length > 0) {
    candidates.push({
      id: "open-checkins",
      priority: 50,
      tone: "attention",
      title: `${view.openWeek.length} ${plural(view.openWeek.length, "Check-in fehlt", "Check-ins fehlen")}`,
      description: "Erinnerungen senden oder betroffene Kunden direkt prüfen.",
      actionLabel: "Kunden ansehen",
      target: { kind: "customers" },
    });
  }

  const expiringSoon = view.expiringPlans.filter((plan) => plan.days >= 0);
  if (expiringSoon.length > 0) {
    candidates.push({
      id: "expiring-plans",
      priority: 60,
      tone: "info",
      title: `${expiringSoon.length} ${plural(expiringSoon.length, "Plan läuft", "Pläne laufen")} bald aus`,
      description: "Jetzt verlängern, bevor eine Betreuungslücke entsteht.",
      actionLabel: "Laufzeiten prüfen",
      target: { kind: "customers" },
    });
  }

  if (view.inactive.length > 0) {
    candidates.push({
      id: "inactive-clients",
      priority: 70,
      tone: "attention",
      title: `${view.inactive.length} ${plural(view.inactive.length, "Kunde ist", "Kunden sind")} länger inaktiv`,
      description: "Persönlich nachfassen und mögliche Hürden klären.",
      actionLabel: "Inaktive prüfen",
      target: { kind: "customers" },
    });
  }

  const items = candidates
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map(({ priority: _, ...item }) => item);

  if (items.length === 0) {
    return {
      state: "clear",
      emotion: "celebrating",
      title: "Alles im grünen Bereich",
      summary: "Heute gibt es keine dringenden Coach-Aufgaben. Gute Arbeit!",
      items: [],
    };
  }

  const hasUrgentItem = items.some((item) => item.tone === "urgent");

  return {
    state: hasUrgentItem ? "urgent" : "attention",
    emotion: hasUrgentItem ? "focused" : "motivated",
    title: hasUrgentItem ? "Hier solltest du heute anfangen" : "Dein Coach-Briefing für heute",
    summary:
      items.length === 1
        ? "Fuely hat einen wichtigen Punkt für dich priorisiert."
        : `Fuely hat die ${items.length} wichtigsten Punkte für dich sortiert.`,
    items,
  };
}
