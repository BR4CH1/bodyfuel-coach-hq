import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { loadCoachDashboardData } from "@/features/coach-dashboard/lib/coach-dashboard.data";
import { buildCoachDashboardViewModel } from "@/features/coach-dashboard/lib/coach-dashboard.logic";
import { buildCoachFollowUps } from "@/features/coach-dashboard/lib/coach-followups.logic";
import { buildCoachWorkload } from "@/features/coach-dashboard/lib/coach-workload.logic";
import { buildCoachIntelligence } from "@/features/coach-dashboard/lib/coach-intelligence.logic";
import type { CoachClient, CoachLead } from "@/features/coach-dashboard/types";

const EMPTY_CLIENTS: CoachClient[] = [];
const EMPTY_LEADS: CoachLead[] = [];
const EMPTY_PRODUCT_COUNTS = { coaching: 0, smart: 0 } as const;

export function useCoachDashboardController() {
  const dashboardQuery = useQuery({
    queryKey: ["coach-dashboard-data"],
    queryFn: loadCoachDashboardData,
    staleTime: 30_000,
  });

  const clients = dashboardQuery.data?.clients ?? EMPTY_CLIENTS;
  const leads = dashboardQuery.data?.leads ?? EMPTY_LEADS;
  const productCounts = dashboardQuery.data?.productCounts ?? EMPTY_PRODUCT_COUNTS;
  const view = useMemo(() => buildCoachDashboardViewModel(clients), [clients]);
  const workload = useMemo(() => buildCoachWorkload(view, leads), [view, leads]);
  const intelligence = useMemo(() => buildCoachIntelligence(view, clients), [view, clients]);
  const followUps = useMemo(
    () => buildCoachFollowUps({ view, leads, intelligence }),
    [view, leads, intelligence],
  );

  return {
    clients,
    leads,
    productCounts,
    view,
    followUps,
    workload,
    intelligence,
    isLoading: dashboardQuery.isLoading,
    isError: dashboardQuery.isError,
    error: dashboardQuery.error,
  };
}
