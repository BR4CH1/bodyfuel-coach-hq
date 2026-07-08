/**
 * Wochenbezogene Team-Trainingspläne (Bulls Coach Bereich).
 *
 * Jede Kalenderwoche (Montag–Sonntag) ist ein eigener Datenblock pro
 * (organization, team, week_start) mit Draft/Publish-Status. Das Veröffentlichen
 * schreibt ausschließlich Athleten-Tasks im Zeitraum der Woche und lässt
 * bestehende Tasks außerhalb dieses Zeitraums unangetastet.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Verschiebt ein Datum auf den Montag derselben ISO-Kalenderwoche. */
export function toMondayIso(dateIso: string): string {
  const d = new Date(dateIso + "T12:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const offset = (dow + 6) % 7; // Distance to Monday
  d.setUTCDate(d.getUTCDate() - offset);
  return isoDate(d);
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function combineDateTime(dateIso: string, timeStr: string | null): string {
  const t = timeStr ?? "09:00:00";
  const [h, m, s] = t.split(":").map((x) => parseInt(x, 10) || 0);
  const d = new Date(`${dateIso}T00:00:00`);
  d.setHours(h, m, s || 0, 0);
  return d.toISOString();
}

async function assertTeamAccess(
  ctx: { supabase: any; userId: string },
  orgId: string,
  teamId: string,
  needWrite: boolean,
) {
  const { resolveCoachTeamScope } = await import("./coach-team-scope");
  const scope = await resolveCoachTeamScope(ctx.supabase, ctx.userId, orgId);
  if (!scope.allTeams && !scope.allowedTeamIds.includes(teamId)) {
    throw new Error("Kein Zugriff auf dieses Team.");
  }
  // needWrite ist implizit erfüllt, weil resolveCoachTeamScope für staff/coach greift.
  void needWrite;
  return scope;
}

/* -------------------------------------------------------------------------- */
/* Read                                                                        */
/* -------------------------------------------------------------------------- */

export const listTeamTrainingWeeks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { organization_id: string; team_id: string; from?: string; to?: string }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertTeamAccess(context, data.organization_id, data.team_id, false);
    let q = context.supabase
      .from("org_team_training_week")
      .select("id, team_id, week_start, status, published_at")
      .eq("organization_id", data.organization_id)
      .eq("team_id", data.team_id);
    if (data.from) q = q.gte("week_start", toMondayIso(data.from));
    if (data.to) q = q.lte("week_start", toMondayIso(data.to));
    const { data: rows, error } = await q.order("week_start", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const getTeamTrainingWeek = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { organization_id: string; team_id: string; week_start: string }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertTeamAccess(context, data.organization_id, data.team_id, false);
    const monday = toMondayIso(data.week_start);
    const { data: week, error } = await context.supabase
      .from("org_team_training_week")
      .select("id, team_id, organization_id, week_start, status, published_at, published_by")
      .eq("organization_id", data.organization_id)
      .eq("team_id", data.team_id)
      .eq("week_start", monday)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!week) {
      return {
        exists: false,
        team_id: data.team_id,
        organization_id: data.organization_id,
        week_start: monday,
        week_end: addDaysIso(monday, 6),
        status: "draft" as const,
        published_at: null as string | null,
        sessions: [] as any[],
      };
    }
    const { data: sessions } = await context.supabase
      .from("org_team_training_week_session")
      .select("id, session_date, title, description, start_time, end_time, active")
      .eq("week_id", (week as any).id)
      .order("session_date", { ascending: true });
    return {
      exists: true,
      team_id: (week as any).team_id,
      organization_id: (week as any).organization_id,
      week_id: (week as any).id,
      week_start: (week as any).week_start,
      week_end: addDaysIso((week as any).week_start, 6),
      status: (week as any).status as "draft" | "published",
      published_at: (week as any).published_at as string | null,
      sessions: (sessions ?? []) as any[],
    };
  });

