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
  .validator(
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
  .validator(
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

    let resultId: string;
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
      resultId = existing.id;
    } else {
      const { data: inserted, error } = await context.supabase
        .from("organization_load_days")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      resultId = (inserted as { id: string }).id;
    }

    // Fire-and-forget: Ernährungsplan-Recalc für alle betroffenen Athleten.
    try {
      const { runNutritionRecalc } = await import("./nutrition-plan-recalc-core.server");
      const reason =
        data.load_level >= 4
          ? "intensity_increase"
          : data.load_level <= 1
            ? "recovery_context"
            : "intensity_decrease";
      await runNutritionRecalc(context.supabase, {
        callerId: context.userId,
        orgId: data.orgId,
        teamId: data.teamId ?? null,
        dates: [data.date],
        reason,
      });
    } catch (e) {
      // Recalc-Fehler dürfen die Load-Änderung nicht blockieren.
      console.error("[upsertLoadDay] recalc failed:", e);
    }
    return { ok: true, id: resultId };
  });

export const deleteLoadDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    // Row-Info vor dem Löschen einlesen, damit wir gezielt recalcen können.
    const { data: existing } = await context.supabase
      .from("organization_load_days")
      .select("organization_id, team_id, date")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("organization_load_days")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (existing) {
      try {
        const { runNutritionRecalc } = await import("./nutrition-plan-recalc-core.server");
        await runNutritionRecalc(context.supabase, {
          callerId: context.userId,
          orgId: (existing as { organization_id: string }).organization_id,
          teamId: (existing as { team_id: string | null }).team_id,
          dates: [(existing as { date: string }).date],
          reason: "rest_context",
        });
      } catch (e) {
        console.error("[deleteLoadDay] recalc failed:", e);
      }
    }
    return { ok: true };
  });

/**
 * Belastung eines Athleten für ein Datum. Priorität:
 *   1) Athleten-Override (organization_load_day_athlete_overrides)
 *   2) Team-spezifischer Coach-Eintrag
 *   3) Orgweiter Coach-Eintrag
 */
export const getLoadForAthlete = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { orgId: string; teamId?: string | null; date: string }) => data)
  .handler(async ({ data, context }) => {
    // 1) Athleten-Override
    const { data: ov } = await context.supabase
      .from("organization_load_day_athlete_overrides")
      .select("id, organization_id, date, load_level, note, updated_at")
      .eq("organization_id", data.orgId)
      .eq("user_id", context.userId)
      .eq("date", data.date)
      .maybeSingle();
    if (ov) {
      return {
        id: ov.id,
        organization_id: ov.organization_id,
        team_id: null,
        date: ov.date,
        load_level: ov.load_level,
        session_type: null,
        notes: ov.note,
        updated_at: ov.updated_at,
        source: "athlete_override" as const,
      };
    }

    const { data: rows, error } = await context.supabase
      .from("organization_load_days")
      .select("*")
      .eq("organization_id", data.orgId)
      .eq("date", data.date);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as LoadDay[];
    if (data.teamId) {
      const team = list.find((r) => r.team_id === data.teamId);
      if (team) return { ...team, source: "team" as const };
    }
    const org = list.find((r) => r.team_id === null);
    return org ? { ...org, source: "org" as const } : null;
  });

export const upsertAthleteLoadOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { orgId: string; date: string; load_level: number; note?: string | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("organization_load_day_athlete_overrides")
      .select("id")
      .eq("organization_id", data.orgId)
      .eq("user_id", context.userId)
      .eq("date", data.date)
      .maybeSingle();
    let overrideId: string;
    if (existing?.id) {
      const { error } = await context.supabase
        .from("organization_load_day_athlete_overrides")
        .update({
          load_level: data.load_level,
          note: data.note ?? null,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      overrideId = existing.id;
    } else {
      const { data: inserted, error } = await context.supabase
        .from("organization_load_day_athlete_overrides")
        .insert({
          organization_id: data.orgId,
          user_id: context.userId,
          date: data.date,
          load_level: data.load_level,
          note: data.note ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      overrideId = (inserted as { id: string }).id;
    }

    // Fire-and-forget: Recalc nur für diesen Athleten.
    try {
      const { runNutritionRecalc } = await import("./nutrition-plan-recalc-core.server");
      await runNutritionRecalc(context.supabase, {
        callerId: context.userId,
        orgId: data.orgId,
        userId: context.userId,
        dates: [data.date],
        reason: "manual_override",
      });
    } catch (e) {
      console.error("[upsertAthleteLoadOverride] recalc failed:", e);
    }
    return { id: overrideId };
  });

export const clearAthleteLoadOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { orgId: string; date: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("organization_load_day_athlete_overrides")
      .delete()
      .eq("organization_id", data.orgId)
      .eq("user_id", context.userId)
      .eq("date", data.date);
    if (error) throw new Error(error.message);
    try {
      const { runNutritionRecalc } = await import("./nutrition-plan-recalc-core.server");
      await runNutritionRecalc(context.supabase, {
        callerId: context.userId,
        orgId: data.orgId,
        userId: context.userId,
        dates: [data.date],
        reason: "manual_override",
      });
    } catch (e) {
      console.error("[clearAthleteLoadOverride] recalc failed:", e);
    }
    return { ok: true };
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
