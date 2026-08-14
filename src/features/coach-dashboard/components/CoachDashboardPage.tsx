import { useState } from "react";

import { CoachMessagesCard } from "@/components/bodyfuel/CoachMessagesCard";
import { CoachTrialOverview } from "@/components/bodyfuel/CoachTrialOverview";
import { PendingDraftsCard } from "@/components/bodyfuel/PendingDraftsCard";
import { TierMetricsCard } from "@/components/bodyfuel/TierMetricsCard";
import { CoachCustomerOverviewSection } from "@/features/coach-dashboard/components/CoachCustomerOverviewSection";
import { CoachDashboardHeader } from "@/features/coach-dashboard/components/CoachDashboardHeader";
import { CoachFuelyFollowUps } from "@/features/coach-dashboard/components/CoachFuelyFollowUps";
import { CoachPushCard } from "@/features/coach-dashboard/components/CoachPushCard";
import { CoachRankingPanel } from "@/features/coach-dashboard/components/CoachRankingPanel";
import { CoachTodayCockpit } from "@/features/coach-dashboard/components/CoachTodayCockpit";
import { useCoachDashboardController } from "@/features/coach-dashboard/hooks/useCoachDashboardController";
import type { CoachFollowUpCategory, CoachWorkloadKey } from "@/features/coach-dashboard/types";

export function CoachDashboardPage() {
  const [followUpFilter, setFollowUpFilter] = useState<CoachFollowUpCategory | null>(null);
  const [todayFilter, setTodayFilter] = useState<CoachWorkloadKey | "all">("all");
  const controller = useCoachDashboardController();
  const {
    clients,
    leads,
    productCounts,
    view,
    followUps,
    workload,
    intelligence,
    isLoading,
    isError,
    error,
  } = controller;

  const focusToday = (filter: CoachWorkloadKey) => {
    setTodayFilter(filter);
    window.setTimeout(
      () =>
        document
          .getElementById("coach-today")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };

  const openFollowUps = (category: CoachFollowUpCategory) => {
    setFollowUpFilter(category);
    window.setTimeout(
      () =>
        document
          .getElementById("fuely-followups")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };

  return (
    <div className="space-y-6">
      <CoachDashboardHeader
        weekStart={view.weekStart}
        clientCount={productCounts.coaching}
        leadCount={leads.length}
        pendingCheckinCount={view.pendingCheckins.length}
        expiringPlanCount={view.expiringPlans.length}
        onOpenToday={focusToday}
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
          <CoachPushCard />

          <CoachTodayCockpit
            workload={workload}
            intelligence={intelligence}
            filter={todayFilter}
            onFilterChange={setTodayFilter}
            onOpenFollowUps={openFollowUps}
          />

          <CoachMessagesCard />

          <CoachFuelyFollowUps
            drafts={followUps}
            selectedCategory={followUpFilter}
            onClearFilter={() => setFollowUpFilter(null)}
          />

          <PendingDraftsCard
            redClients={view.redClients.map((client) => ({
              id: client.id,
              display_name: client.display_name,
            }))}
          />

          <details className="group rounded-3xl border border-border bg-card">
            <summary className="cursor-pointer list-none px-5 py-4 font-display text-lg font-bold">
              Kunden & Conversions
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                Analyse und Gesamtübersicht
              </span>
            </summary>
            <div className="space-y-6 border-t border-border p-4 sm:p-5">
              <CoachCustomerOverviewSection
                clients={clients}
                scoreCounts={view.scoreCounts}
                scoreById={view.scoreById}
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
