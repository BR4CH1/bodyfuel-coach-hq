import type {
  CoachFollowUpTarget,
  CoachIntelligenceViewModel,
  CoachWorkloadKey,
  CoachWorkloadViewModel,
} from "@/features/coach-dashboard/types";

export type CoachTodayCategory = CoachWorkloadKey | "stagnation" | "attention";
export type CoachTodayPriority = "urgent" | "attention" | "info";

export type CoachTodayItem = {
  id: string;
  name: string;
  target: CoachFollowUpTarget;
  priority: CoachTodayPriority;
  categories: CoachTodayCategory[];
  reasons: string[];
  actionSignalIds: string[];
};

const PRIORITY_RANK: Record<CoachTodayPriority, number> = {
  urgent: 0,
  attention: 1,
  info: 2,
};

function mergePriority(current: CoachTodayPriority, next: CoachTodayPriority): CoachTodayPriority {
  return PRIORITY_RANK[next] < PRIORITY_RANK[current] ? next : current;
}

function queueKey(target: CoachFollowUpTarget) {
  return target.kind === "customer" ? `customer:${target.userId}` : `lead:${target.leadId}`;
}

function addReason(item: CoachTodayItem, reason: string) {
  const trimmed = reason.trim();
  if (trimmed && !item.reasons.includes(trimmed)) item.reasons.push(trimmed);
}

function addCategory(item: CoachTodayItem, category: CoachTodayCategory) {
  if (!item.categories.includes(category)) item.categories.push(category);
}

function addActionSignalIds(item: CoachTodayItem, ids: string[]) {
  ids.forEach((id) => {
    if (id && !item.actionSignalIds.includes(id)) item.actionSignalIds.push(id);
  });
}

export function buildCoachTodayQueue(
  workload: CoachWorkloadViewModel,
  intelligence: CoachIntelligenceViewModel,
): CoachTodayItem[] {
  const queue = new Map<string, CoachTodayItem>();

  const upsert = (
    target: CoachFollowUpTarget,
    name: string,
    category: CoachTodayCategory,
    priority: CoachTodayPriority,
    reason: string,
    actionSignalIds: string[],
  ) => {
    const key = queueKey(target);
    const current = queue.get(key) ?? {
      id: key,
      name,
      target,
      priority,
      categories: [],
      reasons: [],
      actionSignalIds: [],
    };
    current.priority = mergePriority(current.priority, priority);
    addCategory(current, category);
    addReason(current, reason);
    addActionSignalIds(current, actionSignalIds);
    queue.set(key, current);
  };

  workload.metrics.forEach((metric) => {
    const priority: CoachTodayPriority =
      metric.key === "risk" ? "urgent" : metric.key === "lead" ? "info" : "attention";
    metric.items.forEach((item) => {
      upsert(
        item.target,
        item.name,
        metric.key,
        priority,
        item.reason,
        item.actionSignalIds?.length ? item.actionSignalIds : [item.sourceSignalId],
      );
    });
  });

  intelligence.stagnating.forEach((signal) => {
    upsert(
      { kind: "customer", userId: signal.userId },
      signal.name,
      "stagnation",
      signal.severity === "urgent" ? "urgent" : "attention",
      signal.detail,
      [signal.id],
    );
  });

  intelligence.atRisk.forEach((signal) => {
    upsert(
      { kind: "customer", userId: signal.userId },
      signal.name,
      "risk",
      "urgent",
      signal.detail,
      [signal.id],
    );
  });

  intelligence.needsAttention.forEach((signal) => {
    upsert(
      { kind: "customer", userId: signal.userId },
      signal.name,
      "attention",
      "attention",
      signal.detail,
      [signal.id],
    );
  });

  return [...queue.values()].sort((left, right) => {
    const priority = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    if (priority !== 0) return priority;

    const leftSignalRank = left.categories.includes("risk")
      ? 0
      : left.categories.includes("checkin")
        ? 1
        : left.categories.includes("plan")
          ? 2
          : left.categories.includes("stagnation")
            ? 3
            : left.categories.includes("attention")
              ? 4
              : 5;
    const rightSignalRank = right.categories.includes("risk")
      ? 0
      : right.categories.includes("checkin")
        ? 1
        : right.categories.includes("plan")
          ? 2
          : right.categories.includes("stagnation")
            ? 3
            : right.categories.includes("attention")
              ? 4
              : 5;

    if (leftSignalRank !== rightSignalRank) return leftSignalRank - rightSignalRank;
    return left.name.localeCompare(right.name, "de");
  });
}

export function filterCoachTodayQueue(
  items: CoachTodayItem[],
  filter: CoachWorkloadKey | "all",
) {
  return filter === "all" ? items : items.filter((item) => item.categories.includes(filter));
}
