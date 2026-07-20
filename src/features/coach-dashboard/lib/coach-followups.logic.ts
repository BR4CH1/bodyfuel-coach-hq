import type {
  CoachDashboardViewModel,
  CoachFollowUpDraft,
  CoachLead,
} from "@/features/coach-dashboard/types";

type BuildCoachFollowUpsInput = {
  view: CoachDashboardViewModel;
  leads: CoachLead[];
  limit?: number;
};

type PrioritizedDraft = CoachFollowUpDraft & { priority: number; dedupeKey: string };

function firstName(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.split(/\s+/)[0] : "du";
}

function customerGreeting(name: string | null | undefined) {
  const recipient = firstName(name);
  return recipient === "du" ? "Hi," : `Hi ${recipient},`;
}

function humanizeReason(reason: string) {
  if (reason === "Noch nie eingecheckt") return "dein erster Check-in noch offen ist";
  if (reason === "Wochen-Check-in offen") return "dein Wochen-Check-in noch offen ist";
  if (reason === "Keine Aktivität") return "zuletzt keine Aktivität eingetragen wurde";
  if (reason === "Plan abgelaufen") return "dein aktueller Plan ausgelaufen ist";

  const checkinMatch = reason.match(/^Check-in (\d+)T alt$/);
  if (checkinMatch) return `dein letzter Check-in ${checkinMatch[1]} Tage zurückliegt`;

  const inactiveMatch = reason.match(/^Inaktiv (\d+)T$/);
  if (inactiveMatch) return `seit ${inactiveMatch[1]} Tagen keine Aktivität eingetragen wurde`;

  const planMatch = reason.match(/^Plan läuft in (-?\d+)T aus$/);
  if (planMatch) return `dein Plan in ${planMatch[1]} Tagen ausläuft`;

  const plateauMatch = reason.match(/^Plateau (\d+)T$/);
  if (plateauMatch) return `dein Fortschritt seit ${plateauMatch[1]} Tagen stagniert`;

  if (reason.startsWith("kcal-Abweichung"))
    return "deine Kalorien zuletzt deutlich vom Ziel abgewichen sind";

  return reason.toLowerCase();
}

function riskMessage(name: string | null, reasons: string[]) {
  const readableReasons = reasons.slice(0, 2).map(humanizeReason);
  const reasonText =
    readableReasons.length === 0
      ? "wir länger keinen aktuellen Stand voneinander hatten"
      : readableReasons.length === 1
        ? readableReasons[0]
        : `${readableReasons[0]} und ${readableReasons[1]}`;

  return `${customerGreeting(name)} ich wollte kurz bei dir einchecken, weil mir aufgefallen ist, dass ${reasonText}. Wie läuft es aktuell bei dir? Gibt es etwas, wobei ich dich unterstützen oder den Plan anpassen kann?`;
}

function checkinMessage(name: string | null) {
  return `${customerGreeting(name)} dein Wochen-Check-in ist noch offen. Schick mir bitte kurz deinen aktuellen Stand, damit ich deinen Fortschritt prüfen und bei Bedarf direkt nachsteuern kann. Wenn gerade etwas dazwischenkommt, sag mir einfach kurz Bescheid.`;
}

function inactiveMessage(name: string | null, days: number | null) {
  const timing =
    days === null
      ? "bisher noch keinen aktuellen Eintrag"
      : `seit ${days} Tagen keinen neuen Eintrag`;
  return `${customerGreeting(name)} ich habe gesehen, dass wir ${timing} haben. Ist bei dir alles in Ordnung, oder gibt es gerade eine Hürde bei Ernährung, Training oder Alltag? Schreib mir kurz, dann finden wir gemeinsam eine einfache Lösung.`;
}

function planMessage(name: string, days: number, kind: "nutrition" | "training") {
  const planName = kind === "nutrition" ? "Ernährungsplan" : "Trainingsplan";
  const timing =
    days < 0
      ? `seit ${Math.abs(days)} Tagen abgelaufen`
      : days === 0
        ? "heute ausgelaufen"
        : `in ${days} Tagen fällig`;

  return `${customerGreeting(name)} dein ${planName} ist ${timing}. Bevor eine Lücke entsteht, würde ich gern kurz deinen aktuellen Stand und die nächsten Ziele abstimmen. Passt der Plan noch zu deinem Alltag, oder sollen wir etwas verändern?`;
}

