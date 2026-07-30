import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { loadCoachDashboardData } from "@/features/coach-dashboard/lib/coach-dashboard.data";
import { buildCoachDashboardViewModel } from "@/features/coach-dashboard/lib/coach-dashboard.logic";
import { buildCoachBriefing } from "@/features/coach-dashboard/lib/coach-briefing.logic";
import { buildCoachFollowUps } from "@/features/coach-dashboard/lib/coach-followups.logic";
import { buildCoachWorkload } from "@/features/coach-dashboard/lib/coach-workload.logic";
import { buildCoachIntelligence } from "@/features/coach-dashboard/lib/coach-intelligence.logic";
import type { CoachClient, CoachLead } from "@/features/coach-dashboard/types";

const EMPTY_CLIENTS: CoachClient[] = [];
const EMPTY_LEADS: CoachLead[] = [];

export function useCoachDashboardController() {
  const dashboardQuery = useQuery({
    queryKey: ["coach-dashboard-data"],
    queryFn: loadCoachDashboardData,
    staleTime: 30_000,
  });

  const clients = dashboardQuery.data?.clients ?? EMPTY_CLIENTS;
  const leads = dashboardQuery.data?.leads ?? EMPTY_LEADS;
  const view = useMemo(() => buildCoachDashboardViewModel(clients), [clients]);
  const briefing = useMemo(
    () =>
      buildCoachBriefing({
        view,
        leads,
        performancePending: 0,
        showPerformanceNavigation: false,
      }),
    [view, leads],
  );
  const workload = useMemo(() => buildCoachWorkload(view, leads), [view, leads]);
  const intelligence = useMemo(() => buildCoachIntelligence(view, clients), [view, clients]);
  const followUps = useMemo(
    () => buildCoachFollowUps({ view, leads, intelligence }),
    [view, leads, intelligence],
  );

  return {
    clients,
    leads,
    view,
    briefing,
    followUps,
    workload,
    isLoading: dashboardQuery.isLoading,
    isError: dashboardQuery.isError,
    error: dashboardQuery.error,
  };
}