/* -------------------------------------------------------------------------- */
/* Write (Draft/Update)                                                        */
/* -------------------------------------------------------------------------- */

export const upsertTeamTrainingWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      team_id: string;
      week_start: string;
      sessions: Array<{
        session_date: string;
        title?: string;
        description?: string | null;
        start_time?: string | null;
        end_time?: string | null;
        active?: boolean;
      }>;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertTeamAccess(context, data.organization_id, data.team_id, true);
    const { supabase, userId } = context;
    const monday = toMondayIso(data.week_start);
    const weekEnd = addDaysIso(monday, 6);

    // Validate all session dates within the week
    for (const s of data.sessions) {
      if (s.session_date < monday || s.session_date > weekEnd) {
        throw new Error(`session_date ${s.session_date} liegt außerhalb der Woche.`);
      }
    }

    // Upsert week header (keep status if already exists)
    const existing = await supabase
      .from("org_team_training_week")
      .select("id, status")
      .eq("organization_id", data.organization_id)
      .eq("team_id", data.team_id)
      .eq("week_start", monday)
      .maybeSingle();

    let weekId: string;
    if (existing.data) {
      weekId = (existing.data as any).id;
    } else {
      const ins = await supabase
        .from("org_team_training_week")
        .insert({
          organization_id: data.organization_id,
          team_id: data.team_id,
          week_start: monday,
          status: "draft",
          created_by: userId,
        })
        .select("id")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      weekId = (ins.data as any).id;
    }

    // Replace sessions strictly within [monday, weekEnd]
    const del = await supabase
      .from("org_team_training_week_session")
      .delete()
      .eq("week_id", weekId)
      .gte("session_date", monday)
      .lte("session_date", weekEnd);
    if (del.error) throw new Error(del.error.message);

    if (data.sessions.length) {
      const rows = data.sessions.map((s) => ({
        week_id: weekId,
        session_date: s.session_date,
        title: s.title || "Team Training",
        description: s.description ?? null,
        start_time: s.start_time || null,
        end_time: s.end_time || null,
        active: s.active ?? true,
      }));
      const ins = await supabase.from("org_team_training_week_session").insert(rows);
      if (ins.error) throw new Error(ins.error.message);
    }
    return { ok: true, week_id: weekId, week_start: monday, week_end: weekEnd };
  });

/* -------------------------------------------------------------------------- */
/* Publish                                                                     */
/* -------------------------------------------------------------------------- */

