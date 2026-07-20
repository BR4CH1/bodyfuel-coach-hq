import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Roster + Schedule Helper für das Vereins-Cockpit.
 * - Team → Positionsgruppen → Athleten Kaskade
 * - Gruppen-Wochenplan (Training + Ernährung)
 * - Spieler-Wochenplan (Training + Ernährung)
 * Zugriff: has_role('coach') ODER staff/org-admin/head_coach der Organisation.
 */

async function assertOrgManager(
  ctx: { supabase: any; userId: string },
  orgId: string,
  permission?: "manage_training" | "manage_nutrition" | "manage_members",
) {
  const { data: isCoach } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "coach",
  });
  if (isCoach) return true;
  const { data: staff } = await ctx.supabase
    .from("staff_assignments")
    .select("id, role, permissions")
    .eq("user_id", ctx.userId)
    .eq("organization_id", orgId);
  const rows = (staff ?? []) as any[];
  if (!rows.length) throw new Error("Kein Zugriff.");
  if (!permission) return true;
  const ok = rows.some(
    (s) =>
      s.role === "organization_admin" ||
      s.role === "coach" ||
      (Array.isArray(s.permissions) && s.permissions.includes(permission)),
  );
  if (!ok) throw new Error("Keine Berechtigung.");
  return true;
}

async function assertTeamInOrg(supabase: any, teamId: string, orgId: string) {
  const { data } = await supabase
    .from("organization_teams")
    .select("id, organization_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!data || data.organization_id !== orgId) throw new Error("Team gehört nicht zur Organisation.");
}

/** Positionsgruppen eines Teams inkl. Anzahl aktiver Spieler. */
export const listTeamPositionGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; team_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.organization_id);
    await assertTeamInOrg(context.supabase, data.team_id, data.organization_id);
    const { data: rows, error } = await context.supabase.rpc("get_team_position_groups", {
      _team_id: data.team_id,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as { position_group: string; athlete_count: number }[];
  });

/** Athleten eines Teams, optional gefiltert nach Positionsgruppe + Freitextsuche. */
export const listTeamAthletesForAssign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      team_id: string;
      position_group?: string | null;
      query?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.organization_id);
    await assertTeamInOrg(context.supabase, data.team_id, data.organization_id);
    const { supabase } = context;
    let q = supabase
      .from("team_memberships")
      .select("user_id, position, jersey_number, status")
      .eq("team_id", data.team_id)
      .eq("status", "active");
    const { data: tm, error } = await q;
    if (error) throw new Error(error.message);
    let rows = ((tm ?? []) as any[]).filter((r) => {
      if (!data.position_group) return true;
      return (r.position ?? "").toLowerCase() === data.position_group.toLowerCase();
    });
    const uids = rows.map((r) => r.user_id);
    if (!uids.length) return [];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name, nickname")
      .in("id", uids);
    const profMap = new Map<string, any>();
    for (const p of (profs ?? []) as any[]) profMap.set(p.id, p);
    const merged = rows.map((r) => {
      const p = profMap.get(r.user_id);
      const name = p?.display_name || p?.nickname || "Athlet";
      return {
        user_id: r.user_id,
        name,
        position: r.position as string | null,
        jersey_number: r.jersey_number as number | null,
      };
    });
    const query = (data.query ?? "").trim().toLowerCase();
    const filtered = query
      ? merged.filter(
          (a) =>
            a.name.toLowerCase().includes(query) ||
            (a.position ?? "").toLowerCase().includes(query) ||
            String(a.jersey_number ?? "").includes(query),
        )
      : merged;
    return filtered.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 100);
  });

/* ---------------- Group + Athlete Training Schedule ---------------- */

