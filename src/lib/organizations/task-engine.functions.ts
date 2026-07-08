import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runOrgTaskEngineWithClient } from "./task-engine.server";

function combineDateTime(dateStr: string, timeStr: string | null): string {
  const time = timeStr ?? "09:00:00";
  const [h, m, s] = time.split(":").map((x) => parseInt(x, 10) || 0);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, m, s || 0, 0);
  return d.toISOString();
}


/**
 * Manual "TASKS JETZT SYNCHRONISIEREN" trigger (coach button).
 * Automatic daily execution runs via /api/public/hooks/org-task-engine
 * scheduled with pg_cron. Both paths call the same idempotent helper.
 */

type EngineInput = { organization_id: string; horizon_days?: number };

export const runOrgTaskEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: EngineInput) => ({
    organization_id: String(d.organization_id),
    horizon_days: Math.min(Math.max(d.horizon_days ?? 14, 1), 30),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = data.organization_id;

    const [staffRes, coachRes] = await Promise.all([
      supabase
        .from("staff_assignments")
        .select("id")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
    ]);
    if (!staffRes.data && !coachRes.data) {
      throw new Error("Task Engine erfordert Staff- oder Coach-Berechtigung.");
    }

    const result = await runOrgTaskEngineWithClient(supabase, orgId, data.horizon_days);
    return {
      inserted: result.created_task_count,
      considered: result.created_task_count + result.skipped_duplicate_count,
      removed_stale: result.removed_stale_count,
      errors: result.error_details,
    };
  });


/** List tasks for a given day (org-wide) — coach only. */
export const listOrgTasksForDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; date?: string; team_id?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = data.organization_id;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach) {
      const { data: staff } = await supabase
        .from("staff_assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!staff) throw new Error("Kein Zugriff.");
    }
    const day = data.date ?? new Date().toISOString().slice(0, 10);
    let q = supabase
      .from("organization_tasks")
      .select("id, user_id, team_id, task_type, title, subtitle, scheduled_for, status, source_type")
      .eq("organization_id", orgId)
      .eq("scheduled_date", day)
      .order("scheduled_for", { ascending: true });
    if (data.team_id) q = q.eq("team_id", data.team_id);
    const { data: tasks, error } = await q;
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set(((tasks ?? []) as any[]).map((t) => t.user_id)));
    let names = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
      for (const p of (profs ?? []) as any[]) names.set(p.id, p.display_name || "Athlet");
    }
    return (tasks ?? []).map((t: any) => ({ ...t, athlete_name: names.get(t.user_id) ?? "Athlet" }));
  });

/** Create a manual staff task (org, team, or single athlete). */
export const createManualOrgTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      team_id?: string | null;
      user_ids?: string[] | null; // if null/empty: all org members (or all team members)
      task_type?: string; // default 'manual'
      title: string;
      subtitle?: string | null;
      scheduled_date: string; // YYYY-MM-DD
      scheduled_time?: string | null; // HH:mm
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = data.organization_id;
    // Require staff or coach
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach) {
      const { data: staff } = await supabase
        .from("staff_assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!staff) throw new Error("Kein Zugriff.");
    }

    // Resolve target user list
    let targets: string[] = [];
    if (data.user_ids && data.user_ids.length) {
      targets = data.user_ids;
    } else if (data.team_id) {
      const { data: teams } = await supabase.from("organization_teams").select("id").eq("id", data.team_id).eq("organization_id", orgId);
      if (!teams?.length) throw new Error("Team gehört nicht zu dieser Organisation.");
      const { data: tm } = await supabase.from("team_memberships").select("user_id").eq("team_id", data.team_id);
      targets = ((tm ?? []) as any[]).map((r) => r.user_id);
    } else {
      const { data: mem } = await supabase
        .from("organization_memberships")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("status", "active");
      targets = ((mem ?? []) as any[]).map((r) => r.user_id);
    }
    if (targets.length === 0) throw new Error("Keine Empfänger gefunden.");

    const scheduled_for = combineDateTime(data.scheduled_date, data.scheduled_time ?? null);
    const sourceId = crypto.randomUUID();
    const rows = targets.map((uid) => ({
      organization_id: orgId,
      team_id: data.team_id ?? null,
      user_id: uid,
      task_type: data.task_type || "manual",
      title: data.title,
      subtitle: data.subtitle ?? null,
      scheduled_for,
      scheduled_date: data.scheduled_date,
      status: "open",
      source_type: "manual",
      source_id: sourceId,
      payload: { created_by: userId },
    }));
    const { error, count } = await supabase.from("organization_tasks").insert(rows, { count: "exact" });
    if (error) throw new Error(error.message);
    return { created: count ?? rows.length };
  });

/** Team-training-schedule CRUD for staff/coach. */
export const upsertTeamTrainingSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      team_id: string;
      entries: { weekday: number; start_time?: string | null; end_time?: string | null; title?: string; active?: boolean }[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.entries.map((e) => ({
      team_id: data.team_id,
      weekday: e.weekday,
      start_time: e.start_time ?? null,
      end_time: e.end_time ?? null,
      title: e.title || "Team Training",
      active: e.active ?? true,
    }));
    const { error } = await supabase
      .from("organization_team_training_schedule")
      .upsert(rows, { onConflict: "team_id,weekday" });
    if (error) throw new Error(error.message);

    // Auto-Plan-Trigger: sobald der Coach den Team-Trainingsplan speichert,
    // enqueue einen Performance-Ernährungsplan-Job für die aktuelle Woche.
    // Fehler beim Trigger dürfen die Team-Training-Speicherung NIE brechen.
    try {
      const { data: team } = await supabase
        .from("organization_teams")
        .select("organization_id")
        .eq("id", data.team_id)
        .maybeSingle();
      const orgId = (team as { organization_id?: string } | null)?.organization_id;
      if (orgId) {
        const now = new Date();
        const day = now.getUTCDay();
        const mondayOffset = (day + 6) % 7;
        const monday = new Date(now);
        monday.setUTCDate(now.getUTCDate() - mondayOffset);
        const weekStart = monday.toISOString().slice(0, 10);
        await supabase.from("performance_plan_jobs").insert({
          organization_id: orgId,
          team_id: data.team_id,
          week_start: weekStart,
          trigger: "TEAM_SCHEDULE_CHANGED",
          status: "pending",
          created_by: userId,
        });
      }
    } catch {
      /* trigger best-effort; ignore duplicates & other errors */
    }

    return { ok: true };
  });

