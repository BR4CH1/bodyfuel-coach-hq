export type OrgCoachPermission = "training" | "nutrition" | "athlete";


export async function isGlobalCoach(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "coach",
  });
  return !!data;
}

export async function assertGlobalCoachOrAnyOrgCoach(ctx: { supabase: any; userId: string }) {
  if (await isGlobalCoach(ctx.supabase, ctx.userId)) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: staff } = await supabaseAdmin
    .from("staff_assignments")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("role", "coach")
    .limit(1);
  if ((staff ?? []).length > 0) return;
  throw new Error("Nur für Coaches.");
}

export async function assertCoachOrOrgStaffForAthlete(
  ctx: { supabase: any; userId: string },
  targetUserId: string,
  permission: OrgCoachPermission = "athlete",
) {
  if (await isGlobalCoach(ctx.supabase, ctx.userId)) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: athleteMemberships } = await supabaseAdmin
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", targetUserId)
    .eq("role", "athlete")
    .eq("status", "active");

  const orgIds = Array.from(
    new Set(((athleteMemberships ?? []) as any[]).map((m) => m.organization_id).filter(Boolean)),
  );
  if (!orgIds.length) throw new Error("Kein Zugriff.");

  const [{ data: callerMemberships }, { data: staffRows }, { data: teams }] = await Promise.all([
    supabaseAdmin
      .from("organization_memberships")
      .select("organization_id, role, status")
      .eq("user_id", ctx.userId)
      .in("organization_id", orgIds),
    supabaseAdmin
      .from("staff_assignments")
      .select("organization_id, role, permissions, team_id")
      .eq("user_id", ctx.userId)
      .in("organization_id", orgIds),
    supabaseAdmin
      .from("organization_teams")
      .select("id, organization_id")
      .in("organization_id", orgIds),
  ]);

  const orgWideAdmin = ((callerMemberships ?? []) as any[]).some(
    (m) => m.status === "active" && m.role === "organization_admin",
  );
  if (orgWideAdmin) return;

  const teamIdsByOrg = new Map<string, Set<string>>();
  for (const t of (teams ?? []) as any[]) {
    const set = teamIdsByOrg.get(t.organization_id) ?? new Set<string>();
    set.add(t.id);
    teamIdsByOrg.set(t.organization_id, set);
  }
  const allTeamIds = Array.from(new Set(((teams ?? []) as any[]).map((t) => t.id)));
  const { data: targetTeams } = allTeamIds.length
    ? await supabaseAdmin
        .from("team_memberships")
        .select("team_id")
        .eq("user_id", targetUserId)
        .in("team_id", allTeamIds)
        .eq("status", "active")
    : { data: [] as any[] };
  const targetTeamIds = new Set(((targetTeams ?? []) as any[]).map((t) => t.team_id));

  // Any active coach/organization_admin staff row in a shared org grants access.
  // Team scoping is preserved: staff rows bound to a team_id only match athletes
  // in that team. Granular per-permission gating (view_/manage_) intentionally
  // does NOT block reading a client profile — that gate belongs to the specific
  // action, not to opening the client.
  void permission; // permission is currently informational only
  const allowed = ((staffRows ?? []) as any[]).some((row) => {
    if (row.role !== "coach" && row.role !== "organization_admin") return false;
    if (!row.team_id) return true;
    return targetTeamIds.has(row.team_id);
  });

  if (!allowed) throw new Error("Kein Zugriff auf diesen Spieler.");
}
