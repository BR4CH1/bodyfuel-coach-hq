import { Link } from "@tanstack/react-router";
import { Activity, CalendarClock, Clock, Inbox, Users } from "lucide-react";

import { StatPill } from "@/features/coach-dashboard/components/CoachDashboardPrimitives";

export function CoachDashboardHeader({
  weekStart,
  clientCount,
  leadCount,
  openCheckinCount,
  expiringPlanCount,
  showPerformanceNavigation,
  performancePending,
}: {
  weekStart: string;
  clientCount: number;
  leadCount: number;
  openCheckinCount: number;
  expiringPlanCount: number;
  showPerformanceNavigation: boolean;
  performancePending: number;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Woche ab {new Date(weekStart).toLocaleDateString("de-DE")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatPill icon={<Users className="h-4 w-4" />} value={clientCount} label="Kunden" />
        <StatPill icon={<Inbox className="h-4 w-4" />} value={leadCount} label="Neue Leads" />
        <StatPill
          icon={<Clock className="h-4 w-4" />}
          value={openCheckinCount}
          label="Check-in offen"
          warn={openCheckinCount > 0}
        />
        <StatPill
          icon={<CalendarClock className="h-4 w-4" />}
          value={expiringPlanCount}
          label="Pläne laufen aus"
          warn={expiringPlanCount > 0}
        />

        <QuickLink to="/coach/package-requests" icon="📦" label="Paketanfragen" />
        <QuickLink to="/coach/gifts" icon="🎁" label="Geschenklinks" />
        <QuickLink to="/coach/affiliates" icon="🤝" label="Affiliate Partner" />
        <QuickLink to="/coach/foods" icon="🥗" label="Lebensmittel-DB" />

        {showPerformanceNavigation && (
          <Link
            to="/coach/bulls-performance"
            className="relative flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:border-bulls-red/60"
          >
            <Activity className="h-4 w-4 text-bulls-red" />
            <span className="font-display text-sm font-bold">Performance Tests</span>
            {performancePending > 0 && (
              <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-bulls-red px-1.5 py-0.5 text-[10px] font-bold text-white">
                {performancePending}
              </span>
            )}
          </Link>
        )}
        {showPerformanceNavigation && (
          <QuickLink
            to="/coach/player-cards"
            icon="🎴"
            label="Player Cards"
            className="hover:border-bulls-red/60"
            iconClassName="text-bulls-red"
          />
        )}
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  label,
  className = "hover:border-gold/40",
  iconClassName = "text-gold",
}: {
  to:
    | "/coach/package-requests"
    | "/coach/gifts"
    | "/coach/affiliates"
    | "/coach/foods"
    | "/coach/player-cards";
  icon: string;
  label: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm ${className}`}
    >
      <span className={iconClassName}>{icon}</span>
      <span className="font-display text-sm font-bold">{label}</span>
    </Link>
  );
}
