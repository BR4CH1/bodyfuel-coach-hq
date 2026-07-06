/**
 * Reine Ableitungshelfer für Vereinsrollen aus `getOrganizationContext` /
 * `getOrgHomeData`. Kein DB-Zugriff, keine neuen Server-Calls.
 *
 * Interne DB-Rollen (`organization_role` Enum) und Permission-Keys bleiben
 * UNVERÄNDERT. Diese Datei mappt sie nur auf ein UI-freundliches Objekt.
 */

export type OrgRole =
  | "player"
  | "team_coach"
  | "head_coach"
  | "org_admin"
  | "staff"
  | "none";

export type OrgRoleFlags = {
  role: OrgRole;
  isPlayer: boolean;
  isTeamCoach: boolean;
  isHeadCoach: boolean;
  isOrgAdmin: boolean;
  isStaff: boolean;
  isSuperAdmin: boolean;
  /** Beliebige Coach-/Staff-Zugehörigkeit (team_coach, head_coach, org_admin oder staff). */
  isAnyStaff: boolean;
  /** Sichtbares Label auf Deutsch. */
  label: string;
};

type MembershipLike = {
  role?: string | null;
  status?: string | null;
} | null | undefined;

type StaffLike = {
  role?: string | null;
  permissions?: string[] | null;
} | null | undefined;

export type OrgRoleInput = {
  membership: MembershipLike;
  staff: StaffLike;
  is_super_admin?: boolean | null;
};

/**
 * Ableitung:
 * - `organization_memberships.role = "athlete"` (status active) → isPlayer
 * - `staff_assignments.role = "organization_admin"` → isOrgAdmin (Vereinsleitung)
 * - `staff_assignments.role = "coach"` mit `manage_organization` permission → isHeadCoach
 * - `staff_assignments.role = "coach"` sonst → isTeamCoach
 * - `staff_assignments.role = "staff"` → isStaff
 *
 * Ein User kann gleichzeitig Player UND Coach sein.
 */
export function deriveOrgRole(input: OrgRoleInput): OrgRoleFlags {
  const membership = input.membership ?? null;
  const staff = input.staff ?? null;
  const isSuperAdmin = !!input.is_super_admin;

  const isPlayer =
    membership?.role === "athlete" &&
    (membership?.status === "active" || membership?.status == null);

  const staffRole = staff?.role ?? null;
  const perms = new Set(staff?.permissions ?? []);
  const hasManageOrg = perms.has("manage_organization");

  const isOrgAdmin = staffRole === "organization_admin";
  const isHeadCoach = !isOrgAdmin && staffRole === "coach" && hasManageOrg;
  const isTeamCoach = !isOrgAdmin && !isHeadCoach && staffRole === "coach";
  const isStaff = !isOrgAdmin && !isHeadCoach && !isTeamCoach && staffRole === "staff";
  const isAnyStaff = isOrgAdmin || isHeadCoach || isTeamCoach || isStaff;

  // Primäre Rolle für Anzeige: Player nur, wenn KEINE Staff-Funktion vorliegt.
  // Bei Dual-Rolle (Player + Coach) gewinnt für den Vereinskontext die Staff-Rolle,
  // weil das Vereins-Cockpit ihr Zielbild ist.
  let role: OrgRole = "none";
  if (isOrgAdmin) role = "org_admin";
  else if (isHeadCoach) role = "head_coach";
  else if (isTeamCoach) role = "team_coach";
  else if (isStaff) role = "staff";
  else if (isPlayer) role = "player";

  const label =
    role === "org_admin"
      ? "Vereinsleitung"
      : role === "head_coach"
      ? "Head Coach"
      : role === "team_coach"
      ? "Teamcoach"
      : role === "staff"
      ? "Staff"
      : role === "player"
      ? "Spieler"
      : "—";

  return {
    role,
    isPlayer,
    isTeamCoach,
    isHeadCoach,
    isOrgAdmin,
    isStaff,
    isAnyStaff,
    isSuperAdmin,
    label,
  };
}
