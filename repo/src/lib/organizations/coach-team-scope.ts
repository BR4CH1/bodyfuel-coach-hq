/**
 * Coach-Team-Scope Resolver.
 *
 * Ermittelt die tatsächliche Team-Zugriffsberechtigung eines eingeloggten
 * Nutzers für eine bestimmte Organisation. Wird von jeder Coach-seitigen
 * Server-Funktion verwendet, um Athleten-/Team-/Analytics-Daten sauber zu
 * beschneiden — nicht nur UI-seitig, sondern schon auf Datenebene.
 *
 * Regel:
 *   - Plattform-Coach (user_roles.role='coach')           → alle Teams
 *   - staff_assignments.role='organization_admin'         → alle Teams
 *   - organization_memberships.role='organization_admin'  → alle Teams
 *   - staff_assignments.role='coach' mit
 *       permissions ⊇ 'manage_organization'               → alle Teams (Head Coach)
 *   - staff_assignments.role='coach' mit team_id=NULL     → alle Teams
 *   - staff_assignments.role='coach' oder 'staff' mit
 *       konkreter team_id                                 → nur diese Teams
 *
 * Fehlt jede Zuordnung → wirft Fehler ("Kein Zugriff.").
 */

export type CoachTeamScope = {
  isGlobalCoach: boolean;
  /** true = organisationsweiter Zugriff (Vereinsleitung / Head Coach / ohne Team-Bindung). */
  allTeams: boolean;
  /** Alle Team-IDs der Organisation. */
  allTeamIds: string[];
  /** Team-IDs, auf die der Nutzer tatsächlich zugreifen darf (bei allTeams === allTeamIds). */
  allowedTeamIds: string[];
  /** Rolle für UI-Hinweise. */
  callerRole: "global_coach" | "org_admin" | "head_coach" | "team_coach" | "staff";
  /** Erste (primäre) Team-Zuordnung — für Auto-Select im UI. */
  primaryTeamId: string | null;
};

export async function resolveCoachTeamScope(
  supabase: any,
  userId: string,
  orgId: string,
): Promise<CoachTeamScope> {
  const [teamsRes, staffRes, memRes, coachRoleRes] = await Promise.all([
    supabase
      .from("organization_teams")
      .select("id, status")
      .eq("organization_id", orgId),
    supabase
      .from("staff_assignments")
      .select("role, permissions, team_id")
      .eq("user_id", userId)
      .eq("organization_id", orgId),
    supabase
      .from("organization_memberships")
      .select("role, status")
      .eq("user_id", userId)
      .eq("organization_id", orgId),
    supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
  ]);

  const allTeamIds = ((teamsRes.data ?? []) as any[])
    .filter((t) => t.status !== "archived")
    .map((t) => t.id as string);

  const isGlobalCoach = !!coachRoleRes.data;
  const staffRows = (staffRes.data ?? []) as Array<{
    role: string;
    permissions: string[] | null;
    team_id: string | null;
  }>;
  const memberships = (memRes.data ?? []) as Array<{ role: string; status: string | null }>;

  const isOrgAdmin =
    staffRows.some((s) => s.role === "organization_admin") ||
    memberships.some(
      (m) => m.role === "organization_admin" && (m.status === "active" || m.status == null),
    );

  const headCoachRow = staffRows.find(
    (s) =>
      s.role === "coach" &&
      Array.isArray(s.permissions) &&
      s.permissions.includes("manage_organization"),
  );
  const isHeadCoach = !!headCoachRow;

  const coachRowsWithoutTeam = staffRows.filter(
    (s) => (s.role === "coach" || s.role === "staff") && !s.team_id,
  );
  const teamBoundRows = staffRows.filter(
    (s) => (s.role === "coach" || s.role === "staff") && !!s.team_id,
  );

  // Organisationsweiter Zugriff?
  if (isGlobalCoach || isOrgAdmin || isHeadCoach || coachRowsWithoutTeam.length > 0) {
    return {
      isGlobalCoach,
      allTeams: true,
      allTeamIds,
      allowedTeamIds: allTeamIds,
      callerRole: isGlobalCoach && staffRows.length === 0
        ? "global_coach"
        : isOrgAdmin
        ? "org_admin"
        : isHeadCoach
        ? "head_coach"
        : "team_coach",
      primaryTeamId: null,
    };
  }

  // Nur Team-gebundene Rechte
  if (teamBoundRows.length > 0) {
    const allowed = Array.from(
      new Set(teamBoundRows.map((r) => r.team_id as string).filter((id) => allTeamIds.includes(id))),
    );
    if (allowed.length === 0) throw new Error("Kein Zugriff.");
    return {
      isGlobalCoach: false,
      allTeams: false,
      allTeamIds,
      allowedTeamIds: allowed,
      callerRole: teamBoundRows.some((r) => r.role === "coach") ? "team_coach" : "staff",
      primaryTeamId: allowed[0] ?? null,
    };
  }

  throw new Error("Kein Zugriff.");
}
