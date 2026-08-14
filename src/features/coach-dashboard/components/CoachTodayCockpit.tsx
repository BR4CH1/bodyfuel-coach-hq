import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Inbox,
  Loader2,
  MessageCircleMore,
  Sparkles,
  UserRoundSearch,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Fuely } from "@/components/bodyfuel/Fuely";
import {
  listCoachFollowUpActions,
  saveCoachFollowUpAction,
  type CoachFollowUpAction,
} from "@/features/coach-dashboard/lib/coach-followups.functions";
import {
  buildCoachTodayQueue,
  filterCoachTodayQueue,
  type CoachTodayCategory,
  type CoachTodayItem,
} from "@/features/coach-dashboard/lib/coach-today.logic";
import type {
  CoachFollowUpCategory,
  CoachIntelligenceViewModel,
  CoachWorkloadKey,
  CoachWorkloadMetric,
  CoachWorkloadViewModel,
} from "@/features/coach-dashboard/types";
import { cn } from "@/lib/utils";

const COMPLETED_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

const METRIC_ICONS: Record<CoachWorkloadKey, React.ReactNode> = {
  risk: <AlertTriangle className="h-4 w-4" />,
  checkin: <Clock3 className="h-4 w-4" />,
  plan: <CalendarClock className="h-4 w-4" />,
  lead: <Inbox className="h-4 w-4" />,
};

type ActionMap = Record<string, CoachFollowUpAction>;