function leadMessage(lead: CoachLead) {
  const goal = lead.goal?.trim();
  return `Hi ${firstName(lead.name)}, danke für deine Anfrage bei BodyFuel${goal ? ` zum Thema ${goal}` : ""}. Ich würde gern kurz verstehen, wo du aktuell stehst und welches Ziel dir am wichtigsten ist. Wann passt dir ein kurzes unverbindliches Gespräch am besten?`;
}

export function buildCoachFollowUps({ view, leads, limit = 3 }: BuildCoachFollowUpsInput) {
  const candidates: PrioritizedDraft[] = [];

  view.redClients.forEach((client, index) => {
    candidates.push({
      id: `risk-${client.id}`,
      dedupeKey: `customer-${client.id}`,
      priority: 10 + index,
      recipientName: client.display_name ?? "Kunde",
      category: "risk",
      tone: "urgent",
      reason:
        client._score.reasons.slice(0, 2).join(" · ") || `Coach Score ${client._score.score}/100`,
      message: riskMessage(client.display_name, client._score.reasons),
      emailSubject: "Kurzer Check-in zu deinem Coaching",
      target: { kind: "customer", userId: client.id },
    });
  });

  view.expiringPlans.forEach((plan, index) => {
    candidates.push({
      id: `plan-${plan.kind}-${plan.id}`,
      dedupeKey: `customer-${plan.id}`,
      priority: 30 + index,
      recipientName: plan.name,
      category: "plan",
      tone: plan.days < 0 ? "urgent" : "attention",
      reason:
        plan.days < 0
          ? `${plan.kind === "nutrition" ? "Ernährungs" : "Trainings"}plan seit ${Math.abs(plan.days)} Tagen abgelaufen`
          : `${plan.kind === "nutrition" ? "Ernährungs" : "Trainings"}plan läuft in ${plan.days} Tagen aus`,
      message: planMessage(plan.name, plan.days, plan.kind),
      emailSubject: "Dein BodyFuel Plan – kurze Abstimmung",
      target: { kind: "customer", userId: plan.id },
    });
  });

  leads.forEach((lead, index) => {
    candidates.push({
      id: `lead-${lead.id}`,
      dedupeKey: `lead-${lead.id}`,
      priority: 50 + index,
      recipientName: lead.name,
      category: "lead",
      tone: "attention",
      reason: lead.goal ? `Neue Anfrage: ${lead.goal}` : "Neue Coaching-Anfrage",
      message: leadMessage(lead),
      emailSubject: "Deine Anfrage bei BodyFuel",
      target: { kind: "lead", leadId: lead.id },
    });
  });

  view.openWeek.forEach((client, index) => {
    candidates.push({
      id: `checkin-${client.id}`,
      dedupeKey: `customer-${client.id}`,
      priority: 70 + index,
      recipientName: client.display_name ?? "Kunde",
      category: "checkin",
      tone: "attention",
      reason: client.last_checkin ? "Wochen-Check-in noch offen" : "Noch kein Check-in vorhanden",
      message: checkinMessage(client.display_name),
      emailSubject: "Dein Wochen-Check-in ist noch offen",
      target: { kind: "customer", userId: client.id },
    });
  });

  view.inactive.forEach((client, index) => {
    candidates.push({
      id: `inactive-${client.id}`,
      dedupeKey: `customer-${client.id}`,
      priority: 90 + index,
      recipientName: client.display_name ?? "Kunde",
      category: "inactive",
      tone: "attention",
      reason: client.days === null ? "Noch keine Aktivität" : `Seit ${client.days} Tagen inaktiv`,
      message: inactiveMessage(client.display_name, client.days),
      emailSubject: "Kurzer Check-in von deinem BodyFuel Coach",
      target: { kind: "customer", userId: client.id },
    });
  });

  const seen = new Set<string>();
  const safeLimit = Math.max(0, limit);

  return candidates
    .sort((left, right) => left.priority - right.priority)
    .filter((candidate) => {
      if (seen.has(candidate.dedupeKey)) return false;
      seen.add(candidate.dedupeKey);
      return true;
    })
    .slice(0, safeLimit)
    .map(({ priority: _, dedupeKey: __, ...draft }) => draft);
}
