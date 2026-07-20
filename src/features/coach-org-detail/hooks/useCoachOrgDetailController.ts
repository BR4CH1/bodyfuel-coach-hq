import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getOrgCoachDetail } from "@/lib/organizations/athlete.functions";
import { isCoachOrg, orgTerminology } from "@/lib/organizations/org-type";
import type { OrgCoachDetailData, OrgJoinLinkTeam } from "@/features/coach-org-detail/types";
import {
  canManageLoad,
  canManageOrganization,
  getCoachExperienceCopy,
  isFeatureEnabled,
  normalizeCoachOrgTab,
  resolveDisplayKpis,
  type CoachOrgTab,
} from "@/features/coach-org-detail/lib/org-detail.logic";

export function useCoachOrgDetailController(orgId: string) {
  const routeHash = useRouterState({ select: (state) => state.location.hash });
  const fetchDetail = useServerFn(getOrgCoachDetail);
  const query = useQuery({
    queryKey: ["coach-org-detail", orgId],
    queryFn: () => fetchDetail({ data: { orgId } }),
  });
  const data = query.data as OrgCoachDetailData | undefined;

  const [tab, setTab] = useState<CoachOrgTab>(() =>
    normalizeCoachOrgTab(typeof window === "undefined" ? null : window.location.hash),
  );
  const [athleteTeamFilter, setAthleteTeamFilter] = useState<string | null>(null);
  const [joinLinkTeam, setJoinLinkTeam] = useState<OrgJoinLinkTeam | null>(null);

  useEffect(() => {
    setTab(normalizeCoachOrgTab(routeHash));
  }, [routeHash]);

  const selectTab = useCallback((next: CoachOrgTab) => {
    setTab(next);
    if (typeof window !== "undefined") window.location.hash = next;
  }, []);

  const org = data?.org ?? null;
  const teams = useMemo(() => data?.teams ?? [], [data?.teams]);
  const teamKpis = useMemo(() => data?.team_kpis ?? [], [data?.team_kpis]);
  const features = useMemo(() => data?.features ?? [], [data?.features]);
  const caller = data?.caller;

  useEffect(() => {
    if (athleteTeamFilter && !teams.some((team) => team.id === athleteTeamFilter)) {
      setAthleteTeamFilter(null);
    }
  }, [athleteTeamFilter, teams]);

  const featureOn = useCallback((key: string) => isFeatureEnabled(features, key), [features]);

  const terminology = useMemo(
    () => orgTerminology(org?.organization_type, org?.terminology ?? null),
    [org?.organization_type, org?.terminology],
  );
  const experience = useMemo(
    () => getCoachExperienceCopy(caller?.experience),
    [caller?.experience],
  );
  const displayKpis = useMemo(
    () =>
      resolveDisplayKpis({
        activeTeamId: athleteTeamFilter,
        teamKpis,
        totalAthletes: data?.athletes.length ?? 0,
        weeklyCompliance: data?.weekly_compliance ?? null,
        pendingOnboardings: data?.pending_onboardings ?? 0,
      }),
    [
      athleteTeamFilter,
      data?.athletes.length,
      data?.pending_onboardings,
      data?.weekly_compliance,
      teamKpis,
    ],
  );

  const isBulls = (org?.slug ?? "").toLowerCase() === "bulls";
  const showCoachAssignments = isCoachOrg(org?.organization_type);
  const canManageOrg = canManageOrganization(caller?.experience, caller?.is_bodyfuel_coach);
  const canManageLoadData = canManageLoad(caller?.experience, caller?.is_bodyfuel_coach);

  const jumpToAthletes = useCallback(
    (teamId: string) => {
      setAthleteTeamFilter(teamId);
      selectTab("athletes");
    },
    [selectTab],
  );

  return {
    orgId,
    data,
    org,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    tab,
    selectTab,
    athleteTeamFilter,
    setAthleteTeamFilter,
    joinLinkTeam,
    setJoinLinkTeam,
    teams,
    teamKpis,
    caller,
    terminology,
    experience,
    displayKpis,
    featureOn,
    isBulls,
    showCoachAssignments,
    canManageOrg,
    canManageLoad: canManageLoadData,
    jumpToAthletes,
  };
}

export type CoachOrgDetailController = ReturnType<typeof useCoachOrgDetailController>;
