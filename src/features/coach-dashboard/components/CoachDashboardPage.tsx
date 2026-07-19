import { CoachDashboardSummary } from "@/components/bodyfuel/CoachDashboardSummary";
import { CoachMessagesCard } from "@/components/bodyfuel/CoachMessagesCard";
import { CoachRadarCard } from "@/components/bodyfuel/CoachRadarCard";
import { CoachTaskInboxCard } from "@/components/bodyfuel/CoachTaskInboxCard";
import { CoachTrialOverview } from "@/components/bodyfuel/CoachTrialOverview";
import { PendingDraftsCard } from "@/components/bodyfuel/PendingDraftsCard";
import { TierMetricsCard } from "@/components/bodyfuel/TierMetricsCard";
import { CoachAttentionSection } from "@/features/coach-dashboard/components/CoachAttentionSection";
import { CoachCustomerOverviewSection } from "@/features/coach-dashboard/components/CoachCustomerOverviewSection";
import { CoachDashboardHeader } from "@/features/coach-dashboard/components/CoachDashboardHeader";
import { CoachFuelyBriefing } from "@/features/coach-dashboard/components/CoachFuelyBriefing";
import { CoachFuelyFollowUps } from "@/features/coach-dashboard/components/CoachFuelyFollowUps";
import { CoachPerformanceNotice } from "@/features/coach-dashboard/components/CoachPerformanceNotice";
import { CoachRankingPanel } from "@/features/coach-dashboard/components/CoachRankingPanel";
import { SectionHeader } from "@/features/coach-dashboard/components/CoachDashboardPrimitives";
import { useCoachDashboardController } from "@/features/coach-dashboard/hooks/useCoachDashboardController";

export function CoachDashboardPage() {
  const controller = useCoachDashboardController();
  const {
    clients,
    leads,
    view,
    radar,
    showPerformanceNavigation,
    performancePending,
    briefing,
    followUps,
    isLoading,
    isError,
    error,
  } = controller;

  return (
    <div className="space-y-6">
      <CoachDashboardHeader
        weekStart={view.weekStart}
        clientCount={clients.length}
        leadCount={leads.length}
        openCheckinCount={view.openWeek.length}
        expiringPlanCount={view.expiringPlans.length}
        showPerformanceNavigation={showPerformanceNavigation}
        performancePending={performancePending}
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
          <CoachFuelyBriefing briefing={briefing} />
          <CoachFuelyFollowUps drafts={followUps} />
          <CoachDashboardSummary data={radar} />
          <CoachRadarCard data={radar} />
          <CoachTaskInboxCard data={radar} />

          {showPerformanceNavigation && <CoachPerformanceNotice pending={performancePending} />}

          <TierMetricsCard />
          <CoachMessagesCard />
          <PendingDraftsCard
            redClients={view.redClients.map((client) => ({
              id: client.id,
              display_name: client.display_name,
            }))}
          />

          <CoachAttentionSection
            openWeek={view.openWeek}
            expiringPlans={view.expiringPlans}
            inactive={view.inactive}
            leads={leads}
            scoreById={view.scoreById}
          />

          <CoachCustomerOverviewSection
            clients={clients}
            planOverview={view.planOverview}
            recentMeasurements={view.recentMeasurements}
            recentNutrition={view.recentNutrition}
            recentTraining={view.recentTraining}
            scoreCounts={view.scoreCounts}
            redClients={view.redClients}
          />

          <SectionHeader title="Umsatz & Conversion" subtitle="Trials und Paketanfragen" />
          <CoachTrialOverview />

          <SectionHeader title="Community & Rankings" subtitle="Top-Athleten im Zeitraum" />
          <CoachRankingPanel />
        </div>
      )}
    </div>
  );
}
