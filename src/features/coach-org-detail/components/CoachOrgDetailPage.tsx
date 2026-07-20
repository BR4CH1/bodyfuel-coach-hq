import { TeamJoinLinkDialog } from "@/components/organizations/TeamJoinLinkDialog";
import { OrgDangerZone } from "@/components/organizations/OrgDangerZone";
import { CoachExperienceNotice } from "@/features/coach-org-detail/components/CoachExperienceNotice";
import { OrgDetailHeader } from "@/features/coach-org-detail/components/OrgDetailHeader";
import { OrgDetailKpiGrid } from "@/features/coach-org-detail/components/OrgDetailKpiGrid";
import { OrgDetailTabContent } from "@/features/coach-org-detail/components/OrgDetailTabContent";
import { OrgQuickAccess } from "@/features/coach-org-detail/components/OrgQuickAccess";
import { TeamSwitcher } from "@/features/coach-org-detail/components/TeamSwitcher";
import { useCoachOrgDetailController } from "@/features/coach-org-detail/hooks/useCoachOrgDetailController";

export function CoachOrgDetailPage({ orgId }: { orgId: string }) {
  const controller = useCoachOrgDetailController(orgId);
  const {
    data,
    org,
    isLoading,
    isError,
    error,
    isBulls,
    experience,
    teams,
    displayKpis,
    tab,
    selectTab,
    terminology,
    featureOn,
    showCoachAssignments,
    athleteTeamFilter,
    setAthleteTeamFilter,
    joinLinkTeam,
    setJoinLinkTeam,
    caller,
  } = controller;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Lädt…</div>;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Organisation konnte nicht geladen werden."}
      </div>
    );
  }

  if (!data || !org) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Organisation nicht gefunden oder kein Zugriff.
      </div>
    );
  }

  return (
    <div
      className={
        isBulls
          ? "bulls-theme -mx-4 -my-4 min-h-screen bg-[#050505] px-4 py-4 sm:-mx-6 sm:-my-6 sm:px-6 sm:py-6"
          : ""
      }
    >
      <OrgDetailHeader org={org} isBulls={isBulls} experienceLabel={experience.label} />

      <TeamSwitcher
        teams={teams}
        activeTeamId={athleteTeamFilter}
        onChange={setAthleteTeamFilter}
      />

      <OrgDetailKpiGrid
        display={displayKpis}
        teamCount={teams.length}
        staffCount={data.staff.length}
      />

      <OrgQuickAccess
        tab={tab}
        selectTab={selectTab}
        terminology={terminology}
        featureOn={featureOn}
        showCoachAssignments={showCoachAssignments}
      />

      {caller && !isBulls && <CoachExperienceNotice hint={experience.hint} />}

      <div className="mt-5">
        <OrgDetailTabContent controller={controller} />
      </div>

      {joinLinkTeam && (
        <TeamJoinLinkDialog
          orgId={orgId}
          teamId={joinLinkTeam.id}
          teamName={joinLinkTeam.name}
          open
          onClose={() => setJoinLinkTeam(null)}
        />
      )}

      <OrgDangerZone
        organizationId={org.id}
        organizationName={org.name}
        organizationSlug={org.slug ?? ""}
      />
    </div>
  );
}
