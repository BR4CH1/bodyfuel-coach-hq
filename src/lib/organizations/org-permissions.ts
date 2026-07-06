/**
 * Zentrale, scopebasierte Analyse-Berechtigungen für den Vereinsbereich.
 *
 * Regeln:
 * - ORGANIZATION_ADMIN: eigener Verein, org-weit, alle Teams + Athleten.
 * - HEAD_COACH (staff.role='coach' mit manage_organization): eigener Verein,
 *   org-weit für Analytics; kein Verwaltungszugriff wie org_admin.
 * - TEAM_COACH (staff.role='coach' ohne manage_organization): nur zugewiesene
 *   Teams (team_id auf staff_assignments) + Athleten dieser Teams.
 * - STAFF: kein automatischer Analytics-Zugriff (dedizierte Permissions
 *   `view_performance`, `view_checkins` können ihn öffnen, das ist aber
 *   feature-spezifisch — nicht Teil der Standard-Analytics-Landing).
 * - GLOBAL COACH ROLE (user_roles.role='coach'): explizit NICHT ausreichend
 *   für fremde Organisationsdaten. Wird als "Bodyfuel-Coach"-Flag benutzt und
 *   bezieht sich auf den globalen Coaching-Bereich, nicht auf Vereine.
 *
 * Diese Helfer nehmen die Ausgabe von `deriveOrgRole` als Eingabe. Der
 * Aufrufer (Server-Fn) muss zusätzlich sicherstellen, dass die Rolle zur
 * angefragten Organisation gehört (Zeile aus `staff_assignments` /
 * `organization_memberships` für genau diese `organization_id`).
 */

import type { OrgRoleFlags } from "./org-role";

export type StaffAssignmentLike = {
  role: string;
  permissions: string[];
  team_id: string | null;
} | null | undefined;

export type OrgPermissionInput = {
  flags: OrgRoleFlags;
  staff: StaffAssignmentLike;
};

/** Darf organisationsweite Analytics/Dashboards sehen (Leitungscockpit, Org-Pulse). */
export function canViewOrganizationAnalytics(input: OrgPermissionInput): boolean {
  const { flags } = input;
  return flags.isOrgAdmin || flags.isHeadCoach || flags.isSuperAdmin;
}

/** Darf Analytics eines konkreten Teams innerhalb der eigenen Organisation sehen. */
export function canViewTeamAnalytics(
  input: OrgPermissionInput,
  teamId: string | null | undefined,
): boolean {
  const { flags, staff } = input;
  if (flags.isSuperAdmin) return true;
  if (flags.isOrgAdmin || flags.isHeadCoach) return true;
  if (flags.isTeamCoach) {
    // Team-Coach ohne Team-Bindung darf alle Teams; mit Bindung nur eigenes.
    if (!staff?.team_id) return true;
    if (!teamId) return false;
    return staff.team_id === teamId;
  }
  return false;
}

/** Darf Analytics eines Athleten innerhalb der eigenen Organisation sehen. */
export function canViewAthleteAnalytics(
  input: OrgPermissionInput,
  athleteTeamId: string | null | undefined,
): boolean {
  const { flags, staff } = input;
  if (flags.isSuperAdmin) return true;
  if (flags.isOrgAdmin || flags.isHeadCoach) return true;
  if (flags.isTeamCoach) {
    if (!staff?.team_id) return true;
    if (!athleteTeamId) return false;
    return staff.team_id === athleteTeamId;
  }
  return false;
}

/** Reine Vereinsleitung (kein Head Coach, kein Team Coach). */
export function isPureOrgAdmin(flags: OrgRoleFlags): boolean {
  return flags.isOrgAdmin && !flags.isHeadCoach && !flags.isTeamCoach;
}
