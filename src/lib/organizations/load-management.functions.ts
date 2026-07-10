import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Belastungssteuerung (Load Management).
 *
 * Speicher: `organization_load_days` — pro Organisation und optional Team ein
 * Belastungstag mit Stufe 0..5, Session-Typ und Coach-Notiz.
 *
 * Autorisierung: RLS auf der Tabelle. Coaches/Org-Admins schreiben, Org-
 * Mitglieder lesen. Alle Funktionen laufen als eingeloggter User.
 */

export type LoadDay = {
  id: string;
  organization_id: string;
  team_id: string | null;
  date: string;
  load_level: number;
  session_type: string | null;
  notes: string | null;
  updated_at: string;
};

export const listLoadWeek = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { orgId: string; teamId?: string | null; weekStart: string; weekEnd: string }) => data,
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("organization_load_days")
      .select("*")
      .eq("organization_id", data.orgId)
      .gte("date", data.weekStart)
      .lte("date", data.weekEnd);
    if (data.teamId) q = q.eq("team_id", data.teamId);
    else q = q.is("team_id", null);
    const { data: rows, error } = await q.order("date");
    if (error) throw new Error(error.message);
    return (rows ?? []) as LoadDay[];
  });

export const upsertLoadDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      orgId: string;
      teamId?: string | null;
      date: string;
      load_level: number;
      session_type?: string | null;
      notes?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const row = {
      organization_id: data.orgId,
      team_id: data.teamId ?? null,
      date: data.date,
      load_level: data.load_level,
      session_type: data.session_type ?? null,
      notes: data.notes ?? null,
      created_by: context.userId,
    };
    // onConflict abhängig davon, ob team_id gesetzt ist — beides ist durch
    // partielle UNIQUE-Indexe abgedeckt. Bei team-spezifischen Tagen upserten
    // wir über den team-Index, sonst über den org-weiten.
    let existingQ = context.supabase
      .from("organization_load_days")
      .select("id")
      .eq("organization_id", data.orgId)
      .eq("date", data.date);
    existingQ = data.teamId
      ? existingQ.eq("team_id", data.teamId)
      : existingQ.is("team_id", null);
    const { data: existing } = await existingQ.maybeSingle();

    if (existing?.id) {
      const { error } = await context.supabase
        .from("organization_load_days")
        .update({
          load_level: row.load_level,
          session_type: row.session_type,
          notes: row.notes,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: existing.id };
    } else {
      const { data: inserted, error } = await context.supabase
        .from("organization_load_days")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, id: (inserted as { id: string }).id };
    }
  });

export const deleteLoadDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("organization_load_days")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Belastung eines Athleten für ein Datum. Wählt team-spezifischen Eintrag
 * bevorzugt, sonst orgweit. Beide, damit Ernährungs-Engine reagieren kann,
 * auch wenn Smart Training aus ist.
 */
export const getLoadForAthlete = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; teamId?: string | null; date: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("organization_load_days")
      .select("*")
      .eq("organization_id", data.orgId)
      .eq("date", data.date);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as LoadDay[];
    if (data.teamId) {
      const team = list.find((r) => r.team_id === data.teamId);
      if (team) return team;
    }
    return list.find((r) => r.team_id === null) ?? null;
  });

/** Farbcodes / Labels für die UI. */
export const LOAD_LEVELS: { level: number; label: string; short: string; color: string }[] = [
  { level: 0, label: "Rest", short: "R", color: "#374151" },
  { level: 1, label: "Regen", short: "1", color: "#3b82f6" },
  { level: 2, label: "Leicht", short: "2", color: "#10b981" },
  { level: 3, label: "Mittel", short: "3", color: "#f59e0b" },
  { level: 4, label: "Hart", short: "4", color: "#f97316" },
  { level: 5, label: "Match", short: "M", color: "#dc2626" },
];
