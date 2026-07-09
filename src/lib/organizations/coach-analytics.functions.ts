import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildAttentionList,
  classifyAthlete,
  type AthleteSignal,
} from "./coach-analytics.rules";
import { resolveCoachTeamScope } from "./coach-team-scope";
import { positionGroup, POSITION_GROUP_LABEL } from "@/lib/football-positions";


export type CoachAnalytics = {
  org: { id: string; name: string; slug: string; primary_color: string | null };
  range: { start: string; end: string; prev_start: string; prev_end: string };
  pulse: {
    weekly_compliance: number | null;
    weekly_compliance_delta: number | null;
    active_athletes: number;
    active_athletes_delta: number | null;
    training_sessions: number;
    training_sessions_delta: number | null;
    total_athletes: number;
  };
  radar: {
    critical: RadarItem[];
    watch: RadarItem[];
    positive: RadarItem[];
  };
  position_groups: PositionGroupStat[];
  attention_list: AttentionEntry[];
  readiness: TeamReadiness;
  data_sparse: boolean;
};

export type TeamReadiness = {
  submitted: number;
  total: number;
  avg_score: number | null;
  green: number;
  yellow: number;
  red: number;
  pain_flags: Array<{ user_id: string; name: string; pain_level: number; pain_note: string | null }>;
  missing: Array<{ user_id: string; name: string }>;
};


export type RadarItem = {
  user_id: string;
  name: string;
  position: string | null;
  reason: string;
  metric: string | null;
};

export type PositionGroupStat = {
  position: string;
  athletes: number;
  weekly_compliance: number | null;
  active: number;
};

export type AttentionEntry = {
  user_id: string;
  name: string;
  position: string | null;
  team_name: string | null;
  status: "critical" | "attention" | "watch" | "stable" | "positive";
  compliance: number | null;
  compliance_delta: number | null;
  last_active_days: number | null;
};

