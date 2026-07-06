/**
 * Reine Ableitungshelfer für Vereinsrollen aus `getOrganizationContext` /
 * `getOrgHomeData`. Kein DB-Zugriff, keine neuen Server-Calls.
 *
 * Interne DB-Rollen (`organization_role` Enum) und Permission-Keys bleiben
 * UNVERÄNDERT. Diese Datei mappt sie nur auf ein UI-freundliches Objekt.
 *
 * WICHTIG (Phase A):
 * - "Athlet" ist ausschließlich `organization_memberships.role === 'athlete'`.
 *   Andere Membership-Rollen (`member`, `staff`, `coach`, `organization_admin`)
 *   werden NIE als Athlet interpretiert. Vereinsleiter/Coaches liegen in
 *   `staff_assignments` — die Membership-Zeile ist nur Zugehörigkeitsmarker.
 * - Bei Dual-Rollen (Player + Staff) gewinnt für den Vereinskontext die
 *   Staff-Rolle; deriveOrgRole liefert aber sowohl `isPlayer` als auch die
 *   Staff-Flags, damit die UI beides berücksichtigen kann.
 */

export type OrgRole =
  | "player"
  | "team_coach"
  | "head_coach"
  | "org_admin"
  | "staff"
  | "none";

/** UI-Erfahrung, die als Landing/Redirect gewählt werden soll. */
export type OrgExperience =
  | "athlete"
  | "team_coach"
  | "head_coach"
  | "org_admin"
  | "staff"
  | "none";

export type OrgRoleFlags = {
  /** Primäre Rolle für Anzeige/Priorität (Staff schlägt Player im Vereinskontext). */
  role: OrgRole;
  /** Landing-Experience-Auswahl (deckt Dual-Roles ab). */
  experience: OrgExperience;
  isPlayer: boolean;
  isTeamCoach: boolean;
  isHeadCoach: boolean;
  isOrgAdmin: boolean;
  isStaff: boolean;
  isSuperAdmin: boolean;
  /** Beliebige Coach-/Staff-Zugehörigkeit (team_coach, head_coach, org_admin oder staff). */
  isAnyStaff: boolean;
  /** true, wenn ausschließlich Athlet (kein Staff, kein Admin). */
  isAthleteOnly: boolean;
  /** Sichtbares Label auf Deutsch. */
  label: string;
  /** Sekundäres Label für Dual-Roles, z. B. "Vereinsleitung + Spieler". null wenn nicht dual. */
  secondaryLabel: string | null;
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
 * Priorität für `role` / `experience` bei Mehrfachrollen:
 * org_admin > head_coach > team_coach > staff > player > none
 */
export function deriveOrgRole(input: OrgRoleInput): OrgRoleFlags {
  const membership = input.membership ?? null;
  const staff = input.staff ?? null;
  const isSuperAdmin = !!input.is_super_admin;

  // Athlet = ausschließlich role='athlete'. Membership 'member' zählt nicht.
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
  const isAthleteOnly = isPlayer && !isAnyStaff;

  let role: OrgRole = "none";
  if (isOrgAdmin) role = "org_admin";
  else if (isHeadCoach) role = "head_coach";
  else if (isTeamCoach) role = "team_coach";
  else if (isStaff) role = "staff";
  else if (isPlayer) role = "player";

  // Experience für Landing: Staff-Erfahrung gewinnt im Vereinskontext, außer
  // reiner Athlet. Dual-Roles werden über einen Kontext-Switcher an anderer
  // Stelle aufgelöst.
  const experience: OrgExperience =
    role === "player" && isAnyStaff
      ? "athlete" // (nicht erreichbar, aber defensiv)
      : role === "none"
      ? "none"
      : role;

  const roleLabel = (r: OrgRole) =>
    r === "org_admin"
      ? "Vereinsleitung"
      : r === "head_coach"
      ? "Head Coach"
      : r === "team_coach"
      ? "Teamcoach"
      : r === "staff"
      ? "Staff"
      : r === "player"
      ? "Spieler"
      : "—";

  const label = roleLabel(role);
  const secondaryLabel =
    isAnyStaff && isPlayer ? "Spieler" : null;

  return {
    role,
    experience,
    isPlayer,
    isTeamCoach,
    isHeadCoach,
    isOrgAdmin,
    isStaff,
    isAnyStaff,
    isAthleteOnly,
    isSuperAdmin,
    label,
    secondaryLabel,
  };
}
