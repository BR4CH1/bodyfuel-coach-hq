import type {
  CoachDashboardViewModel,
  CoachLead,
  CoachWorkloadViewModel,
} from "@/features/coach-dashboard/types";

export function buildCoachWorkload(
  view: CoachDashboardViewModel,
  leads: CoachLead[],
): CoachWorkloadViewModel {
  const safeRed = Array.isArray(view.redClients) ? view.redClients : [];
  const safeOpenWeek = Array.isArray(view.openWeek) ? view.openWeek : [];
  const safePlans = Array.isArray(view.expiringPlans) ? view.expiringPlans : [];
  const safeLeads = Array.isArray(leads) ? leads : [];

  const riskItems = safeRed.map((client) => ({
    id: client.id,
    name: client.display_name?.trim() || "Unbenannter Kunde",
    reason:
      client._score.reasons.slice(0, 2).join(" · ") || `Coach Score ${client._score.score}/100`,
    target: { kind: "customer" as const, userId: client.id },
    sourceSignalId: `risk-${client.id}`,
  }));
  const checkinItems = safeOpenWeek.map((client) => ({
    id: client.id,
    name: client.display_name?.trim() || "Unbenannter Kunde",
    reason: client.last_checkin ? "Wochen-Check-in noch offen" : "Noch kein Check-in vorhanden",
    target: { kind: "customer" as const, userId: client.id },
    sourceSignalId: `checkin-${client.id}`,
  }));
  const planItems = safePlans
    .filter((plan) => plan.days <= 3)
    .map((plan) => ({
      id: `${plan.kind}-${plan.id}`,
      name: plan.name,
      reason:
        plan.days < 0
          ? `${plan.kind === "nutrition" ? "Ernährungs" : "Trainings"}plan seit ${Math.abs(plan.days)} Tagen abgelaufen`
          : `${plan.kind === "nutrition" ? "Ernährungs" : "Trainings"}plan läuft in ${plan.days} Tagen aus`,
      target: { kind: "customer" as const, userId: plan.id },
      sourceSignalId: `plan-${plan.kind}-${plan.id}`,
    }));
  const leadItems = safeLeads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    reason: lead.goal ? `Neue Anfrage: ${lead.goal}` : "Neue Coaching-Anfrage",
    target: { kind: "lead" as const, leadId: lead.id },
    sourceSignalId: `lead-${lead.id}`,
  }));

  const urgent = riskItems.length;
  const due = checkinItems.length;
  const expiring = planItems.length;
  const newLeads = leadItems.length;
  const total = urgent + due + expiring + newLeads;

  return {
    state: urgent > 0 ? "critical" : total >= 8 ? "busy" : total > 0 ? "steady" : "clear",
    title:
      urgent > 0
        ? "Risiken zuerst absichern"
        : total >= 8
          ? "Hohe Arbeitslast"
          : total > 0
            ? "Tagesgeschäft im Griff"
            : "Alles sauber",
    summary:
      urgent > 0
        ? `${urgent} Risiko-Kund${urgent === 1 ? "e braucht" : "en brauchen"} heute zuerst deine Aufmerksamkeit.`
        : total >= 8
          ? `${total} relevante Vorgänge sind offen. Fuely bündelt sie nach Priorität.`
          : total > 0
            ? `${total} relevante Vorgänge sind offen und klar priorisiert.`
            : "Aktuell sind keine kritischen Coach-Aufgaben offen.",
    total,
    metrics: [
      {
        key: "risk",
        label: "Risiko",
        value: urgent,
        tone: urgent > 0 ? "urgent" : "neutral",
        items: riskItems,
      },
      {
        key: "checkin",
        label: "Check-ins",
        value: due,
        tone: due > 0 ? "attention" : "neutral",
        items: checkinItems,
      },
      {
        key: "plan",
        label: "Pläne ≤ 3 Tage",
        value: expiring,
        tone: expiring > 0 ? "attention" : "neutral",
        items: planItems,
      },
      {
        key: "lead",
        label: "Leads",
        value: newLeads,
        tone: newLeads > 0 ? "info" : "neutral",
        items: leadItems,
      },
    ],
  };
}
