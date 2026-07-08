/**
 * Athleten-Trainings-Session-Generator.
 *
 * Erstellt pro Athlet und Tag eine individuelle, positions- und belastungsabhängige
 * Athletik-Session, ausgehend von einer Coach-Session mit erkanntem Athletikfokus.
 *
 * Server-only. Wird aus publishTeamTrainingWeek aufgerufen. Verwendet supabaseAdmin,
 * damit die Sync auch dann greift, wenn das Publish über einen Coach ohne direktes
 * INSERT-Recht auf `athlete_training_session` läuft (RLS-sicher: Admin-Client).
 */

import type { TrainingFocus } from "@/lib/training-focus-detection";
import { normalizePosition } from "@/lib/football-positions";
import { poolFor, scaleToDuration, type PoolExercise } from "./athlete-training-session-pool";

/** Liest die Position eines Athleten aus Profil (Priorität: bulls_profiles.position). */
async function loadAthletePosition(supabase: any, userId: string): Promise<string | null> {
  const [bulls, profile] = await Promise.all([
    supabase.from("bulls_profiles").select("position").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("football_position").eq("id", userId).maybeSingle(),
  ]);
  const raw =
    (bulls.data as any)?.position ??
    (profile.data as any)?.football_position ??
    null;
  return normalizePosition(raw);
}

/**
 * Für eine gegebene Woche + Team → generiert athlete_training_session-Zeilen für alle Athletensessions
 * (nur Sessions mit Fokus, der nicht football/none ist).
 *
 * Bestehende `status IN ('in_progress','completed','skipped')` Zeilen werden nicht überschrieben.
 * `scheduled` Zeilen werden ersetzt.
 */
export async function generateAthleteTrainingSessionsForWeek(params: {
  weekId: string;
  organizationId: string;
  teamId: string;
  memberIds: string[];
  weekStart: string; // ISO Mo
  weekEnd: string;   // ISO So
}): Promise<{ inserted: number; updated: number; kept: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Alle aktiven Sessions der Woche mit Fokus laden.
  const sessRes = await supabaseAdmin
    .from("org_team_training_week_session")
    .select("id, session_date, title, description, start_time, end_time, active, focus")
    .eq("week_id", params.weekId);
  const sessions = ((sessRes.data ?? []) as any[]).filter(
    (s) => s.active !== false && s.focus && s.focus !== "football" && s.focus !== "none",
  );
  if (!sessions.length || !params.memberIds.length) {
    return { inserted: 0, updated: 0, kept: 0 };
  }

  // 2) Positionen für alle Members einmalig laden.
  const positionsByUser = new Map<string, string | null>();
  await Promise.all(
    params.memberIds.map(async (uid) => {
      positionsByUser.set(uid, await loadAthletePosition(supabaseAdmin, uid));
    }),
  );

  // 3) Bestehende Zeilen im Wochen-Zeitraum vorladen, um Progress-geschützte Sessions nicht zu überschreiben.
  const existingRes = await supabaseAdmin
    .from("athlete_training_session")
    .select("id, user_id, source_week_session_id, status")
    .in(
      "source_week_session_id",
      sessions.map((s) => s.id),
    );
  const existing = new Map<string, { id: string; status: string }>();
  for (const r of (existingRes.data ?? []) as any[]) {
    existing.set(`${r.user_id}::${r.source_week_session_id}`, { id: r.id, status: r.status });
  }

  let inserted = 0;
  let updated = 0;
  let kept = 0;

  const rowsToInsert: any[] = [];
  const rowsToUpdate: Array<{ id: string; patch: any }> = [];

  for (const s of sessions) {
    const focus = s.focus as Exclude<TrainingFocus, "football" | "none">;
    const durationMin =
      s.start_time && s.end_time
        ? Math.max(15, Math.round(diffMinutes(s.start_time, s.end_time)))
        : 45;

    for (const uid of params.memberIds) {
      const positionCode = positionsByUser.get(uid) ?? null;
      const exercises = scaleToDuration(poolFor(focus, positionCode), durationMin);
      const key = `${uid}::${s.id}`;
      const prev = existing.get(key);

      const payload = {
        user_id: uid,
        organization_id: params.organizationId,
        team_id: params.teamId,
        session_date: s.session_date,
        source_week_session_id: s.id,
        focus,
        title: s.title || `${focus.toUpperCase()} Session`,
        position_code: positionCode,
        duration_min: durationMin,
        exercises: exercises as any,
      };

      if (!prev) {
        rowsToInsert.push(payload);
      } else if (prev.status === "scheduled") {
        rowsToUpdate.push({ id: prev.id, patch: payload });
      } else {
        // in_progress / completed / skipped bleiben unberührt
        kept++;
      }
    }
  }

  if (rowsToInsert.length) {
    const { error, count } = await supabaseAdmin
      .from("athlete_training_session")
      .insert(rowsToInsert, { count: "exact" });
    if (error) throw new Error(error.message);
    inserted = count ?? rowsToInsert.length;
  }
  for (const u of rowsToUpdate) {
    const { error } = await supabaseAdmin
      .from("athlete_training_session")
      .update(u.patch)
      .eq("id", u.id);
    if (error) throw new Error(error.message);
    updated++;
  }

  return { inserted, updated, kept };
}

function diffMinutes(startTime: string, endTime: string): number {
  const [h1, m1] = startTime.split(":").map((x) => parseInt(x, 10) || 0);
  const [h2, m2] = endTime.split(":").map((x) => parseInt(x, 10) || 0);
  const diff = h2 * 60 + m2 - (h1 * 60 + m1);
  return diff > 0 ? diff : 45;
}

export { POSITION_BIAS };

/** Baut eine Beispiel-Session für Coach-Vorschau (keine DB-Änderung). */
export function previewAthleteSession(
  focus: Exclude<TrainingFocus, "football" | "none">,
  positionCode: string,
  durationMin: number = 45,
): Exercise[] {
  return scaleToDuration(poolFor(focus, normalizePosition(positionCode)), durationMin);
}
