import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getCoachRadar } from "@/lib/coach-radar.functions";
import {
  getMyPerformanceAccess,
  listPerformanceCheckStats,
} from "@/lib/bulls-performance.functions";
import { loadCoachDashboardData } from "@/features/coach-dashboard/lib/coach-dashboard.data";
import { buildCoachDashboardViewModel } from "@/features/coach-dashboard/lib/coach-dashboard.logic";
import { buildCoachBriefing } from "@/features/coach-dashboard/lib/coach-briefing.logic";
import { buildCoachFollowUps } from "@/features/coach-dashboard/lib/coach-followups.logic";
import type { CoachClient, CoachLead } from "@/features/coach-dashboard/types";

const EMPTY_CLIENTS: CoachClient[] = [];
const EMPTY_LEADS: CoachLead[] = [];

export function useCoachDashboardController() {
  const radarFn = useServerFn(getCoachRadar);
  const performanceStatsFn = useServerFn(listPerformanceCheckStats);
  const performanceAccessFn = useServerFn(getMyPerformanceAccess);

  const dashboardQuery = useQuery({
    queryKey: ["coach-dashboard-data"],
    queryFn: loadCoachDashboardData,
    staleTime: 30_000,
  });

  const performanceAccessQuery = useQuery({
    queryKey: ["bulls-perf-access-coach-nav"],
    queryFn: () => performanceAccessFn(),
    retry: false,
    staleTime: 60_000,
  });
  const showPerformanceNavigation = performanceAccessQuery.data?.canCoach === true;

  const performanceStatsQuery = useQuery({
    queryKey: ["bulls-perf-stats-coach-nav"],
    queryFn: () => performanceStatsFn(),
    retry: false,
    staleTime: 60_000,
    enabled: showPerformanceNavigation,
  });

  const radarQuery = useQuery({
    queryKey: ["coach-radar"],
    queryFn: () => radarFn(),
    staleTime: 60_000,
  });

  const clients = dashboardQuery.data?.clients ?? EMPTY_CLIENTS;
  const leads = dashboardQuery.data?.leads ?? EMPTY_LEADS;
  const view = useMemo(() => buildCoachDashboardViewModel(clients), [clients]);
  const performancePending = performanceStatsQuery.data?.pending ?? 0;
  const briefing = useMemo(
    () =>
      buildCoachBriefing({
        view,
        leads,
        performancePending,
        showPerformanceNavigation,
      }),
    [view, leads, performancePending, showPerformanceNavigation],
  );
  const followUps = useMemo(() => buildCoachFollowUps({ view, leads }), [view, leads]);

  return {
    clients,
    leads,
    view,
    radar: radarQuery.data,
    showPerformanceNavigation,
    performancePending,
    briefing,
    followUps,
    isLoading: dashboardQuery.isLoading,
    isError: dashboardQuery.isError,
    error: dashboardQuery.error,
  };
}
