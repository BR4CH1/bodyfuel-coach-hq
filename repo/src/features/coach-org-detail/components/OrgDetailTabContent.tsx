import { CoachCockpit } from "@/components/coach/analytics/CoachCockpit";
import { CoachAssignmentsTab } from "@/components/organizations/CoachAssignmentsTab";
import { AthletesTab } from "@/components/organizations/AthletesTab";
import { OrgBrandingTab } from "@/components/organizations/OrgBrandingTab";
import { OrgLoadTab } from "@/components/organizations/OrgLoadTab";
import { OrgModulesTab } from "@/components/organizations/OrgModulesTab";
import { OrgTerminologyTab } from "@/components/organizations/OrgTerminologyTab";
import { CommunityHub } from "@/features/coach-org-detail/components/CommunityHub";
import { NutritionScheduleCard } from "@/features/coach-org-detail/components/NutritionScheduleCard";
import { OrgOverviewTab } from "@/features/coach-org-detail/components/OrgOverviewTab";
import { StaffTab } from "@/features/coach-org-detail/components/StaffTab";
import { TasksTab } from "@/features/coach-org-detail/components/TasksTab";
import { TeamsTab } from "@/features/coach-org-detail/components/TeamsTab";
import { TrainingTab } from "@/features/coach-org-detail/components/TrainingTab";
import type { CoachOrgDetailController } from "@/features/coach-org-detail/hooks/useCoachOrgDetailController";
import { getAllowedAthleteUserIds } from "@/features/coach-org-detail/lib/team.logic";

export function OrgDetailTabContent({ controller }: { controller: CoachOrgDetailController }) {
  const {
    orgId,
    data,
    org,
    tab,
    teams,
    teamKpis,
    caller,
    terminology,
    athleteTeamFilter,
    setAthleteTeamFilter,
    setJoinLinkTeam,
    jumpToAthletes,
    featureOn,
    showCoachAssignments,
    canManageOrg,
    canManageLoad,
  } = controller;

  if (!data || !org) return null;

  if (tab === "cockpit") return <CoachCockpit orgId={orgId} />;

  if (tab === "overview") {
    return (
      <OrgOverviewTab
        activeChallenge={data.active_challenge}
        pendingOnboardings={data.pending_onboardings}
        activity={data.activity}
      />
    );
  }

  if (tab === "athletes") {
    return (
      <AthletesTab
        orgId={orgId}
        orgType={org.organization_type}
        orgSport={org.sport}
        teamFilter={athleteTeamFilter}
        teams={teams}
        allowedUserIds={getAllowedAthleteUserIds(data.athletes, teams, athleteTeamFilter)}
        onClearFilter={() => setAthleteTeamFilter(null)}
        onTeamFilterChange={setAthleteTeamFilter}
      />
    );
  }

  if (tab === "teams") {
    return (
      <TeamsTab
        orgId={orgId}
        orgSport={org.sport}
        orgType={org.organization_type}
        teams={teams}
        teamKpis={teamKpis}
        onJumpToAthletes={jumpToAthletes}
        onJoinLink={setJoinLinkTeam}
      />
    );
  }

  if (tab === "training") return <TrainingTab orgId={orgId} />;
  if (tab === "nutrition") return <NutritionScheduleCard orgId={orgId} teams={teams} />;
  if (tab === "tasks") return <TasksTab orgId={orgId} teams={teams} />;

  if (tab === "community" || tab === "challenges" || tab === "ranking") {
    return (
      <CommunityHub
        orgId={orgId}
        orgSlug={org.slug ?? ""}
        teams={teams}
        initialSubTab={tab === "challenges" ? "challenges" : tab === "ranking" ? "ranking" : "feed"}
      />
    );
  }

  if (tab === "staff") return <StaffTab orgId={orgId} teams={teams} />;

  if (tab === "load" && featureOn("load_management")) {
    return <OrgLoadTab orgId={orgId} teams={teams} canManage={canManageLoad} />;
  }

  if (tab === "modules" || tab === "settings") {
    return <OrgModulesTab orgId={orgId} orgSlug={org.slug ?? ""} canManage={canManageOrg} />;
  }

  if (tab === "naming") {
    return (
      <OrgTerminologyTab
        orgId={orgId}
        orgType={org.organization_type}
        currentTerminology={org.terminology}
        canManage={canManageOrg}
      />
    );
  }

  if (tab === "brand") {
    return (
      <OrgBrandingTab
        orgId={orgId}
        org={{
          primary_color: org.primary_color,
          secondary_color: org.secondary_color,
          accent_color: org.accent_color,
          background_color: org.background_color,
          text_color: org.text_color,
          logo_url: org.logo_url,
          alt_logo_url: org.alt_logo_url,
          claim: org.claim,
          short_name: org.short_name,
          branding_mode: org.branding_mode ?? "bodyfuel",
          branding_extra: org.branding_extra ?? {},
        }}
        canManage={canManageOrg}
      />
    );
  }

  if (tab === "coaches" && showCoachAssignments) {
    return (
      <CoachAssignmentsTab
        orgId={orgId}
        canManage={canManageOrg}
        terminology={{
          coach: terminology.coach,
          coaches: terminology.coaches,
          player: terminology.player,
          players: terminology.players,
        }}
      />
    );
  }

  return null;
}
