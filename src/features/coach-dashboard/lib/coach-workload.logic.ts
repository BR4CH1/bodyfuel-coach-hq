import type {
  CoachDashboardViewModel,
  CoachLead,
  CoachWorkloadViewModel,
} from "@/features/coach-dashboard/types";

export function buildCoachWorkload(
  view: CoachDashboardViewModel,
  leads: CoachLead[],
): CoachWorkloadViewModel {
  const urgent = view.redClients.length;
  const due = view.openWeek.length;
  const expiring = view.expiringPlans.filter((plan) => plan.days <= 3).length;
  const newLeads = leads.length;
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
      { label: "Risiko", value: urgent, tone: urgent > 0 ? "urgent" : "neutral" },
      { label: "Check-ins", value: due, tone: due > 0 ? "attention" : "neutral" },
      { label: "Pläne ≤ 3 Tage", value: expiring, tone: expiring > 0 ? "attention" : "neutral" },
      { label: "Leads", value: newLeads, tone: newLeads > 0 ? "info" : "neutral" },
    ],
  };
}