export const getGroupTrainingSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; team_id: string; position_group: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.organization_id, "manage_training");
    await assertTeamInOrg(context.supabase, data.team_id, data.organization_id);
    const { data: rows, error } = await context.supabase
      .from("org_group_training_schedule")
      .select("id, team_id, position_group, weekday, title, description, start_time, end_time, active")
      .eq("team_id", data.team_id)
      .eq("position_group", data.position_group);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const upsertGroupTrainingSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      team_id: string;
      position_group: string;
      entries: {
        weekday: number;
        title?: string;
        description?: string | null;
        start_time?: string | null;
        end_time?: string | null;
        active?: boolean;
      }[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.organization_id, "manage_training");
    await assertTeamInOrg(context.supabase, data.team_id, data.organization_id);
    const rows = data.entries.map((e) => ({
      team_id: data.team_id,
      position_group: data.position_group,
      weekday: e.weekday,
      title: e.title || "Positions-Training",
      description: e.description ?? null,
      start_time: e.start_time ?? null,
      end_time: e.end_time ?? null,
      active: e.active ?? true,
    }));
    const { error } = await context.supabase
      .from("org_group_training_schedule")
      .upsert(rows, { onConflict: "team_id,position_group,weekday" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAthleteTrainingSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; user_id: string; team_id?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.organization_id, "manage_training");
    const { data: rows, error } = await context.supabase
      .from("athlete_training_schedule")
      .select("id, user_id, team_id, weekday, title, description, start_time, end_time, active")
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const upsertAthleteTrainingSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      user_id: string;
      team_id?: string | null;
      entries: {
        weekday: number;
        title?: string;
        description?: string | null;
        start_time?: string | null;
        end_time?: string | null;
        active?: boolean;
      }[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.organization_id, "manage_training");
    const rows = data.entries.map((e) => ({
      user_id: data.user_id,
      team_id: data.team_id ?? null,
      weekday: e.weekday,
      title: e.title || "Individuelles Training",
      description: e.description ?? null,
      start_time: e.start_time ?? null,
      end_time: e.end_time ?? null,
      active: e.active ?? true,
    }));
    const { error } = await context.supabase
      .from("athlete_training_schedule")
      .upsert(rows, { onConflict: "user_id,weekday" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Nutrition Schedules ---------------- */

export const getTeamNutritionSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; team_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.organization_id, "manage_nutrition");
    await assertTeamInOrg(context.supabase, data.team_id, data.organization_id);
    const { data: rows, error } = await context.supabase
      .from("org_team_nutrition_schedule")
      .select("id, team_id, weekday, title, description, nutrition_plan_id, active")
      .eq("team_id", data.team_id);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const upsertTeamNutritionSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      team_id: string;
      entries: {
        weekday: number;
        title?: string;
        description?: string | null;
        nutrition_plan_id?: string | null;
        active?: boolean;
      }[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.organization_id, "manage_nutrition");
    await assertTeamInOrg(context.supabase, data.team_id, data.organization_id);
    const rows = data.entries.map((e) => ({
      team_id: data.team_id,
      weekday: e.weekday,
      title: e.title || "Ernährungsplan",
      description: e.description ?? null,
      nutrition_plan_id: e.nutrition_plan_id ?? null,
      active: e.active ?? true,
    }));
    const { error } = await context.supabase
      .from("org_team_nutrition_schedule")
      .upsert(rows, { onConflict: "team_id,weekday" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGroupNutritionSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; team_id: string; position_group: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.organization_id, "manage_nutrition");
    await assertTeamInOrg(context.supabase, data.team_id, data.organization_id);
    const { data: rows, error } = await context.supabase
      .from("org_group_nutrition_schedule")
      .select("id, team_id, position_group, weekday, title, description, nutrition_plan_id, active")
      .eq("team_id", data.team_id)
      .eq("position_group", data.position_group);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const upsertGroupNutritionSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      team_id: string;
      position_group: string;
      entries: {
        weekday: number;
        title?: string;
        description?: string | null;
        nutrition_plan_id?: string | null;
        active?: boolean;
      }[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.organization_id, "manage_nutrition");
    await assertTeamInOrg(context.supabase, data.team_id, data.organization_id);
    const rows = data.entries.map((e) => ({
      team_id: data.team_id,
      position_group: data.position_group,
      weekday: e.weekday,
      title: e.title || "Positions-Ernährung",
      description: e.description ?? null,
      nutrition_plan_id: e.nutrition_plan_id ?? null,
      active: e.active ?? true,
    }));
    const { error } = await context.supabase
      .from("org_group_nutrition_schedule")
      .upsert(rows, { onConflict: "team_id,position_group,weekday" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAthleteNutritionSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; user_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.organization_id, "manage_nutrition");
    const { data: rows, error } = await context.supabase
      .from("athlete_nutrition_schedule")
      .select("id, user_id, team_id, weekday, title, description, nutrition_plan_id, active")
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const upsertAthleteNutritionSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      user_id: string;
      team_id?: string | null;
      entries: {
        weekday: number;
        title?: string;
        description?: string | null;
        nutrition_plan_id?: string | null;
        active?: boolean;
      }[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.organization_id, "manage_nutrition");
    const rows = data.entries.map((e) => ({
      user_id: data.user_id,
      team_id: data.team_id ?? null,
      weekday: e.weekday,
      title: e.title || "Individueller Ernährungsplan",
      description: e.description ?? null,
      nutrition_plan_id: e.nutrition_plan_id ?? null,
      active: e.active ?? true,
    }));
    const { error } = await context.supabase
      .from("athlete_nutrition_schedule")
      .upsert(rows, { onConflict: "user_id,weekday" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
