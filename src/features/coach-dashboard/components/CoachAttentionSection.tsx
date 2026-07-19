import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, Clock, Inbox } from "lucide-react";

import {
  CustomerRow,
  Panel,
  SectionHeader,
} from "@/features/coach-dashboard/components/CoachDashboardPrimitives";
import type {
  CoachLead,
  CoachScore,
  ExpiringPlan,
  InactiveCoachClient,
  CoachClient,
} from "@/features/coach-dashboard/types";

export function CoachAttentionSection({
  openWeek,
  expiringPlans,
  inactive,
  leads,
  scoreById,
}: {
  openWeek: CoachClient[];
  expiringPlans: ExpiringPlan[];
  inactive: InactiveCoachClient[];
  leads: CoachLead[];
  scoreById: Map<string, CoachScore>;
}) {
  return (
    <>
      <SectionHeader title="Handlungsbedarf" subtitle="Was heute deine Aufmerksamkeit braucht" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          icon={<Clock className="h-5 w-5" />}
          title="Offene Check-ins (diese Woche)"
          empty={openWeek.length === 0}
          emptyText="Alle Kunden haben ihren Wochen-Check-in abgegeben 🎉"
          footer={
            <Link to="/coach/customers" className="text-xs font-semibold text-gold hover:underline">
              Alle Kunden ansehen →
            </Link>
          }
        >
          {openWeek.slice(0, 8).map((client) => (
            <CustomerRow
              key={client.id}
              id={client.id}
              name={client.display_name ?? "Ohne Namen"}
              kcalDev={client.kcal_dev}
              kcalDir={client.kcal_dev_dir}
              plateauDays={client.plateau_days}
              scoreLevel={scoreById.get(client.id)?.level ?? null}
              scoreValue={scoreById.get(client.id)?.score ?? null}
              meta={
                client.last_checkin
                  ? `Letzter Check-in ${new Date(client.last_checkin).toLocaleDateString("de-DE")}`
                  : "Noch nie eingecheckt"
              }
            />
          ))}
          {openWeek.length > 8 && (
            <div className="px-1 pt-1 text-xs text-muted-foreground">
              +{openWeek.length - 8} weitere
            </div>
          )}
        </Panel>

        <Panel
          icon={<CalendarClock className="h-5 w-5" />}
          title="Auslaufende Pläne (≤ 5 Tage)"
          empty={expiringPlans.length === 0}
          emptyText="Alle Pläne haben noch Laufzeit."
        >
          {expiringPlans.slice(0, 10).map((plan, index) => (
            <CustomerRow
              key={`${plan.id}-${plan.kind}-${index}`}
              id={plan.id}
              name={plan.name}
              warn
              meta={`${plan.kind === "training" ? "Trainingsplan" : "Ernährungsplan"} ${
                plan.days < 0
                  ? `seit ${Math.abs(plan.days)} Tagen abgelaufen`
                  : plan.days === 0
                    ? "läuft heute aus"
                    : `läuft in ${plan.days} Tagen aus (${new Date(plan.end).toLocaleDateString("de-DE")})`
              }`}
            />
          ))}
        </Panel>

        <Panel
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Risikowarnungen (Inaktiv 14+ Tage)"
          empty={inactive.length === 0}
          emptyText="Niemand inaktiv. Top!"
        >
          {inactive.slice(0, 8).map((client) => (
            <CustomerRow
              key={client.id}
              id={client.id}
              name={client.display_name ?? "Ohne Namen"}
              warn
              kcalDev={client.kcal_dev}
              kcalDir={client.kcal_dev_dir}
              plateauDays={client.plateau_days}
              scoreLevel={scoreById.get(client.id)?.level ?? null}
              scoreValue={scoreById.get(client.id)?.score ?? null}
              meta={
                client.days === null
                  ? "Noch nie eingecheckt"
                  : `Vor ${client.days} Tagen zuletzt aktiv`
              }
            />
          ))}
        </Panel>

        <Panel
          icon={<Inbox className="h-5 w-5" />}
          title="Neue Anfragen"
          empty={leads.length === 0}
          emptyText="Keine neuen Anfragen"
          footer={
            <Link to="/coach/leads" className="text-xs font-semibold text-gold hover:underline">
              Alle Anfragen →
            </Link>
          }
        >
          {leads.slice(0, 6).map((lead) => (
            <Link
              key={lead.id}
              to="/coach/leads"
              className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3 hover:border-gold/40"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold text-xs font-bold text-primary-foreground">
                {lead.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{lead.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {lead.goal ?? lead.email}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(lead.created_at).toLocaleDateString("de-DE")}
              </div>
            </Link>
          ))}
        </Panel>
      </div>
    </>
  );
}
