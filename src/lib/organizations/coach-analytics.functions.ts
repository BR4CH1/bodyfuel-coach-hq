import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildAttentionList,
  classifyAthlete,
  type AthleteSignal,
} from "./coach-analytics.rules";

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
  data_sparse: boolean;
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

    // Authorization: same rule as getOrgCoachDetail (coach role OR any staff on this org).
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach) {
      const { data: staff } = await supabase
        .from("staff_assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("organization_id", data.orgId)
        .maybeSingle();
      if (!staff) throw new Error("Kein Zugriff.");
    }

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

    // Load core sets in parallel.
    const [membersRes, teamsRes, tasksWeekRes, tasksPrevRes, activityRes, sessionsRes] =
      await Promise.all([
        supabase
          .from("organization_memberships")
          .select("user_id, role, status, onboarding_completed")
          .eq("organization_id", data.orgId)
          .eq("role", "athlete"),
        supabase
          .from("organization_teams")
          .select("id, name")
          .eq("organization_id", data.orgId),
        supabase
          .from("organization_tasks")
          .select("user_id, status, scheduled_for, task_type")
          .eq("organization_id", data.orgId)
          .gte("scheduled_for", start.toISOString())
          .lt("scheduled_for", now.toISOString()),
        supabase
          .from("organization_tasks")
          .select("user_id, status, scheduled_for, task_type")
          .eq("organization_id", data.orgId)
          .gte("scheduled_for", prevStart.toISOString())
          .lt("scheduled_for", prevEnd.toISOString()),
        supabase
          .from("organization_activity_log")
          .select("user_id, created_at")
          .eq("organization_id", data.orgId)
          .gte("created_at", prevStart.toISOString())
          .order("created_at", { ascending: false }),
        supabase
          .from("organization_athletic_session_completions")
          .select("user_id, completed_at")
          .eq("organization_id", data.orgId)
          .gte("completed_at", prevStart.toISOString()),
      ]);

    const athletes = (membersRes.data ?? []) as any[];
    const athleteIds = athletes.map((a) => a.user_id);
    const teams = (teamsRes.data ?? []) as any[];
    const teamIds = teams.map((t) => t.id);

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
    const trainingCur = ((tasksWeekRes.data ?? []) as any[]).filter((t) => t.status === "done" && ["athletic_training", "team_training"].includes(t.task_type)).length;
    const trainingPrev = ((tasksPrevRes.data ?? []) as any[]).filter((t) => t.status === "done" && ["athletic_training", "team_training"].includes(t.task_type)).length;

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

    // Position groups
    const groupMap = new Map<string, { athletes: number; compl: number[]; active: number }>();
    for (const s of signals) {
      const key = s.position ?? "—";
      const g = groupMap.get(key) ?? { athletes: 0, compl: [], active: 0 };
      g.athletes++;
      if (s.compliance != null) g.compl.push(s.compliance);
      if (s.days_inactive != null && s.days_inactive < 7) g.active++;
      groupMap.set(key, g);
    }
    const positionGroups: PositionGroupStat[] = Array.from(groupMap.entries())
      .map(([position, g]) => ({
        position,
        athletes: g.athletes,
        weekly_compliance:
          g.compl.length > 0 ? Math.round(g.compl.reduce((a, b) => a + b, 0) / g.compl.length) : null,
        active: g.active,
      }))
      .sort((a, b) => b.athletes - a.athletes);

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
