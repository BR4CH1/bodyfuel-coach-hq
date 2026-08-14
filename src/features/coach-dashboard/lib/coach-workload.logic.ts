import type {
  CoachClient,
  CoachDashboardViewModel,
  CoachLead,
  CoachWorkloadItem,
  CoachWorkloadKey,
  CoachWorkloadViewModel,
} from "@/features/coach-dashboard/types";

type CustomerCase = {
  client: CoachClient;
  reasons: string[];
  signals: Set<Exclude<CoachWorkloadKey, "lead">>;
};

const displayName = (client: CoachClient) => client.display_name?.trim() || "Unbenannter Kunde";

export function buildCoachWorkload(
  view: CoachDashboardViewModel,
  leads: CoachLead[],
): CoachWorkloadViewModel {
  const safeRed = Array.isArray(view.redClients) ? view.redClients : [];
  const safePendingCheckins = Array.isArray(view.pendingCheckins) ? view.pendingCheckins : [];
  const safePlans = Array.isArray(view.expiringPlans) ? view.expiringPlans : [];
  const safeLeads = Array.isArray(leads) ? leads : [];
  const actionablePlans = safePlans.filter((plan) => plan.days <= 5);
  const clientById = new Map(
    [...safeRed, ...safePendingCheckins].map((client) => [client.id, client] as const),
  );
  const cases = new Map<string, CustomerCase>();

  const addCase = (
    client: CoachClient,
    signal: Exclude<CoachWorkloadKey, "lead">,
    reason: string,
  ) => {
    const item = cases.get(client.id) ?? { client, reasons: [], signals: new Set() };
    item.signals.add(signal);
    if (reason && !item.reasons.includes(reason)) item.reasons.push(reason);
    cases.set(client.id, item);
  };

  safeRed.forEach((client) =>
    addCase(
      client,
      "risk",
      client._score.reasons.slice(0, 2).join(" · ") || `Coach Score ${client._score.score}/100`,
    ),
  );

  safePendingCheckins.forEach((client) =>
    addCase(
      client,
      "checkin",
      client.pending_checkin_submitted_at
        ? `Check-in vom ${new Date(client.pending_checkin_submitted_at).toLocaleDateString("de-DE")} eingegangen und noch ungeprüft`
        : "Check-in eingegangen und noch ungeprüft",
    ),
  );

  actionablePlans.forEach((plan) => {
    const client = clientById.get(plan.id) ?? {
      id: plan.id,
      display_name: plan.name,
      last_checkin: null,
      last_checkin_submitted_at: null,
      pending_checkin_week_start: null,
      pending_checkin_submitted_at: null,
      last_weight: null,
      last_weight_at: null,
      last_nutrition_at: null,
      last_nutrition_name: null,
      last_training_at: null,
      nutrition_plan_end: null,
      training_plan_end: null,
      kcal_dev: null,
      kcal_dev_dir: null,
      plateau_days: null,
    };
    addCase(
      client,
      "plan",
      plan.days < 0
        ? `${plan.kind === "nutrition" ? "Ernährungs" : "Trainings"}plan seit ${Math.abs(plan.days)} Tagen abgelaufen`
        : plan.days === 0
          ? `${plan.kind === "nutrition" ? "Ernährungs" : "Trainings"}plan läuft heute aus`
          : `${plan.kind === "nutrition" ? "Ernährungs" : "Trainings"}plan läuft in ${plan.days} Tagen aus`,
    );
  });

  const customerItems: Record<Exclude<CoachWorkloadKey, "lead">, CoachWorkloadItem[]> = {
    risk: [],
    checkin: [],
    plan: [],
  };

  cases.forEach((item) => {
    item.signals.forEach((signal) => {
      customerItems[signal].push({
        id: item.client.id,
        name: displayName(item.client),
        reason: item.reasons.join(" · "),
        target: { kind: "customer", userId: item.client.id },
        sourceSignalId: `case-${item.client.id}-${signal}`,
      });
    });
  });

  const leadItems: CoachWorkloadItem[] = safeLeads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    reason: lead.goal ? `Neue Anfrage: ${lead.goal}` : "Neue Coaching-Anfrage",
    target: { kind: "lead", leadId: lead.id },
    sourceSignalId: `lead-${lead.id}`,
  }));

  const urgent = customerItems.risk.length;
  const due = customerItems.checkin.length;
  const expiring = actionablePlans.length;
  const newLeads = leadItems.length;
  const total = cases.size + newLeads;

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
          ? `${total} Kundenfälle sind offen. Fuely bündelt alle Gründe pro Person.`
          : total > 0
            ? `${total} Kundenfälle sind offen und ohne Doppelzählung priorisiert.`
            : "Aktuell sind keine kritischen Coach-Aufgaben offen.",
    total,
    metrics: [
      {
        key: "risk",
        label: "Risiko",
        value: urgent,
        tone: urgent > 0 ? "urgent" : "neutral",
        items: customerItems.risk,
      },
      {
        key: "checkin",
        label: "Check-ins",
        value: due,
        tone: due > 0 ? "attention" : "neutral",
        items: customerItems.checkin,
      },
      {
        key: "plan",
        label: "Pläne ≤ 5 Tage",
        value: expiring,
        tone: expiring > 0 ? "attention" : "neutral",
        items: customerItems.plan,
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
