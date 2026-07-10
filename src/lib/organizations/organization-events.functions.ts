import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";

/**
 * Generischer Organisations-Kalender (`organization_events`).
 *
 * Bewusst organisationsagnostisch gehalten: Matchdays, Trainings, Camps,
 * Turniere, Tests. Aktuell exposen wir nur den Match-Kontext via UI
 * (Sub-Section „Spieltermine" im OrgLoadTab), die technische Datenstruktur
 * ist aber vollständig generisch.
 */

export type OrgEventType =
  | "match"
  | "training"
  | "tournament"
  | "camp"
  | "test"
  | "other";

export type OrgEvent = {
  id: string;
  organization_id: string;
  team_id: string | null;
  event_type: OrgEventType;
  title: string | null;
  starts_at: string;
  ends_at: string | null;
  opponent: string | null;
  location: string | null;
  competition: string | null;
  metadata: Json;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const listOrgEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      orgId: string;
      teamId?: string | null;
      eventType?: OrgEventType | null;
      from?: string | null; // ISO date (inclusive)
      to?: string | null; // ISO date (exclusive/inclusive — handled via lte)
    }) => data,
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("organization_events")
      .select("*")
      .eq("organization_id", data.orgId);
    if (data.eventType) q = q.eq("event_type", data.eventType);
    if (data.teamId === null) q = q.is("team_id", null);
    else if (typeof data.teamId === "string") q = q.eq("team_id", data.teamId);
    if (data.from) q = q.gte("starts_at", `${data.from}T00:00:00Z`);
    if (data.to) q = q.lte("starts_at", `${data.to}T23:59:59Z`);
    const { data: rows, error } = await q.order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as OrgEvent[];
  });

export const upsertOrgEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string | null;
      orgId: string;
      teamId?: string | null;
      event_type: OrgEventType;
      title?: string | null;
      starts_at: string; // ISO timestamp
      ends_at?: string | null;
      opponent?: string | null;
      location?: string | null;
      competition?: string | null;
      metadata?: Json | null;
      source?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const row = {
      organization_id: data.orgId,
      team_id: data.teamId ?? null,
      event_type: data.event_type,
      title: data.title ?? null,
      starts_at: data.starts_at,
      ends_at: data.ends_at ?? null,
      opponent: data.opponent ?? null,
      location: data.location ?? null,
      competition: data.competition ?? null,
      metadata: (data.metadata ?? {}) as Json,
      source: data.source ?? "manual",
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("organization_events")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("organization_events")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

export const deleteOrgEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("organization_events")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Interner Helper (server-only) — nicht als Server Fn exportiert.
 * Auflösungshierarchie:
 *  1) Aktive Team-Memberships des Athleten im Org
 *  2) Events mit team_id ∈ (…) bevorzugen (nur nächster/gleicher Tag)
 *  3) Fallback auf orgweite Events (team_id = null)
 *
 * Ein U17-Spieler bekommt so nie automatisch ein U19-Match zugewiesen.
 */
export async function getNextMatchForAthlete(
  supabase: SupabaseClient,
  params: { organizationId: string; userId: string; date: string /* YYYY-MM-DD */ },
): Promise<{ event_id: string; starts_at: string; date: string; team_id: string | null } | null> {
  const { organizationId, userId, date } = params;
  const startFrom = `${date}T00:00:00Z`;

  const { data: memberships } = await supabase
    .from("team_memberships")
    .select("team_id, organization_teams!inner(organization_id)")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("organization_teams.organization_id", organizationId);
  const teamIds = ((memberships ?? []) as Array<{ team_id: string }>).map((m) => m.team_id);

  // 1) Team-spezifisches Match zuerst
  if (teamIds.length > 0) {
    const { data: teamMatch } = await supabase
      .from("organization_events")
      .select("id, starts_at, team_id")
      .eq("organization_id", organizationId)
      .eq("event_type", "match")
      .in("team_id", teamIds)
      .gte("starts_at", startFrom)
      .order("starts_at", { ascending: true })
      .limit(1);
    if (teamMatch && teamMatch.length > 0) {
      const m = teamMatch[0] as { id: string; starts_at: string; team_id: string | null };
      return {
        event_id: m.id,
        starts_at: m.starts_at,
        date: m.starts_at.slice(0, 10),
        team_id: m.team_id,
      };
    }
  }

  // 2) Orgweites Match (team_id null)
  const { data: orgMatch } = await supabase
    .from("organization_events")
    .select("id, starts_at, team_id")
    .eq("organization_id", organizationId)
    .eq("event_type", "match")
    .is("team_id", null)
    .gte("starts_at", startFrom)
    .order("starts_at", { ascending: true })
    .limit(1);
  if (orgMatch && orgMatch.length > 0) {
    const m = orgMatch[0] as { id: string; starts_at: string; team_id: string | null };
    return {
      event_id: m.id,
      starts_at: m.starts_at,
      date: m.starts_at.slice(0, 10),
      team_id: m.team_id,
    };
  }
  return null;
}

/**
 * Alle Matches einer Woche für die (optional Team-gefilterte) Belastungssteuerung.
 * Wird von `suggestLoadWeek` genutzt, damit der Coach keine Spieltage mehr
 * manuell eingeben muss.
 */
export const listMatchDatesForWeek = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { orgId: string; teamId?: string | null; weekStart: string; weekEnd: string }) => data,
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("organization_events")
      .select("id, starts_at, team_id, opponent, competition")
      .eq("organization_id", data.orgId)
      .eq("event_type", "match")
      .gte("starts_at", `${data.weekStart}T00:00:00Z`)
      .lte("starts_at", `${data.weekEnd}T23:59:59Z`);
    // Team-scope: team-eigene Events + orgweite
    if (data.teamId) {
      q = q.or(`team_id.eq.${data.teamId},team_id.is.null`);
    }
    const { data: rows, error } = await q.order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      starts_at: string;
      team_id: string | null;
      opponent: string | null;
      competition: string | null;
    }>;
  });
