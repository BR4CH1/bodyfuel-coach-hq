import type {
  CoachClient,
  CoachDashboardViewModel,
  CoachScore,
  CoachScoreLevel,
  ExpiringPlan,
  InactiveCoachClient,
  ScoredCoachClient,
} from "@/features/coach-dashboard/types";

const DAY_MS = 86_400_000;
const PLAN_WARNING_DAYS = 5;
const COACH_TIME_ZONE = "Europe/Berlin";

export function coachDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COACH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateKeyDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function mondayOf(date: Date): string {
  const dateKey = coachDateKey(date);
  const dateUtc = new Date(dateKeyDay(dateKey) * DAY_MS);
  const daysSinceMonday = (dateUtc.getUTCDay() + 6) % 7;

  return new Date((dateKeyDay(dateKey) - daysSinceMonday) * DAY_MS).toISOString().slice(0, 10);
}

export function daysAgo(iso: string | null, nowMs = Date.now()): number | null {
  if (!iso) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (dateOnly) {
    return dateKeyDay(coachDateKey(new Date(nowMs))) - dateKeyDay(iso);
  }

  return Math.floor((nowMs - new Date(iso).getTime()) / DAY_MS);
}

export function daysUntil(iso: string, today: Date): number {
  const endDateKey = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : coachDateKey(new Date(iso));
  return dateKeyDay(endDateKey) - dateKeyDay(coachDateKey(today));
}

function latestActivityDays(client: CoachClient, nowMs: number): number | null {
  const activity = [client.last_training_at, client.last_nutrition_at, client.last_weight_at]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime());

  if (activity.length === 0) return null;
  return Math.floor((nowMs - Math.max(...activity)) / DAY_MS);
}