export function CoachTodayCockpit({
  workload,
  intelligence,
  filter,
  onFilterChange,
  onOpenFollowUps,
}: {
  workload: CoachWorkloadViewModel;
  intelligence: CoachIntelligenceViewModel;
  filter: CoachWorkloadKey | "all";
  onFilterChange: (filter: CoachWorkloadKey | "all") => void;
  onOpenFollowUps?: (category: CoachFollowUpCategory) => void;
}) {
  const qc = useQueryClient();
  const listActionsFn = useServerFn(listCoachFollowUpActions);
  const saveActionFn = useServerFn(saveCoachFollowUpAction);
  const [localActions, setLocalActions] = useState<ActionMap>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const actionsQuery = useQuery({
    queryKey: ["coach-followup-actions"],
    queryFn: () => listActionsFn(),
    staleTime: 15_000,
  });

  const actions = useMemo<ActionMap>(() => {
    const serverActions = Object.fromEntries(
      (actionsQuery.data?.items ?? []).map((action) => [action.sourceSignalId, action]),
    );
    return { ...serverActions, ...localActions };
  }, [actionsQuery.data, localActions]);

  const rawQueue = useMemo(
    () => buildCoachTodayQueue(workload, intelligence),
    [workload, intelligence],
  );
  const queue = useMemo(
    () => rawQueue.filter((item) => hasOpenActionSignal(item.actionSignalIds, actions)),
    [rawQueue, actions],
  );
  const visible = useMemo(() => filterCoachTodayQueue(queue, filter), [queue, filter]);
  const urgent = queue.filter((item) => item.priority === "urgent").length;

  async function persistItemAction(item: CoachTodayItem, action: CoachFollowUpAction) {
    if (item.actionSignalIds.length === 0) return;
    const previousLocal = localActions;
    const nextActions = Object.fromEntries(
      item.actionSignalIds.map((sourceSignalId) => [
        sourceSignalId,
        { ...action, sourceSignalId } satisfies CoachFollowUpAction,
      ]),
    );

    setSavingItemId(item.id);
    setLocalActions((current) => ({ ...current, ...nextActions }));

    try {
      await Promise.all(
        Object.values(nextActions).map((nextAction) => saveActionFn({ data: nextAction })),
      );
      await qc.invalidateQueries({ queryKey: ["coach-followup-actions"] });
    } catch (error) {
      setLocalActions(previousLocal);
      toast.error(
        error instanceof Error
          ? error.message
          : "Status konnte nicht gespeichert werden. Bitte erneut versuchen.",
      );
      throw error;
    } finally {
      setSavingItemId(null);
    }
  }

  async function completeItem(item: CoachTodayItem) {
    try {
      await persistItemAction(item, {
        sourceSignalId: item.actionSignalIds[0] ?? item.id,
        status: "completed",
        completedAt: new Date().toISOString(),
        deliveryChannel: "manual",
      });
      toast.success(`${item.name}: erledigt`);
    } catch {
      /* error toast is handled by persistItemAction */
    }
  }

  async function snoozeItem(item: CoachTodayItem) {
    try {
      await persistItemAction(item, {
        sourceSignalId: item.actionSignalIds[0] ?? item.id,
        status: "snoozed",
        until: tomorrowAtEight().toISOString(),
      });
      toast.success(`${item.name}: morgen um 08:00 Uhr wieder sichtbar`);
    } catch {
      /* error toast is handled by persistItemAction */
    }
  }

  async function dismissItem(item: CoachTodayItem) {
    const choices =
      "Kein Handlungsbedarf | Bereits persönlich geklärt | Falsches Signal | Kunde pausiert | Sonstiges";
    const reason = window.prompt(
      `Grund fürs Ausblenden:\n${choices}`,
      "Bereits persönlich geklärt",
    );
    if (!reason?.trim()) return;

    try {
      await persistItemAction(item, {
        sourceSignalId: item.actionSignalIds[0] ?? item.id,
        status: "dismissed",
        reason: reason.trim(),
        completedAt: new Date().toISOString(),
        deliveryChannel: "manual",
      });
      toast.success(`${item.name}: ausgeblendet`);
    } catch {
      /* error toast is handled by persistItemAction */
    }
  }

  return (
    <section
      id="coach-today"
      className="scroll-mt-24 overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/10 via-card to-card"
    >
      <div className="border-b border-border/70 p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <Fuely
              emotion={urgent > 0 ? "focused" : queue.length > 0 ? "motivated" : "celebrating"}
              animation={queue.length === 0 ? "celebrate" : "idle"}
              size="lg"
              className="shrink-0"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Heute erledigen
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
                {queue.length === 0
                  ? "Alles sauber"
                  : urgent > 0
                    ? `${urgent} dringende ${urgent === 1 ? "Sache" : "Sachen"} zuerst`
                    : `${queue.length} offene ${queue.length === 1 ? "Aufgabe" : "Aufgaben"}`}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {queue.length === 0
                  ? "Aktuell wartet nichts Kritisches auf dich."
                  : "Kunden werden nur einmal angezeigt. Erledigen, verschieben oder ausblenden geht direkt hier."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:min-w-[560px]">
            <MetricButton
              active={filter === "all"}
              value={queue.length}
              label="Alle"
              icon={<Sparkles className="h-4 w-4" />}
              onClick={() => onFilterChange("all")}
            />
            {workload.metrics.map((metric) => {
              const value = openMetricCount(metric, actions);
              return (
                <MetricButton
                  key={metric.key}
                  active={filter === metric.key}
                  value={value}
                  label={metric.label}
                  icon={METRIC_ICONS[metric.key]}
                  tone={value === 0 ? "neutral" : metric.tone}
                  onClick={() => onFilterChange(metric.key)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {visible.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <div className="font-semibold">Keine offenen Fälle in diesem Filter</div>
              <div className="text-xs text-muted-foreground">
                Du kannst direkt zum nächsten Bereich weiter.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visible.slice(0, 16).map((item, index) => (
              <TodayRow
                key={item.id}
                item={item}
                rank={index + 1}
                isSaving={savingItemId === item.id}
                onComplete={() => completeItem(item)}
                onSnooze={() => snoozeItem(item)}
                onDismiss={() => dismissItem(item)}
                onOpenFollowUps={onOpenFollowUps}
              />
            ))}
            {visible.length > 16 && (
              <div className="px-2 pt-1 text-xs text-muted-foreground">
                +{visible.length - 16} weitere Fälle
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function MetricButton({
  active,
  value,
  label,
  icon,
  tone = "neutral",
  onClick,
}: {
  active: boolean;
  value: number;
  label: string;
  icon: React.ReactNode;
  tone?: "urgent" | "attention" | "info" | "neutral";
  onClick: () => void;
}) {
  const toneClass =
    tone === "urgent"
      ? "text-red-500"
      : tone === "attention"
        ? "text-amber-500"
        : tone === "info"
          ? "text-gold"
          : "text-muted-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gold/40",
        active
          ? "border-gold/60 bg-gold/12 shadow-sm"
          : "border-border bg-background/45 hover:border-gold/35",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={toneClass}>{icon}</span>
        <span className="font-display text-xl font-bold">{value}</span>
      </div>
      <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </button>
  );
}

function TodayRow({
  item,
  rank,
  isSaving,
  onComplete,
  onSnooze,
  onDismiss,
  onOpenFollowUps,
}: {
  item: CoachTodayItem;
  rank: number;
  isSaving: boolean;
  onComplete: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
  onOpenFollowUps?: (category: CoachFollowUpCategory) => void;
}) {
  const followUpCategory = bestFollowUpCategory(item.categories);
  const hasCheckin = item.categories.includes("checkin");

  return (
    <article
      className={cn(
        "rounded-2xl border p-3.5 transition hover:border-gold/35 sm:p-4",
        item.priority === "urgent"
          ? "border-red-500/30 bg-red-500/7"
          : item.priority === "attention"
            ? "border-amber-500/25 bg-amber-500/6"
            : "border-border bg-background/45",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full border font-display text-xs font-bold",
            item.priority === "urgent"
              ? "border-red-500/40 bg-red-500/10 text-red-500"
              : item.priority === "attention"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                : "border-gold/30 bg-gold/8 text-gold",
          )}
        >
          {rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold">{item.name}</h3>
            {item.categories.map((category) => (
              <SignalBadge key={category} category={category} />
            ))}
          </div>
          <div className="mt-1.5 space-y-0.5 text-xs leading-relaxed text-muted-foreground">
            {item.reasons.slice(0, 3).map((reason) => (
              <div key={reason}>• {reason}</div>
            ))}
          </div>
        </div>

        <ChevronRight className="mt-1 hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2 sm:pl-11">
        {item.target.kind === "customer" ? (
          <Link
            to="/coach/customers/$userId"
            params={{ userId: item.target.userId }}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-background/60 px-3 text-xs font-semibold transition hover:border-gold/50 hover:text-gold"
          >
            <UserRoundSearch className="mr-1.5 h-4 w-4" />
            {hasCheckin ? "Check-in prüfen" : "Profil öffnen"}
          </Link>
        ) : (
          <Link
            to="/coach/leads"
            className="inline-flex h-9 items-center rounded-lg border border-border bg-background/60 px-3 text-xs font-semibold transition hover:border-gold/50 hover:text-gold"
          >
            <Inbox className="mr-1.5 h-4 w-4" /> Anfrage öffnen
          </Link>
        )}

        {followUpCategory && (
          <button
            type="button"
            onClick={() => onOpenFollowUps?.(followUpCategory)}
            className="inline-flex h-9 items-center rounded-lg bg-gold px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-105"
          >
            <MessageCircleMore className="mr-1.5 h-4 w-4" /> Follow-up
          </button>
        )}

        <button
          type="button"
          onClick={onComplete}
          disabled={isSaving}
          className="inline-flex h-9 items-center rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-400"
        >
          {isSaving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-4 w-4" />
          )}
          Erledigt
        </button>
        <button
          type="button"
          onClick={onSnooze}
          disabled={isSaving}
          className="inline-flex h-9 items-center rounded-lg border border-border bg-background/60 px-3 text-xs font-semibold transition hover:border-amber-500/40 hover:text-amber-500 disabled:opacity-50"
        >
          <Clock3 className="mr-1.5 h-4 w-4" /> Morgen erinnern
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={isSaving}
          className="inline-flex h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
          title="Diesen aktuellen Fall dauerhaft ausblenden"
        >
          <X className="mr-1 h-4 w-4" /> Ausblenden
        </button>
      </div>
    </article>
  );
}

function SignalBadge({ category }: { category: CoachTodayCategory }) {
  const label =
    category === "risk"
      ? "Risiko"
      : category === "checkin"
        ? "Check-in"
        : category === "plan"
          ? "Plan"
          : category === "lead"
            ? "Lead"
            : category === "stagnation"
              ? "Stagnation"
              : "Aufmerksamkeit";
  const tone =
    category === "risk"
      ? "border-red-500/30 bg-red-500/10 text-red-500"
      : category === "checkin" || category === "plan" || category === "stagnation"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
        : category === "lead"
          ? "border-gold/30 bg-gold/8 text-gold"
          : "border-border bg-background/60 text-muted-foreground";

  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone)}>
      {label}
    </span>
  );
}

function bestFollowUpCategory(categories: CoachTodayCategory[]): CoachFollowUpCategory | null {
  if (categories.includes("risk")) return "risk";
  if (categories.includes("stagnation")) return "stagnation";
  if (categories.includes("plan")) return "plan";
  if (categories.includes("lead")) return "lead";
  if (categories.includes("attention")) return "attention";
  return null;
}

function tomorrowAtEight() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  return date;
}

function isActionHidden(action: CoachFollowUpAction | undefined, now = Date.now()) {
  if (!action) return false;
  if (action.status === "dismissed") return true;
  if (action.status === "snoozed") {
    return Boolean(action.until && new Date(action.until).getTime() > now);
  }
  if (action.status === "completed") {
    const completedAt = action.completedAt ? new Date(action.completedAt).getTime() : now;
    return now - completedAt < COMPLETED_COOLDOWN_MS;
  }
  return false;
}

function hasOpenActionSignal(signalIds: string[], actions: ActionMap) {
  if (signalIds.length === 0) return true;
  const now = Date.now();
  return signalIds.some((sourceSignalId) => !isActionHidden(actions[sourceSignalId], now));
}

function openMetricCount(metric: CoachWorkloadMetric, actions: ActionMap) {
  const now = Date.now();
  return metric.items.reduce((count, item) => {
    const signalIds = item.actionSignalIds?.length ? item.actionSignalIds : [item.sourceSignalId];
    return (
      count + signalIds.filter((sourceSignalId) => !isActionHidden(actions[sourceSignalId], now)).length
    );
  }, 0);
}
