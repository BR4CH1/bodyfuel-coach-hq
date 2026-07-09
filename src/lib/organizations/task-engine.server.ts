/**
 * Shared task-engine core.
 * Called from:
 *   - runOrgTaskEngine (server fn, auth-scoped client)
 *   - /api/public/hooks/org-task-engine (cron route, service-role client)
 *
 * BodyFuel Performance — Phase 1b.2:
 * Training ist KEIN Task mehr. team_training und athletic_training werden
 * NICHT mehr als organization_tasks erzeugt. Trainings leben ausschließlich
 * in `training_sessions` (SoT). Die Task-Engine erzeugt hier nur noch
 * echte Aufgaben (daily_checkin, challenge, …) und räumt zusätzlich
 * eventuell noch vorhandene zukünftige Trainings-Tasks defensiv weg.
 *
 * Idempotent: relies on the partial UNIQUE index
 *   (org, user, task_type, source_type, source_id, scheduled_date)
 * with ignoreDuplicates upsert.
 */

type Client = any;

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

export type EngineOrgResult = {
  organization_id: string;
  started_at: string;
  completed_at: string;
  created_task_count: number;
  skipped_duplicate_count: number;
  removed_stale_count: number;
  error_count: number;
  error_details: string[];
};

export async function runOrgTaskEngineWithClient(
  supabase: Client,
  orgId: string,
  horizonDays: number = 14,
): Promise<EngineOrgResult> {
  const started_at = new Date().toISOString();
  const errors: string[] = [];
  let created = 0;
  let considered = 0;
  let removed = 0;

  try {
    const orgSlugRes = await supabase.from("organizations").select("slug").eq("id", orgId).maybeSingle();
    const orgSlug = ((orgSlugRes.data as any)?.slug ?? orgId) as string;
    const [teamsRes, membershipsRes, teamMembershipsRes, featuresRes, schedulesRes, plansRes, plansSessionsRes, assignmentsRes, challengesRes, weekWeeksRes, weekSessionsRes] =
      await Promise.all([

        supabase.from("organization_teams").select("id").eq("organization_id", orgId),
        supabase
          .from("organization_memberships")
          .select("user_id, status")
          .eq("organization_id", orgId)
          .eq("status", "active"),
        supabase.from("team_memberships").select("user_id, team_id, position, status"),
        supabase.from("organization_features").select("feature, enabled, config").eq("organization_id", orgId),
        supabase.from("organization_team_training_schedule").select("id, team_id, weekday, start_time, title, active"),
        supabase
          .from("organization_athletic_plans")
          .select("id, user_id, team_id, name, payload, status, start_date, end_date, organization_id")
          .eq("organization_id", orgId)
          .eq("status", "active"),
        supabase
          .from("organization_athletic_plan_sessions")
          .select("id, plan_id, session_name, estimated_duration_minutes, scheduled_weekdays, focus_areas"),
        supabase
          .from("organization_athletic_plan_assignments")
          .select("id, plan_id, organization_id, scope_type, team_id, position, athlete_user_id, active")
          .eq("organization_id", orgId)
          .eq("active", true),
        supabase
          .from("organization_challenges")
          .select("id, name, config, starts_at, ends_at, status, team_id")
          .eq("organization_id", orgId)
          .eq("status", "active"),
        supabase
          .from("org_team_training_week")
          .select("id, team_id, week_start, status")
          .eq("organization_id", orgId)
          .eq("status", "published"),
        supabase
          .from("org_team_training_week_session")
          .select("id, week_id, session_date, title, start_time, active")
          .eq("active", true),
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

    const plans = (plansRes.data ?? []) as any[];
    const planSessions = ((plansSessionsRes.data ?? []) as any[]).filter((s) =>
      plans.some((p) => p.id === s.plan_id),
    );
    const assignments = (assignmentsRes.data ?? []) as any[];

    // Priority resolver: for a plan, decide which users it targets today.
    // Higher priority scope wins per user if same plan.
    function resolvePlanTargets(planId: string): { user_id: string; team_id: string | null }[] {
      const planAssignments = assignments.filter((a) => a.plan_id === planId);
      if (!planAssignments.length) return [];
      // Athlete scope
      const athleteScoped = planAssignments.filter((a) => a.scope_type === "athlete" && a.athlete_user_id);
      const positionScoped = planAssignments.filter((a) => a.scope_type === "position" && a.position && a.team_id);
      const teamScoped = planAssignments.filter((a) => a.scope_type === "team" && a.team_id);
      const orgScoped = planAssignments.filter((a) => a.scope_type === "organization");
      const targets = new Map<string, { user_id: string; team_id: string | null }>();
      for (const a of athleteScoped) if (memberIds.has(a.athlete_user_id))
        targets.set(a.athlete_user_id, { user_id: a.athlete_user_id, team_id: a.team_id ?? null });
      for (const a of positionScoped) {
        const tms = teamMemberships.filter(
          (tm) => tm.team_id === a.team_id && (tm.position || "").toLowerCase() === (a.position || "").toLowerCase(),
        );
        for (const tm of tms) if (!targets.has(tm.user_id)) targets.set(tm.user_id, { user_id: tm.user_id, team_id: a.team_id });
      }
      for (const a of teamScoped) {
        const tms = teamMemberships.filter((tm) => tm.team_id === a.team_id);
        for (const tm of tms) if (!targets.has(tm.user_id)) targets.set(tm.user_id, { user_id: tm.user_id, team_id: a.team_id });
      }
      for (const a of orgScoped) {
        for (const uid of memberIds) if (!targets.has(uid)) targets.set(uid, { user_id: uid, team_id: null });
      }
      return Array.from(targets.values());
    }

    // Wochenbezogene published Team-Trainingspläne indexen: welche (team, date)
    // sind durch eine veröffentlichte Woche abgedeckt (Legacy-Weekday wird dann
    // für dieses Team+Datum unterdrückt).
    const publishedWeeks = ((weekWeeksRes.data ?? []) as any[]).filter((w) => teamIds.has(w.team_id));
    const weekIdToTeam = new Map<string, string>();
    const weekIdToStart = new Map<string, string>();
    for (const w of publishedWeeks) {
      weekIdToTeam.set(w.id, w.team_id);
      weekIdToStart.set(w.id, w.week_start as string);
    }
    const coveredTeamDate = new Set<string>();
    const weeklySessionsByDate = new Map<string, any[]>();
    for (const s of ((weekSessionsRes.data ?? []) as any[])) {
      const teamId = weekIdToTeam.get(s.week_id);
      if (!teamId) continue;
      const start = weekIdToStart.get(s.week_id)!;
      const endDate = new Date(start + "T00:00:00Z");
      endDate.setUTCDate(endDate.getUTCDate() + 6);
      const endIso = dateOnlyIso(endDate);
      // Alle Daten der Woche gelten als "covered" (auch inaktive Tage → keine Legacy-Doppelung).
      let cur = new Date(start + "T00:00:00Z");
      const stop = new Date(endIso + "T00:00:00Z");
      while (cur <= stop) {
        coveredTeamDate.add(`${teamId}::${dateOnlyIso(cur)}`);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      const key = `${teamId}::${s.session_date}`;
      if (!weeklySessionsByDate.has(key)) weeklySessionsByDate.set(key, []);
      weeklySessionsByDate.get(key)!.push(s);
    }

    // Build rows
    const rows: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let offset = 0; offset < horizonDays; offset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      const dateIso = dateOnlyIso(date);
      const weekday = date.getDay();

      // 1) Wochenbezogene Team-Trainings (published) — pro (team, session_date)
      for (const [key, sess] of weeklySessionsByDate) {
        const [teamId, sessDate] = key.split("::");
        if (sessDate !== dateIso) continue;
        const usersInTeam = teamMemberships.filter((tm) => tm.team_id === teamId);
        for (const s of sess) {
          for (const tm of usersInTeam) {
            rows.push({
              organization_id: orgId,
              team_id: teamId,
              user_id: tm.user_id,
              task_type: "team_training",
              title: s.title || "Team Training",
              scheduled_for: combineDateTime(dateIso, s.start_time),
              scheduled_date: dateIso,
              status: "open",
              source_type: "team_training_week",
              source_id: s.week_id,
              payload: { session_id: s.id },
            });
          }
        }
      }

      // 2) Legacy Weekday-Team Training schedule — nur wenn (team, date) NICHT
      //    durch eine veröffentlichte Woche abgedeckt ist.
      const schedules = ((schedulesRes.data ?? []) as any[]).filter(
        (s) => teamIds.has(s.team_id) && s.active && s.weekday === weekday,
      );
      for (const s of schedules) {
        if (coveredTeamDate.has(`${s.team_id}::${dateIso}`)) continue;
        const usersInTeam = teamMemberships.filter((tm) => tm.team_id === s.team_id);
        for (const tm of usersInTeam) {
          rows.push({
            organization_id: orgId,
            team_id: s.team_id,
            user_id: tm.user_id,
            task_type: "team_training",
            title: s.title || "Team Training",
            scheduled_for: combineDateTime(dateIso, s.start_time),
            scheduled_date: dateIso,
            status: "open",
            source_type: "team_training_schedule",
            source_id: s.id,
            payload: {},
          });
        }
      }



      // Daily check-in
      const checkins = featureMap.get("checkins");
      if (checkins?.enabled) {
        const cfg = checkins.config || {};
        const enabled = cfg.daily_checkin_enabled !== false;
        const days: number[] = Array.isArray(cfg.checkin_days) ? cfg.checkin_days : [0, 1, 2, 3, 4, 5, 6];
        if (enabled && days.includes(weekday)) {
          for (const uid of memberIds) {
            rows.push({
              organization_id: orgId,
              user_id: uid,
              task_type: "daily_checkin",
              title: "Daily Check-in",
              subtitle: "Wie geht's dir heute?",
              scheduled_for: combineDateTime(dateIso, cfg.checkin_available_from ?? "08:00"),
              scheduled_date: dateIso,
              status: "open",
              source_type: "daily_checkin_config",
              source_id: orgId,
              link_target: `/daily-checklist?org=${orgSlug}`,
              payload: { due_time: cfg.checkin_due_time ?? null },
            });
          }
        }
      }

      // Active challenges (daily flag)
      for (const ch of (challengesRes.data ?? []) as any[]) {
        const cfg = ch.config ?? {};
        if (cfg.daily !== true) continue;
        if (ch.starts_at && new Date(ch.starts_at) > date) continue;
        if (ch.ends_at && new Date(ch.ends_at) < date) continue;
        for (const uid of memberIds) {
          rows.push({
            organization_id: orgId,
            user_id: uid,
            task_type: "challenge",
            title: ch.name || "Challenge Aufgabe",
            subtitle: cfg.subtitle ?? null,
            scheduled_for: combineDateTime(dateIso, cfg.time ?? "12:00"),
            scheduled_date: dateIso,
            status: "open",
            source_type: "challenge",
            source_id: ch.id,
            payload: { challenge_id: ch.id },
            points: typeof cfg.points === "number" ? cfg.points : null,
          });
        }
      }

      // Athletic plan sessions (new structured system)
      for (const sess of planSessions) {
        const plan = plans.find((p) => p.id === sess.plan_id);
        if (!plan) continue;
        if (plan.start_date && new Date(`${plan.start_date}T00:00:00`) > date) continue;
        if (plan.end_date && new Date(`${plan.end_date}T00:00:00`) < date) continue;
        const weekdays: number[] = Array.isArray(sess.scheduled_weekdays) ? sess.scheduled_weekdays : [];
        if (!weekdays.includes(weekday)) continue;
        const targets = resolvePlanTargets(plan.id);
        for (const t of targets) {
          rows.push({
            organization_id: orgId,
            team_id: t.team_id,
            user_id: t.user_id,
            task_type: "athletic_training",
            title: sess.session_name || plan.name || "Athletic Training",
            subtitle: (sess.focus_areas as string[] | null)?.join(", ") ?? null,
            scheduled_for: combineDateTime(dateIso, "17:00"),
            scheduled_date: dateIso,
            duration_min: sess.estimated_duration_minutes ?? null,
            status: "open",
            source_type: "athletic_plan_session",
            source_id: sess.id,
            link_target: `/${orgSlug}/athletic/${sess.id}`,
            payload: { plan_id: plan.id, session_id: sess.id },
          });
        }
      }

      // Legacy athletic plan payload sessions (backwards compat: plans with payload.sessions[])
      for (const plan of plans) {
        const sessions: any[] = Array.isArray(plan.payload?.sessions) ? plan.payload.sessions : [];
        for (const sess of sessions) {
          if (!sess?.scheduled_date) continue;
          if (sess.scheduled_date !== dateIso) continue;
          const legacyTargets = plan.user_id
            ? [{ user_id: plan.user_id as string, team_id: plan.team_id ?? null }]
            : plan.team_id
              ? teamMemberships.filter((tm) => tm.team_id === plan.team_id).map((tm) => ({ user_id: tm.user_id, team_id: plan.team_id }))
              : [];
          for (const t of legacyTargets) {
            rows.push({
              organization_id: orgId,
              team_id: t.team_id ?? null,
              user_id: t.user_id,
              task_type: "athletic_training",
              title: sess.title || plan.name || "Athletic Training",
              subtitle: sess.subtitle ?? null,
              scheduled_for: combineDateTime(sess.scheduled_date, sess.time ?? "17:00"),
              scheduled_date: sess.scheduled_date,
              duration_min: sess.duration_min ?? null,
              status: "open",
              source_type: "athletic_plan",
              source_id: plan.id,
              payload: { session: sess },
            });
          }
        }
      }
    }

    considered = rows.length;

    // Delete FUTURE pending team_training / athletic_training tasks whose
    // source no longer applies (schedule row inactive/removed or session removed).
    const todayIso = dateOnlyIso(today);
    const { data: futureAuto } = await supabase
      .from("organization_tasks")
      .select("id, task_type, source_type, source_id, scheduled_date, status")
      .eq("organization_id", orgId)
      .in("task_type", ["team_training", "athletic_training"])
      .eq("status", "open")
      .gte("scheduled_date", todayIso);
    const validSourceIds = new Set(rows.map((r) => `${r.task_type}::${r.source_type}::${r.source_id}::${r.scheduled_date}`));
    const stale = ((futureAuto ?? []) as any[]).filter(
      (t) =>
        (t.source_type === "team_training_schedule" || t.source_type === "athletic_plan_session" || t.source_type === "team_training_week") &&
        !validSourceIds.has(`${t.task_type}::${t.source_type}::${t.source_id}::${t.scheduled_date}`),
    );
    if (stale.length) {
      const ids = stale.map((s) => s.id);
      const { error: delErr } = await supabase.from("organization_tasks").delete().in("id", ids).eq("status", "open");
      if (delErr) errors.push(`stale cleanup: ${delErr.message}`);
      else removed = ids.length;
    }

    if (rows.length) {
      const { error, count } = await supabase.from("organization_tasks").upsert(rows, {
        onConflict: "organization_id,user_id,task_type,source_type,source_id,scheduled_date",
        ignoreDuplicates: true,
        count: "exact",
      });
      if (error) errors.push(`upsert: ${error.message}`);
      else created = count ?? 0;
    }
  } catch (e: any) {
    errors.push(e?.message || String(e));
  }

  const completed_at = new Date().toISOString();
  const skipped_duplicate_count = Math.max(0, considered - created);

  // Log to activity log (best effort)
  try {
    await supabase.from("organization_activity_log").insert({
      organization_id: orgId,
      event_type: "task_engine_run",
      payload: {
        started_at,
        completed_at,
        created_task_count: created,
        skipped_duplicate_count,
        removed_stale_count: removed,
        error_count: errors.length,
        error_details: errors,
        horizon_days: horizonDays,
      },
    });
  } catch {
    // ignore
  }

  return {
    organization_id: orgId,
    started_at,
    completed_at,
    created_task_count: created,
    skipped_duplicate_count,
    removed_stale_count: removed,
    error_count: errors.length,
    error_details: errors,
  };
}
