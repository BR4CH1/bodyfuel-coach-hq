import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Inbox,
  MessageCircleMore,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";

import { Fuely } from "@/components/bodyfuel/Fuely";
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
  CoachWorkloadViewModel,
} from "@/features/coach-dashboard/types";
import { cn } from "@/lib/utils";

const METRIC_ICONS: Record<CoachWorkloadKey, React.ReactNode> = {
  risk: <AlertTriangle className="h-4 w-4" />,
  checkin: <Clock3 className="h-4 w-4" />,
  plan: <CalendarClock className="h-4 w-4" />,
  lead: <Inbox className="h-4 w-4" />,
};

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
  const queue = useMemo(
    () => buildCoachTodayQueue(workload, intelligence),
    [workload, intelligence],
  );
  const visible = useMemo(() => filterCoachTodayQueue(queue, filter), [queue, filter]);
  const urgent = queue.filter((item) => item.priority === "urgent").length;

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
                  : "Kunden werden nur einmal angezeigt. Alle Gründe und Signale bleiben trotzdem sichtbar."}
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
            {workload.metrics.map((metric) => (
              <MetricButton
                key={metric.key}
                active={filter === metric.key}
                value={metric.value}
                label={metric.label}
                icon={METRIC_ICONS[metric.key]}
                tone={metric.tone}
                onClick={() => onFilterChange(metric.key)}
              />
            ))}
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
  onOpenFollowUps,
}: {
  item: CoachTodayItem;
  rank: number;
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
