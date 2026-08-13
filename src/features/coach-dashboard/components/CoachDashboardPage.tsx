import { CoachMessagesCard } from "@/components/bodyfuel/CoachMessagesCard";
import { CoachTrialOverview } from "@/components/bodyfuel/CoachTrialOverview";
import { PendingDraftsCard } from "@/components/bodyfuel/PendingDraftsCard";
import { TierMetricsCard } from "@/components/bodyfuel/TierMetricsCard";
import { CoachCustomerOverviewSection } from "@/features/coach-dashboard/components/CoachCustomerOverviewSection";
import { CoachDashboardHeader } from "@/features/coach-dashboard/components/CoachDashboardHeader";
import { CoachFuelyBriefing } from "@/features/coach-dashboard/components/CoachFuelyBriefing";
import { CoachFuelyFollowUps } from "@/features/coach-dashboard/components/CoachFuelyFollowUps";
import { CoachFuelyWorkload } from "@/features/coach-dashboard/components/CoachFuelyWorkload";
import { CoachRankingPanel } from "@/features/coach-dashboard/components/CoachRankingPanel";
import { useCoachDashboardController } from "@/features/coach-dashboard/hooks/useCoachDashboardController";
import type { CoachFollowUpCategory, CoachWorkloadKey } from "@/features/coach-dashboard/types";
import { useState } from "react";

export function CoachDashboardPage() {
  const [followUpFilter, setFollowUpFilter] = useState<CoachFollowUpCategory | null>(null);
  const [workloadFocus, setWorkloadFocus] = useState<CoachWorkloadKey | null>(null);
  const controller = useCoachDashboardController();
  const {
    clients,
    leads,
    productCounts,
    view,
    briefing,
    followUps,
    workload,
    isLoading,
    isError,
    error,
  } = controller;

  return (
    <div className="space-y-6">
      <CoachDashboardHeader
        weekStart={view.weekStart}
        clientCount={productCounts.coaching}
        leadCount={leads.length}
        pendingCheckinCount={view.pendingCheckins.length}
        expiringPlanCount={view.expiringPlans.length}
      />

      {isLoading && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Lade…
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Coach-Dashboard konnte nicht geladen werden."}
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-8">
          <CoachFuelyBriefing
            briefing={briefing}
            onOpenWorkload={(key) => {
              setWorkloadFocus(key);
              window.setTimeout(
                () =>
                  document
                    .getElementById("fuely-workload")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                0,
              );
            }}
          />
          <div id="fuely-workload" className="scroll-mt-24">
            <CoachFuelyWorkload
              workload={workload}
              focusKey={workloadFocus}
              onOpenFollowUps={(category) => setFollowUpFilter(category)}
            />
          </div>
          <CoachFuelyFollowUps
            drafts={followUps}
            selectedCategory={followUpFilter}
            onClearFilter={() => setFollowUpFilter(null)}
          />
          <CoachMessagesCard />
          <PendingDraftsCard
            redClients={view.redClients.map((client) => ({
              id: client.id,
              display_name: client.display_name,
            }))}
          />

          <details className="group rounded-3xl border border-border bg-card">
            <summary className="cursor-pointer list-none px-5 py-4 font-display text-lg font-bold">
              Kunden, Umsatz & Auswertungen
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                bei Bedarf öffnen
              </span>
            </summary>
            <div className="space-y-6 border-t border-border p-4 sm:p-5">
              <CoachCustomerOverviewSection
                clients={clients}
                planOverview={view.planOverview}
                recentMeasurements={view.recentMeasurements}
                recentNutrition={view.recentNutrition}
                recentTraining={view.recentTraining}
                scoreCounts={view.scoreCounts}
                redClients={view.redClients}
              />
              <TierMetricsCard />
              <CoachTrialOverview />
              <CoachRankingPanel />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
