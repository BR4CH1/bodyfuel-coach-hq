import { Link } from "@tanstack/react-router";
import { CalendarClock, ChevronRight, Dumbbell, Scale, Utensils } from "lucide-react";

import {
  CoachScoreCard,
  CustomerRow,
  Panel,
  PlanValidity,
  SectionHeader,
} from "@/features/coach-dashboard/components/CoachDashboardPrimitives";
import type {
  CoachClient,
  CoachScoreLevel,
  ScoredCoachClient,
} from "@/features/coach-dashboard/types";

export function CoachCustomerOverviewSection({
  clients,
  planOverview,
  recentMeasurements,
  recentNutrition,
  recentTraining,
  scoreCounts,
  redClients,
}: {
  clients: CoachClient[];
  planOverview: CoachClient[];
  recentMeasurements: CoachClient[];
  recentNutrition: CoachClient[];
  recentTraining: CoachClient[];
  scoreCounts: Record<CoachScoreLevel, number>;
  redClients: ScoredCoachClient[];
}) {
  return (
    <>
      <SectionHeader title="Kundenübersicht" subtitle="Pläne, Messungen, Aktivität" />
      <CoachScoreCard counts={scoreCounts} total={clients.length} redClients={redClients} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          icon={<CalendarClock className="h-5 w-5" />}
          title="Plan-Übersicht"
          empty={planOverview.length === 0}
          emptyText="Keine aktiven Pläne hinterlegt."
        >
          {planOverview.slice(0, 12).map((client) => (
            <Link
              key={client.id}
              to="/coach/customers/$userId"
              params={{ userId: client.id }}
              className="block rounded-xl border border-border bg-background/40 p-3 transition hover:border-gold/40"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-sm font-semibold">
                  {client.display_name ?? "Ohne Namen"}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                <PlanValidity label="Training" end={client.training_plan_end} />
                <PlanValidity label="Ernährung" end={client.nutrition_plan_end} />
              </div>
            </Link>
          ))}
        </Panel>

        <Panel
          icon={<Scale className="h-5 w-5" />}
          title="Letzte Messungen"
          empty={recentMeasurements.length === 0}
          emptyText="Noch keine Messungen erfasst"
        >
          {recentMeasurements.map((client) => (
            <CustomerRow
              key={client.id}
              id={client.id}
              name={client.display_name ?? "Ohne Namen"}
              meta={
                client.last_weight_at
                  ? `${client.last_weight ?? "—"} kg · ${new Date(client.last_weight_at).toLocaleDateString("de-DE")}`
                  : "—"
              }
              tone="info"
            />
          ))}
        </Panel>

        <Panel
          icon={<Utensils className="h-5 w-5" />}
          title="Letzte Eintragung Ernährung"
          empty={recentNutrition.length === 0}
          emptyText="Noch keine Ernährungs-Einträge"
        >
          {recentNutrition.map((client) => (
            <CustomerRow
              key={client.id}
              id={client.id}
              name={client.display_name ?? "Ohne Namen"}
              meta={`${client.last_nutrition_name ?? "Eintrag"} · ${new Date(client.last_nutrition_at!).toLocaleDateString("de-DE")}`}
              tone="info"
            />
          ))}
        </Panel>

        <Panel
          icon={<Dumbbell className="h-5 w-5" />}
          title="Letzte Eintragung Training"
          empty={recentTraining.length === 0}
          emptyText="Noch keine Trainings-Einträge"
        >
          {recentTraining.map((client) => (
            <CustomerRow
              key={client.id}
              id={client.id}
              name={client.display_name ?? "Ohne Namen"}
              meta={new Date(client.last_training_at!).toLocaleDateString("de-DE", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
              tone="info"
            />
          ))}
        </Panel>
      </div>
    </>
  );
}
