import type { OrgAthleteSummary, OrgTeamDetail, TeamKpi } from "@/features/coach-org-detail/types";

export type TeamDraft = {
  name: string;
  ageGroup: string;
};

export function normalizeTeamDraft(draft: TeamDraft) {
  return {
    name: draft.name.trim(),
    age_group: draft.ageGroup.trim() || null,
  };
}

export function validateTeamDraft(draft: TeamDraft, teamLabel: string): string | null {
  const { name } = normalizeTeamDraft(draft);
  if (name.length < 2) return `${teamLabel}name zu kurz.`;
  if (name.length > 80) return `${teamLabel}name darf höchstens 80 Zeichen haben.`;
  return null;
}

export function getTeamKpi(teamKpis: TeamKpi[], teamId: string): TeamKpi | null {
  return teamKpis.find((kpi) => kpi.team_id === teamId) ?? null;
}

export function getAllowedAthleteUserIds(
  athletes: OrgAthleteSummary[],
  teams: OrgTeamDetail[],
  teamId: string | null,
): Set<string> | null {
  if (!teamId) return null;
  const teamName = teams.find((team) => team.id === teamId)?.name;
  if (!teamName) return new Set<string>();

  return new Set(
    athletes.filter((athlete) => athlete.team_name === teamName).map((athlete) => athlete.user_id),
  );
}