/** Analytical coach cockpit data — rolling 7-day window with vs. previous 7 days. */
export const getOrgCoachAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => ({ orgId: String(d.orgId) }))
  .handler(async ({ data, context }): Promise<CoachAnalytics | null> => {
    const { supabase, userId } = context;

    // Zentrale Team-Scope-Prüfung
    const scope = await resolveCoachTeamScope(supabase, userId, data.orgId);
    const teamFilterIds = scope.allTeams ? null : scope.allowedTeamIds;

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, slug, primary_color")
      .eq("id", data.orgId)
      .maybeSingle();
    if (!org) return null;

    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0);
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(start);

    // Teams zuerst laden (auf erlaubte Teams beschränkt)
    const { data: teamRows } = teamFilterIds
      ? await supabase
          .from("organization_teams")
          .select("id, name")
          .eq("organization_id", data.orgId)
          .in("id", teamFilterIds)
      : await supabase
          .from("organization_teams")
          .select("id, name")
          .eq("organization_id", data.orgId);
    const teams = (teamRows ?? []) as any[];
    const teamIds = teams.map((t) => t.id);

    // Athleten-IDs anhand Team-Membership beschneiden (bei team_coach)
    let scopedAthleteIds: string[] | null = null;
    if (!scope.allTeams) {
      const { data: tms } = teamIds.length
        ? await supabase
            .from("team_memberships")
            .select("user_id")
            .in("team_id", teamIds)
        : { data: [] as any[] };
      scopedAthleteIds = Array.from(new Set(((tms ?? []) as any[]).map((r) => r.user_id)));
    }

    // Core-Sets in Parallel
    const membersQ = scopedAthleteIds
      ? supabase
          .from("organization_memberships")
          .select("user_id, role, status, onboarding_completed")
          .eq("organization_id", data.orgId)
          .eq("role", "athlete")
          .in("user_id", scopedAthleteIds.length ? scopedAthleteIds : ["00000000-0000-0000-0000-000000000000"])
      : supabase
          .from("organization_memberships")
          .select("user_id, role, status, onboarding_completed")
          .eq("organization_id", data.orgId)
          .eq("role", "athlete");

    // Tasks (Training exkludiert) — Compliance-Basis
    const tasksBase = supabase
      .from("organization_tasks")
      .select("user_id, status, scheduled_for, task_type")
      .eq("organization_id", data.orgId)
      .not("task_type", "in", "(team_training,athletic_training)");

    // Trainings-Sessions (SoT) — Trainings-Aktivität
    const sessionsBaseCur = supabase
      .from("training_sessions")
      .select("client_id, status, session_date")
      .eq("organization_id", data.orgId)
      .gte("session_date", start.toISOString().slice(0, 10))
      .lt("session_date", now.toISOString().slice(0, 10));
    const sessionsBasePrev = supabase
      .from("training_sessions")
      .select("client_id, status, session_date")
      .eq("organization_id", data.orgId)
      .gte("session_date", prevStart.toISOString().slice(0, 10))
      .lt("session_date", prevEnd.toISOString().slice(0, 10));

    const [membersRes, tasksWeekRes, tasksPrevRes, activityRes, sessionsRes, trainingCurRes, trainingPrevRes] =
      await Promise.all([
        membersQ,
        (scopedAthleteIds
          ? tasksBase.in("user_id", scopedAthleteIds.length ? scopedAthleteIds : ["00000000-0000-0000-0000-000000000000"])
          : tasksBase
        ).gte("scheduled_for", start.toISOString()).lt("scheduled_for", now.toISOString()),
        (scopedAthleteIds
          ? supabase.from("organization_tasks").select("user_id, status, scheduled_for, task_type").eq("organization_id", data.orgId)
              .not("task_type", "in", "(team_training,athletic_training)")
              .in("user_id", scopedAthleteIds.length ? scopedAthleteIds : ["00000000-0000-0000-0000-000000000000"])
          : supabase.from("organization_tasks").select("user_id, status, scheduled_for, task_type").eq("organization_id", data.orgId)
              .not("task_type", "in", "(team_training,athletic_training)")
        ).gte("scheduled_for", prevStart.toISOString()).lt("scheduled_for", prevEnd.toISOString()),
        (scopedAthleteIds
          ? supabase.from("organization_activity_log").select("user_id, created_at").eq("organization_id", data.orgId)
              .in("user_id", scopedAthleteIds.length ? scopedAthleteIds : ["00000000-0000-0000-0000-000000000000"])
          : supabase.from("organization_activity_log").select("user_id, created_at").eq("organization_id", data.orgId)
        ).gte("created_at", prevStart.toISOString()).order("created_at", { ascending: false }),
        (scopedAthleteIds
          ? supabase.from("organization_athletic_session_completions").select("user_id, completed_at").eq("organization_id", data.orgId)
              .in("user_id", scopedAthleteIds.length ? scopedAthleteIds : ["00000000-0000-0000-0000-000000000000"])
          : supabase.from("organization_athletic_session_completions").select("user_id, completed_at").eq("organization_id", data.orgId)
        ).gte("completed_at", prevStart.toISOString()),
        scopedAthleteIds
          ? sessionsBaseCur.in("client_id", scopedAthleteIds.length ? scopedAthleteIds : ["00000000-0000-0000-0000-000000000000"])
          : sessionsBaseCur,
        scopedAthleteIds
          ? sessionsBasePrev.in("client_id", scopedAthleteIds.length ? scopedAthleteIds : ["00000000-0000-0000-0000-000000000000"])
          : sessionsBasePrev,
      ]);


    const athletes = (membersRes.data ?? []) as any[];
    const athleteIds = athletes.map((a) => a.user_id);

    // teams + teamIds bereits oben ermittelt (scoped)


    // Profile + team-membership lookups
    let profiles: Record<string, { name: string }> = {};
    let teamMems: Array<{ user_id: string; team_id: string; position: string | null }> = [];
    if (athleteIds.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", athleteIds);
      for (const row of (p ?? []) as any[]) {
        profiles[row.id] = { name: row.display_name ?? "Athlet" };
      }
    }
    if (teamIds.length && athleteIds.length) {
      const { data: tm } = await supabase
        .from("team_memberships")
        .select("user_id, team_id, position")
        .in("team_id", teamIds)
        .in("user_id", athleteIds);
      teamMems = (tm ?? []) as any[];
    }
    const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

    // Compliance per user (current + previous window)
    const cur = new Map<string, { total: number; done: number }>();
    const prev = new Map<string, { total: number; done: number }>();
    for (const t of (tasksWeekRes.data ?? []) as any[]) {
      const b = cur.get(t.user_id) ?? { total: 0, done: 0 };
      b.total++; if (t.status === "done") b.done++;
      cur.set(t.user_id, b);
    }
    for (const t of (tasksPrevRes.data ?? []) as any[]) {
      const b = prev.get(t.user_id) ?? { total: 0, done: 0 };
      b.total++; if (t.status === "done") b.done++;
      prev.set(t.user_id, b);
    }
    const pct = (b: { total: number; done: number } | undefined) =>
      b && b.total > 0 ? Math.round((b.done / b.total) * 100) : null;

    // Last-active per user (max of activity + session completions)
    const lastActive = new Map<string, number>();
    for (const r of (activityRes.data ?? []) as any[]) {
      const ts = new Date(r.created_at).getTime();
      if (!lastActive.has(r.user_id) || ts > (lastActive.get(r.user_id) ?? 0))
        lastActive.set(r.user_id, ts);
    }
    for (const r of (sessionsRes.data ?? []) as any[]) {
      const ts = new Date(r.completed_at).getTime();
      if (!lastActive.has(r.user_id) || ts > (lastActive.get(r.user_id) ?? 0))
        lastActive.set(r.user_id, ts);
    }
    const nowMs = now.getTime();
    const dayMs = 86_400_000;

    // Build per-athlete signals
    const signals: AthleteSignal[] = athletes.map((a) => {
      const tm = teamMems.find((t) => t.user_id === a.user_id);
      const compliance = pct(cur.get(a.user_id));
      const prevCompliance = pct(prev.get(a.user_id));
      const lastMs = lastActive.get(a.user_id);
      const daysInactive = lastMs != null ? Math.floor((nowMs - lastMs) / dayMs) : null;
      return {
        user_id: a.user_id,
        name: profiles[a.user_id]?.name ?? "Athlet",
        position: tm?.position ?? null,
        team_id: tm?.team_id ?? null,
        team_name: tm ? (teamNameById.get(tm.team_id) ?? null) : null,
        compliance,
        prev_compliance: prevCompliance,
        compliance_delta:
          compliance != null && prevCompliance != null ? compliance - prevCompliance : null,
        days_inactive: daysInactive,
        onboarding_completed: !!a.onboarding_completed,
      };
    });

    // Pulse (team totals)
    const totalTasksCur = (tasksWeekRes.data ?? []).length;
    const doneTasksCur = ((tasksWeekRes.data ?? []) as any[]).filter((t) => t.status === "done").length;
    const totalTasksPrev = (tasksPrevRes.data ?? []).length;
    const doneTasksPrev = ((tasksPrevRes.data ?? []) as any[]).filter((t) => t.status === "done").length;
    const weeklyCompliance = totalTasksCur > 0 ? Math.round((doneTasksCur / totalTasksCur) * 100) : null;
    const prevWeeklyCompliance = totalTasksPrev > 0 ? Math.round((doneTasksPrev / totalTasksPrev) * 100) : null;
    const activeCur = new Set(((tasksWeekRes.data ?? []) as any[]).filter((t) => t.status === "done").map((t) => t.user_id)).size;
    const activePrev = new Set(((tasksPrevRes.data ?? []) as any[]).filter((t) => t.status === "done").map((t) => t.user_id)).size;
    const trainingCur = ((trainingCurRes.data ?? []) as any[]).filter((s) => s.status === "completed").length;
    const trainingPrev = ((trainingPrevRes.data ?? []) as any[]).filter((s) => s.status === "completed").length;


    // Radar (rule-driven)
    const critical: RadarItem[] = [];
    const watch: RadarItem[] = [];
    const positive: RadarItem[] = [];
    for (const s of signals) {
      if (s.days_inactive != null && s.days_inactive >= 7) {
        critical.push({
          user_id: s.user_id, name: s.name, position: s.position,
          reason: `${s.days_inactive} Tage keine Aktivität`,
          metric: null,
        });
      } else if (s.compliance_delta != null && s.compliance_delta <= -20) {
        critical.push({
          user_id: s.user_id, name: s.name, position: s.position,
          reason: `Compliance ${s.compliance_delta}% ggü. Vorwoche`,
          metric: s.compliance != null ? `${s.compliance}%` : null,
        });
      } else if (s.compliance != null && s.compliance < 40) {
        watch.push({
          user_id: s.user_id, name: s.name, position: s.position,
          reason: `Compliance nur ${s.compliance}%`,
          metric: `${s.compliance}%`,
        });
      } else if (s.compliance_delta != null && s.compliance_delta >= 20) {
        positive.push({
          user_id: s.user_id, name: s.name, position: s.position,
          reason: `Compliance +${s.compliance_delta}% ggü. Vorwoche`,
          metric: s.compliance != null ? `${s.compliance}%` : null,
        });
      }
    }

    // Position groups — aggregiert auf Offense / Defense / Special Teams
    const groupMap = new Map<"offense" | "defense" | "special" | "other", { athletes: number; compl: number[]; active: number }>();
    for (const s of signals) {
      const key = positionGroup(s.position);
      const g = groupMap.get(key) ?? { athletes: 0, compl: [], active: 0 };
      g.athletes++;
      if (s.compliance != null) g.compl.push(s.compliance);
      if (s.days_inactive != null && s.days_inactive < 7) g.active++;
      groupMap.set(key, g);
    }
    const GROUP_ORDER: Array<"offense" | "defense" | "special" | "other"> = ["offense", "defense", "special", "other"];
    const positionGroups: PositionGroupStat[] = GROUP_ORDER
      .filter((k) => (groupMap.get(k)?.athletes ?? 0) > 0)
      .map((k) => {
        const g = groupMap.get(k)!;
        return {
          position: POSITION_GROUP_LABEL[k],
          athletes: g.athletes,
          weekly_compliance:
            g.compl.length > 0 ? Math.round(g.compl.reduce((a, b) => a + b, 0) / g.compl.length) : null,
          active: g.active,
        };
      });


    // Attention list (classified)
    const attentionList: AttentionEntry[] = buildAttentionList(signals).map((s) => ({
      user_id: s.user_id,
      name: s.name,
      position: s.position,
      team_name: s.team_name,
      status: classifyAthlete(s),
      compliance: s.compliance,
      compliance_delta: s.compliance_delta,
      last_active_days: s.days_inactive,
    }));

    const totalActivityRows =
      (activityRes.data?.length ?? 0) +
      (sessionsRes.data?.length ?? 0) +
      totalTasksCur + totalTasksPrev;

    return {
      org,
      range: {
        start: start.toISOString(), end: now.toISOString(),
        prev_start: prevStart.toISOString(), prev_end: prevEnd.toISOString(),
      },
      pulse: {
        weekly_compliance: weeklyCompliance,
        weekly_compliance_delta:
          weeklyCompliance != null && prevWeeklyCompliance != null
            ? weeklyCompliance - prevWeeklyCompliance
            : null,
        active_athletes: activeCur,
        active_athletes_delta: activePrev > 0 ? activeCur - activePrev : null,
        training_sessions: trainingCur,
        training_sessions_delta: trainingPrev > 0 ? trainingCur - trainingPrev : null,
        total_athletes: athletes.length,
      },
      radar: { critical, watch, positive },
      position_groups: positionGroups,
      attention_list: attentionList,
      data_sparse: totalActivityRows < 5,
    };
  });
