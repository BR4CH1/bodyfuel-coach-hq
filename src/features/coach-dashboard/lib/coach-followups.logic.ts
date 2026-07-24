import type {
  CoachDashboardViewModel,
  CoachFollowUpDraft,
  CoachIntelligenceViewModel,
  CoachLead,
} from "@/features/coach-dashboard/types";

type BuildCoachFollowUpsInput = {
  view: CoachDashboardViewModel;
  leads: CoachLead[];
  intelligence?: CoachIntelligenceViewModel;
  limit?: number;
};

type PrioritizedDraft = CoachFollowUpDraft & { priority: number };

function firstName(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.split(/\s+/)[0] : "du";
}

function greeting(name: string | null | undefined) {
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
  return `${greeting(name)} ich wollte kurz bei dir einchecken, weil mir aufgefallen ist, dass ${reasonText}. Wie läuft es aktuell bei dir? Gibt es etwas, wobei ich dich unterstützen oder den Plan anpassen kann?`;
}

function checkinMessage(name: string | null) {
  return `${greeting(name)} dein Wochen-Check-in ist noch offen. Schick mir bitte kurz deinen aktuellen Stand, damit ich deinen Fortschritt prüfen und bei Bedarf direkt nachsteuern kann. Wenn gerade etwas dazwischenkommt, sag mir einfach kurz Bescheid.`;
}

function inactiveMessage(name: string | null, days: number | null) {
  const timing =
    days === null
      ? "bisher noch keinen aktuellen Eintrag"
      : `seit ${days} Tagen keinen neuen Eintrag`;
  return `${greeting(name)} ich habe gesehen, dass wir ${timing} haben. Ist bei dir alles in Ordnung, oder gibt es gerade eine Hürde bei Ernährung, Training oder Alltag? Schreib mir kurz, dann finden wir gemeinsam eine einfache Lösung.`;
}

function planMessage(name: string, days: number, kind: "nutrition" | "training") {
  const planName = kind === "nutrition" ? "Ernährungsplan" : "Trainingsplan";
  const timing =
    days < 0
      ? `seit ${Math.abs(days)} Tagen abgelaufen`
      : days === 0
        ? "heute ausgelaufen"
        : `in ${days} Tagen fällig`;
  return `${greeting(name)} dein ${planName} ist ${timing}. Bevor eine Lücke entsteht, würde ich gern kurz deinen aktuellen Stand und die nächsten Ziele abstimmen. Passt der Plan noch zu deinem Alltag, oder sollen wir etwas verändern?`;
}

function leadMessage(lead: CoachLead) {
  const goal = lead.goal?.trim();
  return `Hi ${firstName(lead.name)}, danke für deine Anfrage bei BodyFuel${goal ? ` zum Thema ${goal}` : ""}. Ich würde gern kurz verstehen, wo du aktuell stehst und welches Ziel dir am wichtigsten ist. Wann passt dir ein kurzes unverbindliches Gespräch am besten?`;
}

function intelligenceMessage(
  name: string,
  detail: string,
  category: "stagnation" | "risk" | "attention",
) {
  const intro =
    category === "stagnation"
      ? "dein Fortschritt zuletzt etwas stagniert"
      : category === "risk"
        ? "ich bei deinen aktuellen Daten ein erhöhtes Risiko sehe"
        : "mir bei deinem Verlauf etwas aufgefallen ist";
  return `${greeting(name)} ich wollte mich kurz melden, weil ${intro}. ${detail} Wie fühlt sich die aktuelle Situation für dich an? Dann können wir gemeinsam direkt nachsteuern.`;
}

