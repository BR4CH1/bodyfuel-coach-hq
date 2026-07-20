import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCoachTeamScope } from "./coach-team-scope";

export type OrgReadinessGateSummary = {
  athletes_flagged: number;
  events_total: number;
  hard: number;
  soft: number;
  top: Array<{
    user_id: string;
    name: string | null;
    events: number;
    hard: number;
    last_reason: string | null;
  }>;
};

/**
 * Team-weiter Überblick über aktive Readiness-Gates in den letzten 14 Tagen.
 * Nutzt die zentrale Coach-Team-Scope-Prüfung — kein Bulls-Sonderfall.
 */
export const getOrgReadinessGateSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; days?: number }) => ({
    orgId: String(d.orgId),
    days: d.days ?? 14,
  }))
  .handler(async ({ data, context }): Promise<OrgReadinessGateSummary> => {
    const { supabase, userId } = context;
    const scope = await resolveCoachTeamScope(supabase, userId, data.orgId);

    // Athleten-Scope bestimmen
    const teamIds = scope.allTeams ? scope.allTeamIds : scope.allowedTeamIds;
    let athleteIds: string[] = [];
    if (teamIds.length > 0) {
      const { data: tms } = await supabase
        .from("team_memberships")
        .select("user_id")
        .in("team_id", teamIds);
      athleteIds = Array.from(new Set(((tms as any[]) ?? []).map((r) => r.user_id)));
    }
    if (athleteIds.length === 0) {
      return { athletes_flagged: 0, events_total: 0, hard: 0, soft: 0, top: [] };
    }

    const days = Math.min(60, Math.max(1, Number(data.days ?? 14)));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: rows } = await supabase
      .from("training_progression_events")
      .select("client_id, readiness_gate, readiness_gate_reason, evaluated_at")
      .in("client_id", athleteIds)
      .not("readiness_gate", "is", null)
      .gte("evaluated_at", since.toISOString())
      .order("evaluated_at", { ascending: false });

    const byUser = new Map<
      string,
      { events: number; hard: number; last_reason: string | null; last_at: number }
    >();
    let hard = 0;
    let soft = 0;
    for (const r of ((rows as any[]) ?? [])) {
      const cur = byUser.get(r.client_id) ?? {
        events: 0,
        hard: 0,
        last_reason: null,
        last_at: 0,
      };
      cur.events += 1;
      if (r.readiness_gate === "reduce") {
        cur.hard += 1;
        hard += 1;
      } else {
        soft += 1;
      }
      const t = new Date(r.evaluated_at).getTime();
      if (t > cur.last_at) {
        cur.last_at = t;
        cur.last_reason = r.readiness_gate_reason ?? cur.last_reason;
      }
      byUser.set(r.client_id, cur);
    }

    // Namen der Top-Athleten laden
    const topIds = Array.from(byUser.entries())
      .sort((a, b) => b[1].hard - a[1].hard || b[1].events - a[1].events)
      .slice(0, 5)
      .map(([id]) => id);
    let nameMap = new Map<string, string>();
    if (topIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", topIds);
      for (const p of ((profs as any[]) ?? [])) {
        if (p.display_name) nameMap.set(p.id, p.display_name);
      }
    }

    return {
      athletes_flagged: byUser.size,
      events_total: rows?.length ?? 0,
      hard,
      soft,
      top: topIds.map((id) => {
        const v = byUser.get(id)!;
        return {
          user_id: id,
          name: nameMap.get(id) || null,
          events: v.events,
          hard: v.hard,
          last_reason: v.last_reason,
        };
      }),
    };
  });
