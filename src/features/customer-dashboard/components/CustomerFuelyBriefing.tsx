import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Dumbbell,
  Gauge,
  Ruler,
  Utensils,
} from "lucide-react";

import { Fuely } from "@/components/bodyfuel/Fuely";
import type {
  CustomerBriefingItem,
  CustomerBriefingItemTone,
  CustomerBriefingViewModel,
} from "@/features/customer-dashboard/types";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<CustomerBriefingItemTone, string> = {
  urgent: "border-red-500/35 bg-red-500/8 hover:border-red-500/60",
  attention: "border-amber-500/30 bg-amber-500/8 hover:border-amber-500/55",
  info: "border-gold/25 bg-gold/5 hover:border-gold/50",
};

export function CustomerFuelyBriefing({ briefing }: { briefing: CustomerBriefingViewModel }) {
  const clear = briefing.state === "clear";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border p-5 sm:p-6",
        clear
          ? "border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card"
          : "border-gold/25 bg-gradient-to-br from-gold/10 via-card to-card",
      )}
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Fuely
              emotion={briefing.emotion}
              animation={clear ? "bounce" : "idle"}
              size="lg"
              className="shrink-0"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Fuely Tagesbriefing
              </p>
              <h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">{briefing.title}</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{briefing.summary}</p>
            </div>
          </div>

          <DailyProgress briefing={briefing} />
        </div>

        {clear ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            <div>
              <div className="font-semibold">Alles für heute erledigt</div>
              <div className="text-sm text-muted-foreground">
                Du kannst dich zurücklehnen oder schon den nächsten Tag vorbereiten.
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {briefing.items.map((item, index) => (
              <BriefingAction key={item.id} item={item} rank={index + 1} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function CustomerFuelyBriefingSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 rounded-full bg-secondary" />
        <div className="flex-1 space-y-3">
          <div className="h-3 w-32 rounded bg-secondary" />
          <div className="h-7 w-56 rounded bg-secondary" />
          <div className="h-4 max-w-md rounded bg-secondary" />
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-32 rounded-2xl bg-secondary/70" />
        ))}
      </div>
    </div>
  );
}

function DailyProgress({ briefing }: { briefing: CustomerBriefingViewModel }) {
  const { trainedToday, measuredToday, todayPoints, maxDailyPoints } = briefing.progress;
  const pointProgress = maxDailyPoints > 0 ? Math.round((todayPoints / maxDailyPoints) * 100) : 100;

  return (
    <div className="grid grid-cols-3 gap-2 lg:min-w-[330px]">
      <ProgressPill
        label="Training"
        complete={trainedToday}
        value={trainedToday ? "Erledigt" : "Offen"}
      />
      <ProgressPill
        label="Messung"
        complete={measuredToday}
        value={measuredToday ? "Erledigt" : "Offen"}
      />
      <div className="rounded-2xl border border-border bg-background/55 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Punkte</span>
          <Gauge className="h-3.5 w-3.5 text-gold" />
        </div>
        <div className="mt-1 font-display text-sm font-bold">
          {todayPoints}/{maxDailyPoints}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-gold"
            style={{ width: `${pointProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ProgressPill({
  label,
  value,
  complete,
}: {
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/55 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span
          className={cn(
            "grid h-4 w-4 place-items-center rounded-full",
            complete ? "bg-emerald-500 text-white" : "border border-muted-foreground/40",
          )}
        >
          {complete && <Check className="h-3 w-3" />}
        </span>
      </div>
      <div
        className={cn(
          "mt-2 text-xs font-semibold",
          complete ? "text-emerald-500" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function BriefingAction({ item, rank }: { item: CustomerBriefingItem; rank: number }) {
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
    case "checkin":
      return (
        <Link to="/check-in" className={className}>
          {content}
        </Link>
      );
    case "daily-checklist":
      return (
        <Link to="/daily-checklist" className={className}>
          {content}
        </Link>
      );
    case "training":
      return (
        <Link to="/training" className={className}>
          {content}
        </Link>
      );
    case "measurements":
      return (
        <Link to="/measurements" className={className}>
          {content}
        </Link>
      );
    case "nutrition":
      return (
        <Link to="/nutrition" className={className}>
          {content}
        </Link>
      );
  }
}

function getItemIcon(item: CustomerBriefingItem) {
  if (item.id.startsWith("checkin")) return <ClipboardCheck className="h-4 w-4" />;
  if (item.id.includes("measurement") || item.id.includes("measures")) {
    return <Ruler className="h-4 w-4" />;
  }
  if (item.id === "daily-points") return <Gauge className="h-4 w-4" />;
  if (item.id === "training-open") return <Dumbbell className="h-4 w-4" />;
  if (item.id.includes("plan")) return <Utensils className="h-4 w-4" />;
  return <AlertTriangle className="h-4 w-4" />;
}
