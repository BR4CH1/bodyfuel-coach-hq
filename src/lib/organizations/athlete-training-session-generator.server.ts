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
import { positionGroup, normalizePosition } from "@/lib/football-positions";

type Exercise = {
  id: string;
  name: string;
  category: string;
  sets: number | null;
  reps: string | null;
  duration_sec: number | null;
  notes?: string | null;
};

/* -------------------------------------------------------------------------- */
/* Position × Fokus → Übungspool                                              */
/* -------------------------------------------------------------------------- */

type PosGroup = "offense" | "defense" | "special" | "other";

// Positions-spezifische Schwerpunkte (Body-Region Bias) je Positionsgruppe.
const POSITION_BIAS: Record<PosGroup, string> = {
  offense: "Hüfte, Rumpf, Explosivität — Fokus auf schnelle Kraftentwicklung.",
  defense: "Reaktion, Rumpf, untere Extremität — Fokus auf Absorption & Antritt.",
  special: "Sprunggelenk, Wade, T-Spine — Fokus auf feine Kontrolle.",
  other: "Ganzkörper-Basis mit Fokus auf Rumpf und Hüftmobilität.",
};

// Spezifische Übungspools je Fokus + Positions-Code.
// Bewusst deterministisch — gleiche Woche/Position → gleiche Session.
function poolFor(focus: Exclude<TrainingFocus, "football" | "none">, positionCode: string | null): Exercise[] {
  const p = positionCode ?? "";
  const isOL = ["OL", "C", "G", "T", "LG", "RG", "LT", "RT", "OG", "OT"].includes(p);
  const isWR = ["WR", "SLOT", "SLOTWR"].includes(p);
  const isQB = p === "QB";
  const isRB = ["RB", "FB", "HB", "TB"].includes(p);
  const isDL = ["DL", "DE", "DT", "NT", "NG"].includes(p);
  const isLB = ["LB", "ILB", "OLB", "MLB", "WLB", "SLB", "ROLB", "LOLB"].includes(p);
  const isDB = ["DB", "CB", "NB", "S", "SS", "FS", "SAF", "NICKEL", "DIME"].includes(p);

  const mk = (name: string, sets: number, reps: string, dur: number | null = null, notes?: string): Exercise => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    name,
    category: focus,
    sets,
    reps,
    duration_sec: dur,
    notes: notes ?? null,
  });

  switch (focus) {
    case "mobility": {
      const base = [
        mk("World's Greatest Stretch", 2, "6/Seite"),
        mk("Adductor Rock Back", 2, "8"),
      ];
      if (isQB) {
        return [
          mk("Thoracic Rotation (Quadruped)", 3, "8/Seite"),
          mk("90/90 Hip Switch", 3, "8/Seite"),
          mk("Wall Slides (Shoulder)", 3, "10"),
          mk("Sleeper Stretch", 2, "30s", 30),
          ...base,
        ];
      }
      if (isOL) {
        return [
          mk("Deep Squat Hold (Goblet)", 3, "45s", 45),
          mk("Ankle Dorsiflexion Mobilisation", 3, "10/Seite"),
          mk("90/90 Hip Switch", 3, "8/Seite"),
          mk("Copenhagen Adductor Hold", 2, "20s", 20),
          ...base,
        ];
      }
      if (isWR || isDB) {
        return [
          mk("Hamstring Sweep", 3, "6/Seite"),
          mk("90/90 Hip Switch", 3, "8/Seite"),
          mk("Ankle Dorsiflexion Mobilisation", 3, "10/Seite"),
          mk("Piriformis Stretch", 2, "30s", 30),
          ...base,
        ];
      }
      if (isRB || isLB || isDL) {
        return [
          mk("90/90 Hip Switch", 3, "8/Seite"),
          mk("Thoracic Rotation (Quadruped)", 3, "8/Seite"),
          mk("Ankle Dorsiflexion Mobilisation", 3, "10/Seite"),
          mk("Cossack Squat", 2, "6/Seite"),
          ...base,
        ];
      }
      return [
        mk("90/90 Hip Switch", 3, "8/Seite"),
        mk("Thoracic Rotation (Quadruped)", 3, "8/Seite"),
        mk("Ankle Dorsiflexion Mobilisation", 3, "10/Seite"),
        ...base,
      ];
    }
    case "strength": {
      if (isOL || isDL) {
        return [
          mk("Trap Bar Deadlift", 4, "5"),
          mk("Back Squat", 3, "5"),
          mk("Bench Press", 3, "5"),
          mk("Barbell Row", 3, "8"),
          mk("Farmer Carry", 3, "30m"),
        ];
      }
      if (isQB) {
        return [
          mk("Landmine Press", 4, "6/Seite"),
          mk("Cable Anti-Rotation Press", 3, "10/Seite"),
          mk("Front Squat", 3, "5"),
          mk("Single-Leg RDL", 3, "8/Seite"),
          mk("Half-Kneeling Med Ball Rotational Throw", 3, "5/Seite"),
        ];
      }
      if (isWR || isDB) {
        return [
          mk("Trap Bar Deadlift", 4, "3"),
          mk("Bulgarian Split Squat", 3, "6/Seite"),
          mk("Nordic Hamstring Curl", 3, "6"),
          mk("Pull-Up", 3, "AMRAP"),
          mk("Med Ball Slam", 3, "8"),
        ];
      }
      if (isRB || isLB) {
        return [
          mk("Back Squat", 4, "5"),
          mk("Hip Thrust", 4, "6"),
          mk("Weighted Chin-Up", 3, "6"),
          mk("Landmine Rotational Press", 3, "8/Seite"),
          mk("Suitcase Carry", 3, "30m"),
        ];
      }
      return [
        mk("Trap Bar Deadlift", 4, "5"),
        mk("Bench Press", 3, "8"),
        mk("Bulgarian Split Squat", 3, "8/Seite"),
        mk("Pull-Up", 3, "AMRAP"),
      ];
    }
    case "speed": {
      const base = [
        mk("A-Skips", 3, "20m", null, "Frequenz + Kontakt"),
        mk("Wall Drill (Single Response)", 3, "5/Seite"),
      ];
      if (isWR || isDB || isRB) {
        return [
          ...base,
          mk("10m Sprint", 6, "10m", null, "Volle Erholung"),
          mk("20m Flying Sprint", 4, "20m", null, "Aufbau + max. 20m"),
          mk("Resisted Sled Push (leicht)", 4, "15m"),
        ];
      }
      if (isQB || isLB) {
        return [
          ...base,
          mk("10m Sprint", 5, "10m"),
          mk("Broad Jump", 4, "3"),
          mk("Med Ball Chest Pass Start", 4, "5"),
        ];
      }
      return [
        ...base,
        mk("10m Sprint", 5, "10m"),
        mk("Bounds", 3, "4/Seite"),
      ];
    }
    case "agility": {
      if (isWR || isDB || isRB || isLB) {
        return [
          mk("Pro Agility (5-10-5)", 6, "1x"),
          mk("3-Cone L-Drill", 4, "1x"),
          mk("Reactive Mirror Drill", 4, "10s", 10),
          mk("Lateral Bound to Stick", 3, "5/Seite"),
        ];
      }
      return [
        mk("Pro Agility (5-10-5)", 5, "1x"),
        mk("T-Drill", 4, "1x"),
        mk("Lateral Shuffle", 3, "15m"),
      ];
    }
    case "conditioning": {
      if (isOL || isDL) {
        return [
          mk("Assault Bike Intervals", 6, "30s on / 60s off", 30),
          mk("Sled Push", 6, "20m"),
        ];
      }
      if (isWR || isDB || isRB || isLB) {
        return [
          mk("Gassers (2×53m)", 8, "1x"),
          mk("Tempo Runs (100m ~70%)", 8, "100m"),
        ];
      }
      return [
        mk("Assault Bike Intervals", 6, "30s on / 60s off", 30),
        mk("Tempo Runs (100m ~70%)", 6, "100m"),
      ];
    }
    case "recovery": {
      return [
        mk("Zone 2 Bike / Walk", 1, "15 Min", 900),
        mk("Foam Roll Ganzkörper", 1, "8 Min", 480),
        mk("Diaphragmatic Breathing", 3, "2 Min", 120),
        mk("Static Stretch (Hüfte, Brust, Waden)", 1, "8 Min", 480),
      ];
    }
  }
}

/**
 * Skaliert eine Übungsliste auf eine Zieldauer (Minuten). Sehr grob:
 * default 3.5min pro Übung (Ausführung + Pause). Bei knapper Zeit werden Sätze reduziert.
 */
function scaleToDuration(exercises: Exercise[], durationMin: number | null): Exercise[] {
  if (!durationMin || durationMin <= 0) return exercises;
  const perExercise = 3.5;
  const budget = Math.max(3, Math.floor(durationMin / perExercise));
  if (exercises.length <= budget) return exercises;
  return exercises.slice(0, budget);
}

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