export function calculateCoachScore(
  client: CoachClient,
  weekStart: string,
  today: Date,
): CoachScore {
  const nowMs = today.getTime();
  let score = 100;
  const reasons: string[] = [];

  const checkinDays = daysAgo(client.last_checkin, nowMs);
  if (client.last_checkin !== weekStart) {
    if (checkinDays === null) {
      score -= 30;
      reasons.push("Noch nie eingecheckt");
    } else if (checkinDays >= 14) {
      score -= 35;
      reasons.push(`Check-in ${checkinDays}T alt`);
    } else {
      score -= 15;
      reasons.push("Wochen-Check-in offen");
    }
  }

  const activityDays = latestActivityDays(client, nowMs);
  if (activityDays === null) {
    score -= 20;
    reasons.push("Keine Aktivität");
  } else if (activityDays >= 14) {
    score -= 25;
    reasons.push(`Inaktiv ${activityDays}T`);
  } else if (activityDays >= 7) {
    score -= 10;
    reasons.push(`Inaktiv ${activityDays}T`);
  }

  if (client.kcal_dev != null) {
    if (client.kcal_dev > 500) {
      score -= 15;
      reasons.push(`kcal-Abweichung ${client.kcal_dev}`);
    } else if (client.kcal_dev > 200) {
      score -= 5;
    }
  }

  if (client.plateau_days != null) {
    score -= 10;
    reasons.push(`Plateau ${client.plateau_days}T`);
  }

  const planDays = [client.nutrition_plan_end, client.training_plan_end]
    .filter((value): value is string => Boolean(value))
    .map((value) => daysUntil(value, today));

  if (planDays.length > 0) {
    const minimumDays = Math.min(...planDays);
    if (minimumDays < 0) {
      score -= 20;
      reasons.push("Plan abgelaufen");
    } else if (minimumDays <= PLAN_WARNING_DAYS) {
      score -= 10;
      reasons.push(`Plan läuft in ${minimumDays}T aus`);
    }
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  const level: CoachScoreLevel =
    normalizedScore >= 70 ? "green" : normalizedScore >= 40 ? "yellow" : "red";

  return { score: normalizedScore, level, reasons };
}

function collectExpiringPlans(clients: CoachClient[], today: Date): ExpiringPlan[] {
  return clients
    .flatMap((client) => {
      const plans: ExpiringPlan[] = [];
      const name = client.display_name ?? "Ohne Namen";

      if (client.nutrition_plan_end) {
        plans.push({
          id: client.id,
          name,
          kind: "nutrition",
          end: client.nutrition_plan_end,
          days: daysUntil(client.nutrition_plan_end, today),
        });
      }

      if (client.training_plan_end) {
        plans.push({
          id: client.id,
          name,
          kind: "training",
          end: client.training_plan_end,
          days: daysUntil(client.training_plan_end, today),
        });
      }

      return plans;
    })
    .filter((plan) => plan.days <= PLAN_WARNING_DAYS)
    .sort((a, b) => a.days - b.days);
}

function sortPlanOverview(clients: CoachClient[]): CoachClient[] {
  return [...clients]
    .filter((client) => client.nutrition_plan_end || client.training_plan_end)
    .sort((a, b) => {
      const earliest = (client: CoachClient) =>
        Math.min(
          client.nutrition_plan_end
            ? new Date(client.nutrition_plan_end).getTime()
            : Number.POSITIVE_INFINITY,
          client.training_plan_end
            ? new Date(client.training_plan_end).getTime()
            : Number.POSITIVE_INFINITY,
        );

      return earliest(a) - earliest(b);
    });
}

export function buildCoachDashboardViewModel(
  clients: CoachClient[],
  today = new Date(),
): CoachDashboardViewModel {
  const nowMs = today.getTime();
  const weekStart = mondayOf(today);

  const openWeek = clients.filter((client) => client.last_checkin !== weekStart);
  const inactive: InactiveCoachClient[] = clients
    .map((client) => ({ ...client, days: daysAgo(client.last_checkin, nowMs) }))
    .filter((client) => client.days === null || client.days >= 14)
    .sort((a, b) => (b.days ?? 999) - (a.days ?? 999));

  const recentMeasurements = [...clients]
    .filter((client) => client.last_weight_at)
    .sort((a, b) => new Date(b.last_weight_at!).getTime() - new Date(a.last_weight_at!).getTime())
    .slice(0, 6);

  const recentNutrition = [...clients]
    .filter((client) => client.last_nutrition_at)
    .sort(
      (a, b) => new Date(b.last_nutrition_at!).getTime() - new Date(a.last_nutrition_at!).getTime(),
    )
    .slice(0, 6);

  const recentTraining = [...clients]
    .filter((client) => client.last_training_at)
    .sort(
      (a, b) => new Date(b.last_training_at!).getTime() - new Date(a.last_training_at!).getTime(),
    )
    .slice(0, 6);

  const expiringPlans = collectExpiringPlans(clients, today);
  const planOverview = sortPlanOverview(clients);

  const scoreById = new Map<string, CoachScore>();
  clients.forEach((client) => {
    scoreById.set(client.id, calculateCoachScore(client, weekStart, today));
  });

  const scoreCounts: Record<CoachScoreLevel, number> = {
    green: 0,
    yellow: 0,
    red: 0,
  };
  scoreById.forEach((score) => {
    scoreCounts[score.level] += 1;
  });

  const redClients: ScoredCoachClient[] = clients
    .filter((client) => scoreById.get(client.id)?.level === "red")
    .map((client) => ({ ...client, _score: scoreById.get(client.id)! }))
    .sort((a, b) => a._score.score - b._score.score);

  return {
    weekStart,
    openWeek,
    inactive,
    recentMeasurements,
    recentNutrition,
    recentTraining,
    expiringPlans,
    planOverview,
    scoreById,
    scoreCounts,
    redClients,
  };
}

export function getPlanValidity(end: string | null, today = new Date()) {
  if (!end) {
    return { endDate: null, days: null, note: "—", warning: false } as const;
  }

  const endDate = new Date(end);
  const days = daysUntil(end, today);
  const note =
    days < 0
      ? `abgelaufen (vor ${Math.abs(days)} T.)`
      : days === 0
        ? "läuft heute aus"
        : `noch ${days} T.`;

  return {
    endDate,
    days,
    note,
    warning: days <= PLAN_WARNING_DAYS,
  } as const;
}
