import type {
  CustomerBriefingItem,
  CustomerBriefingViewModel,
  CustomerCheckinBriefing,
} from "@/features/customer-dashboard/types";

type BuildCustomerBriefingInput = {
  checkin: CustomerCheckinBriefing | null;
  checkinMissingMeasures: boolean;
  trainedToday: boolean;
  measuredToday: boolean;
  todayPoints: number;
  maxDailyPoints: number;
  measurementCount: number;
  latestMeasurementAt: string | null;
  hasActivePlan: boolean;
  planUnderReview: boolean;
  now?: Date;
};

type PrioritizedItem = CustomerBriefingItem & { priority: number };

function daysSince(value: string | null, now: Date) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000));
}

export function buildCustomerBriefing({
  checkin,
  checkinMissingMeasures,
  trainedToday,
  measuredToday,
  todayPoints,
  maxDailyPoints,
  measurementCount,
  latestMeasurementAt,
  hasActivePlan,
  planUnderReview,
  now = new Date(),
}: BuildCustomerBriefingInput): CustomerBriefingViewModel {
  const items: PrioritizedItem[] = [];
  const safeMaxPoints = Math.max(0, maxDailyPoints);
  const safeTodayPoints = Math.min(Math.max(0, todayPoints), safeMaxPoints);
  const missingPoints = Math.max(0, safeMaxPoints - safeTodayPoints);
  const measurementAge = daysSince(latestMeasurementAt, now);

  if (checkin?.tone === "overdue") {
    items.push({
      id: "checkin-overdue",
      priority: 10,
      tone: "urgent",
      title: "Check-in nachholen",
      description: checkin.label,
      actionLabel: "Check-in starten",
      target: { kind: "checkin" },
    });
  } else if (checkin?.tone === "today") {
    items.push({
      id: "checkin-today",
      priority: 15,
      tone: "urgent",
      title: "Check-in heute abschließen",
      description: "Dein Coach wartet auf dein aktuelles Feedback.",
      actionLabel: "Check-in starten",
      target: { kind: "checkin" },
    });
  }

  if (checkinMissingMeasures) {
    items.push({
      id: "checkin-measures-missing",
      priority: 20,
      tone: "attention",
      title: "Körpermaße ergänzen",
      description: "Dein Check-in ist da, aber die Vergleichswerte fehlen noch.",
      actionLabel: "Messung eintragen",
      target: { kind: "measurements" },
    });
  } else if (measurementCount === 0) {
    items.push({
      id: "first-measurement",
      priority: 25,
      tone: "attention",
      title: "Startwerte festhalten",
      description: "Mit deiner ersten Messung wird Fortschritt wirklich sichtbar.",
      actionLabel: "Erste Messung",
      target: { kind: "measurements" },
    });
  } else if (measurementAge !== null && measurementAge >= 7) {
    items.push({
      id: "measurement-stale",
      priority: 30,
      tone: "attention",
      title: "Messung aktualisieren",
      description: `Deine letzte Messung ist ${measurementAge} Tage her.`,
      actionLabel: "Neue Messung",
      target: { kind: "measurements" },
    });
  }

  if (missingPoints > 0) {
    items.push({
      id: "daily-points",
      priority: 40,
      tone: "attention",
      title: `${missingPoints} Tagespunkte sind noch offen`,
      description: "Schließe deine Tagesziele ab und sichere deinen Streak.",
      actionLabel: "Tagesziele öffnen",
      target: { kind: "daily-checklist" },
    });
  }

  if (!trainedToday) {
    items.push({
      id: "training-open",
      priority: 50,
      tone: "info",
      title: "Training noch offen",
      description: "Starte deinen Plan oder trage deine heutige Einheit ein.",
      actionLabel: "Training öffnen",
      target: { kind: "training" },
    });
  }

  if (planUnderReview) {
    items.push({
      id: "plan-review",
      priority: 60,
      tone: "info",
      title: "Dein Smart Plan wird geprüft",
      description: "Fuely informiert dich, sobald dein Plan freigegeben ist.",
      actionLabel: "Ernährung ansehen",
      target: { kind: "nutrition" },
    });
  } else if (!hasActivePlan) {
    items.push({
      id: "plan-missing",
      priority: 70,
      tone: "attention",
      title: "Kein aktiver Ernährungsplan",
      description: "Aktiviere Smart oder kläre den nächsten Plan mit deinem Coach.",
      actionLabel: "Ernährung öffnen",
      target: { kind: "nutrition" },
    });
  }

  const prioritizedItems = items
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 3)
    .map(({ priority: _, ...item }) => item);

  const progress = {
    trainedToday,
    measuredToday,
    todayPoints: safeTodayPoints,
    maxDailyPoints: safeMaxPoints,
  };

  if (prioritizedItems.length === 0) {
    return {
      state: "clear",
      emotion: "celebrating",
      title: "Tagesziel erreicht",
      summary: "Training, Messung und Tagesziele sind erledigt. Stark!",
      items: [],
      progress,
    };
  }

  const urgent = prioritizedItems.some((item) => item.tone === "urgent");

  return {
    state: urgent ? "urgent" : "attention",
    emotion: urgent ? "focused" : "motivated",
    title: urgent ? "Das hat heute Priorität" : "Dein Tagesfokus",
    summary:
      prioritizedItems.length === 1
        ? "Fuely hat den wichtigsten nächsten Schritt für dich gefunden."
        : `Fuely hat deine ${prioritizedItems.length} wichtigsten Schritte sortiert.`,
    items: prioritizedItems,
    progress,
  };
}