export const getTeamTrainingSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: teams } = await supabase
      .from("organization_teams")
      .select("id, name, slug")
      .eq("organization_id", data.organization_id);
    const teamIds = ((teams ?? []) as any[]).map((t) => t.id);
    if (!teamIds.length) return { teams: [], schedules: [] };
    const { data: schedules } = await supabase
      .from("organization_team_training_schedule")
      .select("id, team_id, weekday, start_time, end_time, title, active")
      .in("team_id", teamIds);
    return { teams: teams ?? [], schedules: schedules ?? [] };
  });

/** Onboarding audit: per athlete, which required org fields are missing. */
export const getOrgAthletesOnboardingAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = data.organization_id;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach) {
      const { data: staff } = await supabase
        .from("staff_assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!staff) throw new Error("Kein Zugriff.");
    }

    const [members, teams, profiles] = await Promise.all([
      supabase
        .from("organization_memberships")
        .select("user_id, role, onboarding_completed, status")
        .eq("organization_id", orgId),
      supabase.from("organization_teams").select("id, name").eq("organization_id", orgId),
      supabase
        .from("organization_memberships")
        .select("user_id")
        .eq("organization_id", orgId)
        .then(async (r) => {
          const ids = ((r.data ?? []) as any[]).map((m) => m.user_id);
          if (!ids.length) return { data: [] as any[] };
          return supabase.from("profiles").select("id, display_name").in("id", ids);
        }),
    ]);

    const teamIds = ((teams.data ?? []) as any[]).map((t) => t.id);
    const { data: tm } = teamIds.length
      ? await supabase
          .from("team_memberships")
          .select("user_id, team_id, position, jersey_number, gym_access, available_training_days")
          .in("team_id", teamIds)
      : { data: [] as any[] };

    const nameMap = new Map<string, string>();
    for (const p of ((profiles as any).data ?? []) as any[]) nameMap.set(p.id, p.display_name || "Athlet");
    const teamNameMap = new Map<string, string>();
    for (const t of ((teams.data ?? []) as any[])) teamNameMap.set(t.id, t.name);

    const athletes = ((members.data ?? []) as any[])
      .filter((m) => m.role === "athlete")
      .map((m) => {
        const t = (tm ?? []).find((x: any) => x.user_id === m.user_id);
        const missing: string[] = [];
        if (!t?.team_id) missing.push("Team");
        if (!t?.position) missing.push("Position");
        if (t?.jersey_number == null) missing.push("Trikotnummer");
        if (!t?.gym_access) missing.push("Gym-Zugang");
        if (!t?.available_training_days || (t.available_training_days as any[]).length === 0)
          missing.push("Verfügbare Trainingstage");
        const complete = missing.length === 0;
        return {
          user_id: m.user_id,
          name: nameMap.get(m.user_id) ?? "Athlet",
          onboarding_completed: !!m.onboarding_completed,
          derived_complete: complete,
          missing,
          team_id: t?.team_id ?? null,
          team_name: t?.team_id ? teamNameMap.get(t.team_id) ?? null : null,
          position: t?.position ?? null,
          jersey_number: t?.jersey_number ?? null,
          status: m.status ?? null,
        };
      });

    // Best-effort auto-backfill: if all required fields present but flag=false, flip it.
    const toComplete = athletes.filter((a) => a.derived_complete && !a.onboarding_completed).map((a) => a.user_id);
    if (toComplete.length) {
      await supabase
        .from("organization_memberships")
        .update({ onboarding_completed: true })
        .eq("organization_id", orgId)
        .in("user_id", toComplete);
      for (const a of athletes) if (toComplete.includes(a.user_id)) a.onboarding_completed = true;
    }

    return { athletes };
  });

/** Staff list joined with profile names (no email). */
export const listOrgStaffWithProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = data.organization_id;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach) {
      const { data: staff } = await supabase
        .from("staff_assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!staff) throw new Error("Kein Zugriff.");
    }
    const { data: staff } = await supabase
      .from("staff_assignments")
      .select("id, user_id, role, permissions, team_id")
      .eq("organization_id", orgId);
    const userIds = ((staff ?? []) as any[]).map((s) => s.user_id);
    const teamIds = ((staff ?? []) as any[]).map((s) => s.team_id).filter(Boolean);
    const [profs, teams] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      teamIds.length
        ? supabase.from("organization_teams").select("id, name").in("id", teamIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const nameMap = new Map<string, string>();
    for (const p of ((profs as any).data ?? []) as any[]) nameMap.set(p.id, p.display_name || "Staff");
    const teamMap = new Map<string, string>();
    for (const t of ((teams as any).data ?? []) as any[]) teamMap.set(t.id, t.name);
    return ((staff ?? []) as any[]).map((s) => ({
      id: s.id,
      user_id: s.user_id,
      name: nameMap.get(s.user_id) ?? "Staff",
      role: s.role,
      permissions: s.permissions ?? [],
      team_id: s.team_id,
      team_name: s.team_id ? teamMap.get(s.team_id) ?? null : null,
    }));
  });
