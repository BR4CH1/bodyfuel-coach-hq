import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Organization Task Engine
 *
 * Idempotently generates organization_tasks from these sources:
 *   1. organization_team_training_schedule       -> task_type='team_training'
 *   2. organization_athletic_plans (payload)     -> task_type='athletic_training'
 *   3. organization_challenges (active, daily)   -> task_type='challenge'
 *   4. organization_features (checkins config)   -> task_type='daily_checkin'
 * Manual staff tasks (source_type='manual') are inserted directly by
 * createManualOrgTask and are NEVER touched by the engine.
 *
 * Idempotency: uniqueness on (org, user, task_type, source_type, source_id,
 * scheduled_date) via partial unique index -> ON CONFLICT DO NOTHING.
 */

type EngineInput = { organization_id: string; horizon_days?: number };

function dateOnlyIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function combineDateTime(dateStr: string, timeStr: string | null): string {
  const time = timeStr ?? "09:00:00";
  const [h, m, s] = time.split(":").map((x) => parseInt(x, 10) || 0);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, m, s || 0, 0);
  return d.toISOString();
}

export const runOrgTaskEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: EngineInput) => ({
    organization_id: String(d.organization_id),
    horizon_days: Math.min(Math.max(d.horizon_days ?? 7, 1), 30),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = data.organization_id;

    // Authorization: staff of the org OR platform coach can run the engine.
    // Athletes cannot INSERT into organization_tasks per RLS, so restricting
    // the engine here avoids silent failures.
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

    // Load org context
    const [teamsRes, membershipsRes, teamMembershipsRes, featuresRes, schedulesRes, plansRes, challengesRes] =
      await Promise.all([
        supabase.from("organization_teams").select("id").eq("organization_id", orgId),
        supabase
          .from("organization_memberships")
          .select("user_id, status")
          .eq("organization_id", orgId)
          .eq("status", "active"),
        supabase.from("team_memberships").select("user_id, team_id, status"),
        supabase.from("organization_features").select("feature, enabled, config").eq("organization_id", orgId),
        supabase.from("organization_team_training_schedule").select("id, team_id, weekday, start_time, title, active"),
        supabase
          .from("organization_athletic_plans")
          .select("id, user_id, team_id, name, payload, status")
          .eq("organization_id", orgId)
          .eq("status", "active"),
        supabase
          .from("organization_challenges")
          .select("id, name, config, starts_at, ends_at, status")
          .eq("organization_id", orgId)
          .eq("status", "active"),
      ]);

    const teamIds = new Set<string>(((teamsRes.data ?? []) as any[]).map((t) => t.id));
    const memberIds = new Set<string>(((membershipsRes.data ?? []) as any[]).map((m) => m.user_id));
    const teamMemberships = ((teamMembershipsRes.data ?? []) as any[]).filter(
      (tm) => teamIds.has(tm.team_id) && memberIds.has(tm.user_id) && tm.status !== "inactive",
    );
    const featureMap = new Map<string, { enabled: boolean; config: any }>();
    for (const f of (featuresRes.data ?? []) as any[]) {
      featureMap.set(f.feature, { enabled: !!f.enabled, config: f.config ?? {} });
    }

    // Build rows to insert
    const rows: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let offset = 0; offset < data.horizon_days; offset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      const dateIso = dateOnlyIso(date);
      const weekday = date.getDay(); // 0=Sun..6=Sat

      // 1) Team training schedule
      const schedules = ((schedulesRes.data ?? []) as any[]).filter(
        (s) => teamIds.has(s.team_id) && s.active && s.weekday === weekday,
      );
      for (const s of schedules) {
        const usersInTeam = teamMemberships.filter((tm) => tm.team_id === s.team_id);
        for (const tm of usersInTeam) {
          rows.push({
            organization_id: orgId,
            team_id: s.team_id,
            user_id: tm.user_id,
            task_type: "team_training",
            title: s.title || "Team Training",
            subtitle: null,
            scheduled_for: combineDateTime(dateIso, s.start_time),
            scheduled_date: dateIso,
            status: "open",
            source_type: "team_training_schedule",
            source_id: s.id,
            link_target: null,
            payload: {},
          });
        }
      }

      // 4) Daily check-in
      const checkins = featureMap.get("checkins");
      if (checkins?.enabled) {
        const cfg = checkins.config || {};
        const enabled = cfg.daily_checkin_enabled !== false;
        const days: number[] = Array.isArray(cfg.checkin_days) ? cfg.checkin_days : [0, 1, 2, 3, 4, 5, 6];
        if (enabled && days.includes(weekday)) {
          for (const uid of memberIds) {
            rows.push({
              organization_id: orgId,
              team_id: null,
              user_id: uid,
              task_type: "daily_checkin",
              title: "Daily Check-in",
              subtitle: "Wie geht's dir heute?",
              scheduled_for: combineDateTime(dateIso, cfg.checkin_available_from ?? "08:00"),
              scheduled_date: dateIso,
              status: "open",
              source_type: "daily_checkin_config",
              source_id: orgId, // stable per org+day
              link_target: "/daily-check",
              payload: { due_time: cfg.checkin_due_time ?? null },
            });
          }
        }
      }

      // 3) Active challenges (daily task if config.daily === true)
      for (const ch of (challengesRes.data ?? []) as any[]) {
        const cfg = ch.config ?? {};
        if (cfg.daily !== true) continue;
        // Only within challenge date range
        if (ch.starts_at && new Date(ch.starts_at) > date) continue;
        if (ch.ends_at && new Date(ch.ends_at) < date) continue;
        for (const uid of memberIds) {
          rows.push({
            organization_id: orgId,
            team_id: null,
            user_id: uid,
            task_type: "challenge",
            title: ch.name || "Challenge Aufgabe",
            subtitle: cfg.subtitle ?? null,
            scheduled_for: combineDateTime(dateIso, cfg.time ?? "12:00"),
            scheduled_date: dateIso,
            status: "open",
            source_type: "challenge",
            source_id: ch.id,
            link_target: null,
            payload: { challenge_id: ch.id },
            points: typeof cfg.points === "number" ? cfg.points : null,
          });
        }
      }
    }

    // 2) Athletic plans: expand payload.sessions[]
    for (const plan of (plansRes.data ?? []) as any[]) {
      const sessions: any[] = Array.isArray(plan.payload?.sessions) ? plan.payload.sessions : [];
      for (const sess of sessions) {
        if (!sess?.scheduled_date) continue;
        const d = new Date(`${sess.scheduled_date}T00:00:00`);
        if (d < today) continue;
        const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
        if (diff >= data.horizon_days) continue;
        const targets = plan.user_id
          ? [plan.user_id]
          : plan.team_id
          ? teamMemberships.filter((tm) => tm.team_id === plan.team_id).map((tm) => tm.user_id)
          : [];
        for (const uid of targets) {
          rows.push({
            organization_id: orgId,
            team_id: plan.team_id ?? null,
            user_id: uid,
            task_type: "athletic_training",
            title: sess.title || plan.name || "Athletic Training",
            subtitle: sess.subtitle ?? null,
            scheduled_for: combineDateTime(sess.scheduled_date, sess.time ?? "17:00"),
            scheduled_date: sess.scheduled_date,
            status: "open",
            source_type: "athletic_plan",
            source_id: plan.id,
            duration_min: sess.duration_min ?? null,
            link_target: null,
            payload: { session: sess },
          });
        }
      }
    }

    if (rows.length === 0) return { inserted: 0, considered: 0 };

    // Insert with idempotent conflict handling (unique partial index)
    const { error, count } = await supabase
      .from("organization_tasks")
      .upsert(rows, {
        onConflict: "organization_id,user_id,task_type,source_type,source_id,scheduled_date",
        ignoreDuplicates: true,
        count: "exact",
      });
    if (error) throw new Error(error.message);
    return { inserted: count ?? 0, considered: rows.length };
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
    const { supabase } = context;
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
