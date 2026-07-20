import type { TeamKpi } from "@/features/coach-org-detail/types";

export const COACH_ORG_TABS = [
  "cockpit",
  "overview",
  "athletes",
  "teams",
  "training",
  "nutrition",
  "tasks",
  "community",
  "challenges",
  "ranking",
  "staff",
  "load",
  "modules",
  "settings",
  "naming",
  "brand",
  "coaches",
] as const;

export type CoachOrgTab = (typeof COACH_ORG_TABS)[number];

const TAB_SET = new Set<string>(COACH_ORG_TABS);

export function normalizeCoachOrgTab(hash: string | null | undefined): CoachOrgTab {
  const candidate = String(hash ?? "")
    .replace(/^#/, "")
    .trim();
  return TAB_SET.has(candidate) ? (candidate as CoachOrgTab) : "cockpit";
}

export type CoachExperience =
  "org_admin" | "head_coach" | "team_coach" | "staff" | "coach" | string;

export function getCoachExperienceCopy(experience: CoachExperience | null | undefined): {
  label: string;
  hint: string;
} {
  switch (experience) {
    case "org_admin":
      return {
        label: "Vereinsleitung",
        hint: "Vereinsweiter Zugriff auf Analytics, Teams, Athleten und Staff.",
      };
    case "head_coach":
      return {
        label: "Head Coach",
        hint: "Vereinsweiter Analytics-Zugriff für den Head Coach.",
      };
    case "team_coach":
      return {
        label: "Teamcoach",
        hint: "Analytics deiner zugewiesenen Teams und Athleten.",
      };
    case "staff":
      return {
        label: "Staff",
        hint: "Analytics innerhalb deiner Staff-Berechtigungen.",
      };
    default:
      return {
        label: "Coach",
        hint: "BODYFUEL-Coach Analytics-Zugang.",
      };
  }
}

export function isFeatureEnabled(
  features: ReadonlyArray<{ feature: string; enabled: boolean }>,
  key: string,
): boolean {
  return features.some((feature) => feature.feature === key && feature.enabled);
}

export type DisplayKpis = {
  athletes: number;
  compliance: number | null;
  pendingOnboardings: number;
};

export function resolveDisplayKpis({
  activeTeamId,
  teamKpis,
  totalAthletes,
  weeklyCompliance,
  pendingOnboardings,
}: {
  activeTeamId: string | null;
  teamKpis: ReadonlyArray<TeamKpi>;
  totalAthletes: number;
  weeklyCompliance: number | null;
  pendingOnboardings: number;
}): DisplayKpis {
  const teamKpi = activeTeamId
    ? teamKpis.find((entry) => entry.team_id === activeTeamId)
    : undefined;

  return teamKpi
    ? {
        athletes: teamKpi.athletes,
        compliance: teamKpi.weekly_compliance,
        pendingOnboardings: teamKpi.pending_onboardings,
      }
    : {
        athletes: totalAthletes,
        compliance: weeklyCompliance,
        pendingOnboardings,
      };
}

export function canManageOrganization(
  experience: CoachExperience | null | undefined,
  isBodyfuelCoach: boolean | null | undefined,
): boolean {
  return experience === "org_admin" || isBodyfuelCoach === true;
}

export function canManageLoad(
  experience: CoachExperience | null | undefined,
  isBodyfuelCoach: boolean | null | undefined,
): boolean {
  return (
    experience === "org_admin" ||
    experience === "head_coach" ||
    experience === "team_coach" ||
    isBodyfuelCoach === true
  );
}