export const publishTeamTrainingWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { organization_id: string; team_id: string; week_start: string }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertTeamAccess(context, data.organization_id, data.team_id, true);
    const { supabase, userId } = context;
    const monday = toMondayIso(data.week_start);
    const weekEnd = addDaysIso(monday, 6);

    const weekRes = await supabase
      .from("org_team_training_week")
      .select("id")
      .eq("organization_id", data.organization_id)
      .eq("team_id", data.team_id)
      .eq("week_start", monday)
      .maybeSingle();
    if (!weekRes.data) throw new Error("Wochenplan existiert noch nicht.");
    const weekId = (weekRes.data as any).id;

    const upd = await supabase
      .from("org_team_training_week")
      .update({ status: "published", published_at: new Date().toISOString(), published_by: userId })
      .eq("id", weekId);
    if (upd.error) throw new Error(upd.error.message);

    const sessionsRes = await supabase
      .from("org_team_training_week_session")
      .select("id, session_date, title, start_time, active")
      .eq("week_id", weekId);
    const sessions = ((sessionsRes.data ?? []) as any[]).filter((s) => s.active !== false);

    // Alle aktiven Team-Mitglieder ermitteln
    const tmRes = await supabase
      .from("team_memberships")
      .select("user_id, status")
      .eq("team_id", data.team_id);
    const memberIds = ((tmRes.data ?? []) as any[])
      .filter((r) => (r.status ?? "active") !== "inactive")
      .map((r) => r.user_id as string);

    // 1) Alte team_training_tasks für DIESES Team im Zeitraum, die NICHT completed sind, entfernen.
    //    Aber nur den offenen Bereich — nichts vor monday oder nach weekEnd anfassen.
    if (memberIds.length) {
      await supabase
        .from("organization_tasks")
        .delete()
        .eq("organization_id", data.organization_id)
        .eq("team_id", data.team_id)
        .eq("task_type", "team_training")
        .eq("status", "open")
        .gte("scheduled_date", monday)
        .lte("scheduled_date", weekEnd);
    }

    let inserted = 0;
    if (memberIds.length && sessions.length) {
      const rows: any[] = [];
      for (const s of sessions) {
        for (const uid of memberIds) {
          rows.push({
            organization_id: data.organization_id,
            team_id: data.team_id,
            user_id: uid,
            task_type: "team_training",
            title: s.title || "Team Training",
            scheduled_for: combineDateTime(s.session_date, s.start_time ?? null),
            scheduled_date: s.session_date,
            status: "open",
            source_type: "team_training_week",
            source_id: weekId,
            payload: { session_id: s.id },
          });
        }
      }
      const up = await supabase.from("organization_tasks").upsert(rows, {
        onConflict: "organization_id,user_id,task_type,source_type,source_id,scheduled_date",
        ignoreDuplicates: true,
        count: "exact",
      });
      if (up.error) throw new Error(up.error.message);
      inserted = up.count ?? rows.length;
    }

    return {
      ok: true,
      week_id: weekId,
      week_start: monday,
      week_end: weekEnd,
      published_for_athletes: memberIds.length,
      inserted_tasks: inserted,
    };
  });

/* -------------------------------------------------------------------------- */
/* Athletensicht: aktuelle + kommende Woche                                    */
/* -------------------------------------------------------------------------- */

export const getMyTeamTrainingWeeks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id?: string | null } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Alle aktiven Teams des Users; optional auf eine Organisation eingegrenzt.
    let q = supabase
      .from("team_memberships")
      .select("team_id, organization_teams!inner(id, organization_id)")
      .eq("user_id", userId);
    if (data.organization_id) {
      q = q.eq("organization_teams.organization_id", data.organization_id);
    }
    const teamsRes = await q;
    const teamIds = ((teamsRes.data ?? []) as any[]).map((r) => r.team_id as string);
    if (!teamIds.length) return { current: null, upcoming: null };

    const today = new Date();
    const todayMonday = toMondayIso(isoDate(today));
    const nextMonday = addDaysIso(todayMonday, 7);

    const wkRes = await supabase
      .from("org_team_training_week")
      .select("id, team_id, week_start, status")
      .in("team_id", teamIds)
      .in("week_start", [todayMonday, nextMonday])
      .eq("status", "published");
    const weeks = (wkRes.data ?? []) as any[];
    const currentWeek = weeks.find((w) => w.week_start === todayMonday) ?? null;
    const upcomingWeek = weeks.find((w) => w.week_start === nextMonday) ?? null;

    async function loadSessions(weekId: string | null) {
      if (!weekId) return [] as any[];
      const { data: rows } = await supabase
        .from("org_team_training_week_session")
        .select("session_date, title, start_time, end_time, active")
        .eq("week_id", weekId)
        .eq("active", true)
        .order("session_date", { ascending: true });
      return (rows ?? []) as any[];
    }

    const [curSess, upSess] = await Promise.all([
      loadSessions(currentWeek?.id ?? null),
      loadSessions(upcomingWeek?.id ?? null),
    ]);

    return {
      current: currentWeek
        ? { week_start: currentWeek.week_start, week_end: addDaysIso(currentWeek.week_start, 6), sessions: curSess }
        : null,
      upcoming: upcomingWeek
        ? { week_start: upcomingWeek.week_start, week_end: addDaysIso(upcomingWeek.week_start, 6), sessions: upSess }
        : null,
    };
  });

