import { Link } from "@tanstack/react-router";
import { CalendarClock, ChevronDown, Clock, Inbox, Settings2, Users } from "lucide-react";

import { StatPill } from "@/features/coach-dashboard/components/CoachDashboardPrimitives";
import type { CoachWorkloadKey } from "@/features/coach-dashboard/types";

export function CoachDashboardHeader({
  weekStart,
  clientCount,
  leadCount,
  pendingCheckinCount,
  expiringPlanCount,
  onOpenToday,
}: {
  weekStart: string;
  clientCount: number;
  leadCount: number;
  pendingCheckinCount: number;
  expiringPlanCount: number;
  onOpenToday?: (filter: CoachWorkloadKey) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Woche ab {new Date(weekStart).toLocaleDateString("de-DE")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Link
          to="/coach/customers"
          className="rounded-xl outline-none transition hover:-translate-y-0.5 focus:ring-2 focus:ring-gold/40"
          title="Alle Coaching-Kunden öffnen"
        >
          <StatPill icon={<Users className="h-4 w-4" />} value={clientCount} label="aktive Kunden" />
        </Link>
        <button
          type="button"
          onClick={() => onOpenToday?.("lead")}
          className="rounded-xl text-left outline-none transition hover:-translate-y-0.5 focus:ring-2 focus:ring-gold/40"
          title="Neue Leads im Heute-Bereich anzeigen"
        >
          <StatPill icon={<Inbox className="h-4 w-4" />} value={leadCount} label="Neue Leads" warn={leadCount > 0} />
        </button>
        <button
          type="button"
          onClick={() => onOpenToday?.("checkin")}
          className="rounded-xl text-left outline-none transition hover:-translate-y-0.5 focus:ring-2 focus:ring-gold/40"
          title="Offene Check-ins im Heute-Bereich anzeigen"
        >
          <StatPill
            icon={<Clock className="h-4 w-4" />}
            value={pendingCheckinCount}
            label="Check-ins zu prüfen"
            warn={pendingCheckinCount > 0}
          />
        </button>
        <button
          type="button"
          onClick={() => onOpenToday?.("plan")}
          className="rounded-xl text-left outline-none transition hover:-translate-y-0.5 focus:ring-2 focus:ring-gold/40"
          title="Auslaufende Pläne im Heute-Bereich anzeigen"
        >
          <StatPill
            icon={<CalendarClock className="h-4 w-4" />}
            value={expiringPlanCount}
            label="Pläne laufen aus"
            warn={expiringPlanCount > 0}
          />
        </button>
      </div>

      <details className="group rounded-2xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
          <span className="inline-flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-gold" /> Weitere Coach-Tools
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink to="/coach/package-requests" icon="📦" label="Paketanfragen" />
          <QuickLink to="/coach/gifts" icon="🎁" label="Geschenklinks" />
          <QuickLink to="/coach/affiliates" icon="🤝" label="Affiliate Partner" />
          <QuickLink to="/coach/foods" icon="🥗" label="Lebensmittel-DB" />
        </div>
      </details>
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
  to: "/coach/package-requests" | "/coach/gifts" | "/coach/affiliates" | "/coach/foods";
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