export function buildCoachFollowUps({
  view,
  leads,
  intelligence,
  limit = 50,
}: BuildCoachFollowUpsInput) {
  const candidates: PrioritizedDraft[] = [];
  const redClients = Array.isArray(view.redClients) ? view.redClients : [];
  const expiringPlans = Array.isArray(view.expiringPlans) ? view.expiringPlans : [];
  const openWeek = Array.isArray(view.openWeek) ? view.openWeek : [];
  const inactive = Array.isArray(view.inactive) ? view.inactive : [];
  const safeLeads = Array.isArray(leads) ? leads : [];

  redClients.forEach((client, index) =>
    candidates.push({
      id: `risk-${client.id}`,
      sourceSignalId: `risk-${client.id}`,
      priority: 10 + index,
      recipientName: client.display_name ?? "Kunde",
      category: "risk",
      tone: "urgent",
      reason:
        client._score.reasons.slice(0, 2).join(" · ") || `Coach Score ${client._score.score}/100`,
      message: riskMessage(client.display_name, client._score.reasons),
      emailSubject: "Kurzer Check-in zu deinem Coaching",
      target: { kind: "customer", userId: client.id },
    }),
  );

  (intelligence?.stagnating ?? []).forEach((signal, index) =>
    candidates.push({
      id: signal.id,
      sourceSignalId: signal.id,
      priority: 20 + index,
      recipientName: signal.name,
      category: "stagnation",
      tone: signal.severity === "urgent" ? "urgent" : "attention",
      reason: signal.detail,
      message: intelligenceMessage(signal.name, signal.detail, "stagnation"),
      emailSubject: "Kurze Abstimmung zu deinem Fortschritt",
      target: { kind: "customer", userId: signal.userId },
    }),
  );

  (intelligence?.needsAttention ?? []).forEach((signal, index) =>
    candidates.push({
      id: signal.id,
      sourceSignalId: signal.id,
      priority: 25 + index,
      recipientName: signal.name,
      category: "attention",
      tone: "attention",
      reason: signal.detail,
      message: intelligenceMessage(signal.name, signal.detail, "attention"),
      emailSubject: "Kurzer BodyFuel Check-in",
      target: { kind: "customer", userId: signal.userId },
    }),
  );

  expiringPlans.forEach((plan, index) =>
    candidates.push({
      id: `plan-${plan.kind}-${plan.id}`,
      sourceSignalId: `plan-${plan.kind}-${plan.id}`,
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
    }),
  );

  safeLeads.forEach((lead, index) =>
    candidates.push({
      id: `lead-${lead.id}`,
      sourceSignalId: `lead-${lead.id}`,
      priority: 50 + index,
      recipientName: lead.name,
      category: "lead",
      tone: "attention",
      reason: lead.goal ? `Neue Anfrage: ${lead.goal}` : "Neue Coaching-Anfrage",
      message: leadMessage(lead),
      emailSubject: "Deine Anfrage bei BodyFuel",
      target: { kind: "lead", leadId: lead.id },
    }),
  );

  openWeek.forEach((client, index) =>
    candidates.push({
      id: `checkin-${client.id}`,
      sourceSignalId: `checkin-${client.id}`,
      priority: 70 + index,
      recipientName: client.display_name ?? "Kunde",
      category: "checkin",
      tone: "attention",
      reason: client.last_checkin ? "Wochen-Check-in noch offen" : "Noch kein Check-in vorhanden",
      message: checkinMessage(client.display_name),
      emailSubject: "Dein Wochen-Check-in ist noch offen",
      target: { kind: "customer", userId: client.id },
    }),
  );

  inactive.forEach((client, index) =>
    candidates.push({
      id: `inactive-${client.id}`,
      sourceSignalId: `inactive-${client.id}`,
      priority: 90 + index,
      recipientName: client.display_name ?? "Kunde",
      category: "inactive",
      tone: "attention",
      reason: client.days === null ? "Noch keine Aktivität" : `Seit ${client.days} Tagen inaktiv`,
      message: inactiveMessage(client.display_name, client.days),
      emailSubject: "Kurzer Check-in von deinem BodyFuel Coach",
      target: { kind: "customer", userId: client.id },
    }),
  );

  const seen = new Set<string>();
  return candidates
    .sort((a, b) => a.priority - b.priority)
    .filter((item) => !seen.has(item.sourceSignalId) && seen.add(item.sourceSignalId))
    .slice(0, Math.max(0, limit))
    .map(({ priority: _, ...draft }) => draft);
}
