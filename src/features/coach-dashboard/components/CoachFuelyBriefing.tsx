import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Inbox,
  Users,
} from "lucide-react";

import { Fuely } from "@/components/bodyfuel/Fuely";
import type {
  CoachBriefingItem,
  CoachBriefingItemTone,
  CoachBriefingViewModel,
} from "@/features/coach-dashboard/types";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<CoachBriefingItemTone, string> = {
  urgent: "border-red-500/30 bg-red-500/8 hover:border-red-500/55",
  attention: "border-amber-500/30 bg-amber-500/8 hover:border-amber-500/55",
  info: "border-gold/25 bg-gold/5 hover:border-gold/50",
};

export function CoachFuelyBriefing({
  briefing,
  onOpenWorkload,
}: {
  briefing: CoachBriefingViewModel;
  onOpenWorkload?: (key: "risk" | "checkin" | "plan" | "lead") => void;
}) {
  const isClear = briefing.state === "clear";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border p-5 sm:p-6",
        isClear
          ? "border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card"
          : "border-gold/25 bg-gradient-to-br from-gold/10 via-card to-card",
      )}
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4 lg:w-[290px] lg:shrink-0">
          <Fuely
            emotion={briefing.emotion}
            animation={isClear ? "celebrate" : "idle"}
            size="lg"
            className="shrink-0"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Fuely Briefing
            </p>
            <h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">{briefing.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{briefing.summary}</p>
          </div>
        </div>

        {isClear ? (
          <div className="flex min-h-24 flex-1 items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            <div>
              <div className="font-semibold">Keine offenen Prioritäten</div>
              <div className="text-sm text-muted-foreground">
                Nutze die freie Zeit für Kundenfeedback, Content oder neue Leads.
              </div>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 gap-3 md:grid-cols-3">
            {briefing.items.map((item, index) => (
              <BriefingAction
                key={item.id}
                item={item}
                rank={index + 1}
                onOpenWorkload={onOpenWorkload}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function BriefingAction({
  item,
  rank,
  onOpenWorkload,
}: {
  item: CoachBriefingItem;
  rank: number;
  onOpenWorkload?: (key: "risk" | "checkin" | "plan" | "lead") => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-background/70 font-display text-xs font-bold">
            {rank}
          </span>
          <span className="text-gold">{getItemIcon(item)}</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 font-display text-base font-bold leading-tight">{item.title}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</div>
      <div className="mt-3 text-xs font-semibold text-gold">{item.actionLabel} →</div>
    </>
  );

  const className = cn(
    "block min-h-36 rounded-2xl border p-4 transition hover:-translate-y-0.5",
    TONE_STYLES[item.tone],
  );

  switch (item.target.kind) {
    case "customer":
      return (
        <Link
          to="/coach/customers/$userId"
          params={{ userId: item.target.userId }}
          className={className}
        >
          {content}
        </Link>
      );
    case "customers":
      if (onOpenWorkload) {
        const key = item.id.includes("checkin")
          ? "checkin"
          : item.id.includes("plan")
            ? "plan"
            : "risk";
        return (
          <button
            type="button"
            onClick={() => onOpenWorkload(key)}
            className={cn(className, "text-left")}
          >
            {content}
          </button>
        );
      }
      return (
        <Link to="/coach/customers" className={className}>
          {content}
        </Link>
      );
    case "leads":
      return (
        <Link to="/coach/leads" className={className}>
          {content}
        </Link>
      );
    case "performance":
      return (
        <Link to="/coach/bulls-performance" className={className}>
          {content}
        </Link>
      );
  }
}

function getItemIcon(item: CoachBriefingItem) {
  if (item.id.startsWith("risk")) return <AlertTriangle className="h-4 w-4" />;
  if (item.id.includes("plan")) return <CalendarClock className="h-4 w-4" />;
  if (item.id === "new-leads") return <Inbox className="h-4 w-4" />;
  if (item.id === "performance-checks") return <Activity className="h-4 w-4" />;
  if (item.id.includes("checkins")) return <Clock3 className="h-4 w-4" />;
  return <Users className="h-4 w-4" />;
}
