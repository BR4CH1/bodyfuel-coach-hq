/**
 * Shared core for AI Smart-Trainingsplan generation.
 *
 * Phase-3-Refactor: Wochenstruktur, Fokus-Rotation, Movement-Slots und
 * Volumen (Sätze/Reps/Pause) werden DETERMINISTISCH in TypeScript berechnet
 * (siehe `training-engine/week-structure.ts` + `movement-framework.ts`).
 * Das LLM darf nur noch pro Slot EINE konkrete Übungs-VARIANTE (Gerätewahl +
 * Name) sowie Warm-up-/Cool-down-Vorschläge liefern.
 *
 * File ends in `.server.ts` so it is stripped from client bundles.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildWeekPlan,
  renderWeekPlanForPrompt,
  WEEKDAY_ORDER,
  type WeekdayKey,
  type WeekPlan,
  type PlannedDay,
} from "./training-engine/week-structure";
import type { Experience, MovementSlot } from "./training-engine/movement-framework";

type ExerciseCategory =
  | "barbell" | "dumbbell" | "machine" | "cardio"
  | "core" | "bodyweight" | "cable";

type LlmEx = {
  name: string;
  category?: ExerciseCategory;
  target_weights?: string | null;
  notes?: string | null;
};

type LlmSlotEx = LlmEx & { target_sets?: number; target_reps?: string; rest_seconds?: number };

type LlmSession = {
  week: number;
  weekday: WeekdayKey;
  role?: string;
  warmup?: LlmEx[];
  slots?: Record<string, LlmSlotEx>;
  cooldown?: LlmEx[];
  sport?: LlmEx;
  mobility?: LlmEx[];
};

export type GenerateOpts = {
  target: string;
  uploadedBy?: string | null;
  title?: string;
  startMode?: "today" | "next_week";
  apiKey: string;
  weeks?: number;
};

export async function generateTrainingPlanCore(
  supabase: SupabaseClient,
  opts: GenerateOpts,
) {
  const { target, uploadedBy = null, title, startMode = "today", apiKey } = opts;
  const requestedWeeks = Math.max(1, Math.min(12, Math.round(opts.weeks ?? 4)));

  const since60 = new Date(Date.now() - 60 * 86400000).toISOString();
  const sinceDate60 = since60.slice(0, 10);

  const [
    { data: smartProfile },
    { data: clientProfile },
    { data: latestWeight },
    { data: lastCheck },
    { data: priorPlans },
    { data: targets },
    { data: recentSets },
    { data: recentChecks },
    { data: weightHistory },
  ] = await Promise.all([
    supabase.from("smart_nutrition_profile")
      .select("training_weekdays, training_session_minutes")
      .eq("user_id", target).maybeSingle(),
    supabase.from("profiles")
      .select(
        "display_name, height_cm, birthdate, gender, training_goal, coaching_goal, " +
        "sport, injuries, training_experience, activity_level, goal_weight_kg, " +
        "sport_position, sport_level, team_sport, match_days_per_week, practice_days_per_week, " +
        "sport_weekdays, season_phase, class_types, class_days_per_week, mobility_frequency, mobility_focus, cardio_outside_gym",
      )
      .eq("id", target).maybeSingle(),
    supabase.from("body_measurements")
      .select("weight_kg, body_fat_pct, measured_at")
      .eq("user_id", target).not("weight_kg", "is", null)
      .order("measured_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("strength_checks")
      .select("id, performed_at, bodyweight_kg, score_total, score_lower, score_push, score_pull, score_core")
      .eq("user_id", target).eq("status", "completed")
      .order("performed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("nutrition_plans")
      .select("id, training_days(week_number, training_exercises(name))")
      .eq("client_id", target).eq("plan_type", "training")
      .order("created_at", { ascending: false }).limit(3),
    supabase.from("nutrition_targets")
      .select("kcal, protein_g, carbs_g, fat_g, kcal_rest, protein_g_rest, carbs_g_rest, fat_g_rest")
      .eq("user_id", target).maybeSingle(),
    supabase.from("training_set_logs")
      .select("exercise_id, weight_kg, reps, performed_at")
      .eq("client_id", target)
      .gte("performed_at", since60)
      .order("performed_at", { ascending: false }).limit(400),
    supabase.from("daily_checks")
      .select("check_date, points, tasks")
      .eq("user_id", target)
      .gte("check_date", sinceDate60)
      .order("check_date", { ascending: false }).limit(60),
    supabase.from("body_measurements")
      .select("weight_kg, measured_at")
      .eq("user_id", target).not("weight_kg", "is", null)
      .gte("measured_at", since60)
      .order("measured_at", { ascending: true }),
  ]);

  const checkResults =
    lastCheck?.id
      ? (await supabase.from("strength_check_results")
          .select("test_key, weight_kg, reps, duration_seconds, e1rm_kg")
          .eq("check_id", lastCheck.id)).data ?? []
      : [];

  const e1rm: Record<string, number | null> = {
    leg_press: null, leg_curl: null, chest_press: null,
    shoulder_press: null, lat_pulldown: null, cable_row: null,
  };
  let plankSeconds: number | null = null;
  for (const r of checkResults as any[]) {
    if (r.test_key === "plank") plankSeconds = r.duration_seconds ?? null;
    else if (r.test_key in e1rm) e1rm[r.test_key] = r.e1rm_kg ? Number(r.e1rm_kg) : null;
  }

  const bw = (lastCheck as any)?.bodyweight_kg ?? (latestWeight as any)?.weight_kg ?? null;
  const bfPct = (latestWeight as any)?.body_fat_pct ?? null;

  const w8 = (v: number | null) => (v ? Math.round((v * 0.75) / 2.5) * 2.5 : null);
  const startWeights: StartWeights = {
    bench_press_kg: w8(e1rm.chest_press),
    shoulder_press_kg: w8(e1rm.shoulder_press),
    squat_kg: e1rm.leg_press ? Math.round((e1rm.leg_press * 0.35) / 2.5) * 2.5 : null,
    deadlift_kg: e1rm.leg_press ? Math.round((e1rm.leg_press * 0.45) / 2.5) * 2.5 : null,
    lat_pulldown_kg: w8(e1rm.lat_pulldown),
    row_kg: w8(e1rm.cable_row),
    leg_press_kg: w8(e1rm.leg_press),
    leg_curl_kg: w8(e1rm.leg_curl),
  };

  const trainingDayKeys: WeekdayKey[] =
    ((smartProfile as any)?.training_weekdays?.length
      ? (smartProfile as any).training_weekdays
      : ["monday", "wednesday", "friday"]) as WeekdayKey[];

  const start = (() => {
    const d = new Date();
    if (startMode === "next_week") {
      const day = d.getDay();
      const delta = day === 1 ? 7 : ((1 - day + 7) % 7) || 7;
      d.setDate(d.getDate() + delta);
    }
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const totalWeeks = requestedWeeks;
  const planSpan = totalWeeks * 7;

  const priorNames = new Set<string>();
  for (const p of (priorPlans as any[]) ?? []) {
    for (const d of p?.training_days ?? []) {
      for (const ex of d?.training_exercises ?? []) {
        if (ex?.name) priorNames.add(String(ex.name).trim());
      }
    }
  }
  const priorList = Array.from(priorNames).slice(0, 120);

  const exNameById = new Map<string, string>();
  for (const p of (priorPlans as any[]) ?? []) {
    for (const d of p?.training_days ?? []) {
      for (const ex of d?.training_exercises ?? []) {
        if (ex?.id && ex?.name) exNameById.set(String(ex.id), String(ex.name));
      }
    }
  }
  const equipCounts: Record<string, number> = {
    maschine: 0, multipresse: 0, kurzhantel: 0, langhantel: 0, kabel: 0, bodyweight: 0,
  };
  for (const s of (recentSets as any[]) ?? []) {
    const nm = exNameById.get(String(s.exercise_id))?.toLowerCase() ?? "";
    if (!nm) continue;
    if (/maschine|machine/.test(nm)) equipCounts.maschine++;
    else if (/multi|smith/.test(nm)) equipCounts.multipresse++;
    else if (/kurzhantel|dumbbell|\bkh\b|\bdb\b/.test(nm)) equipCounts.kurzhantel++;
    else if (/langhantel|barbell|\blh\b/.test(nm)) equipCounts.langhantel++;
    else if (/kabel|seilzug|cable/.test(nm)) equipCounts.kabel++;
    else equipCounts.bodyweight++;
  }

  const sessionDates = new Set<string>();
  for (const s of (recentSets as any[]) ?? []) {
    sessionDates.add(String(s.performed_at).slice(0, 10));
  }
  const sessionsLast30 = (() => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    let n = 0;
    sessionDates.forEach((d) => { if (d >= cutoff) n++; });
    return n;
  })();
  const checksLast30 = ((recentChecks as any[]) ?? []).slice(0, 30).length;
  const perfectDays30 = ((recentChecks as any[]) ?? []).filter((c) => (c.points ?? 0) >= 15).length;

  let weightTrendKg: number | null = null;
  if ((weightHistory as any[])?.length && (weightHistory as any[]).length >= 2) {
    const arr = weightHistory as any[];
    weightTrendKg = +(Number(arr[arr.length - 1].weight_kg) - Number(arr[0].weight_kg)).toFixed(1);
  }

  const cp: any = clientProfile ?? {};
  const ageYears = cp.birthdate
    ? Math.floor((Date.now() - new Date(cp.birthdate).getTime()) / (365.25 * 86400000))
    : null;
  const sessionMinutes = (smartProfile as any)?.training_session_minutes ?? 60;
  const trainingGoal: string = cp.training_goal ?? "performance";
  const experienceRaw: string = cp.training_experience ?? (sessionsLast30 >= 8 ? "intermediate" : "beginner");
  const experience: Experience =
    experienceRaw === "advanced" ? "advanced"
    : experienceRaw === "beginner" ? "beginner"
    : "intermediate";

  const sportWeekdays: WeekdayKey[] = (Array.isArray(cp.sport_weekdays) ? cp.sport_weekdays : []) as WeekdayKey[];

  // ============================================================
  //   DETERMINISTISCHE WOCHENSTRUKTUR — Single Source of Truth
  // ============================================================
  const weekPlans: WeekPlan[] = buildWeekPlan({
    startDate: start,
    weeks: totalWeeks,
    trainingWeekdays: trainingDayKeys,
    sportWeekdays,
    experience,
  });
  const weekPlanBlock = renderWeekPlanForPrompt(weekPlans);

  const goalLabel: Record<string, string> = {
    muscle_gain: "Muskelaufbau", lean_bulk: "lean bulk / Muskelaufbau",
    bulk: "Massephase", weight_loss: "Fettabbau", fat_loss: "Fettabbau",
    aggressive_cut: "aggressiver Cut (Muskel halten)",
    recomp: "Recomposition", recomposition: "Recomposition",
    maintain: "Halten", maintenance: "Halten",
    strength: "Maximalkraft", performance: "Leistung / Athletik",
    health: "Gesundheit & Beweglichkeit",
  };

  const equipBlock = `\n🛠️ GERÄTE-PRÄFERENZ (aus den letzten 60 Tagen)
- Maschine: ${equipCounts.maschine} · Multipresse: ${equipCounts.multipresse} · Kurzhantel: ${equipCounts.kurzhantel} · Langhantel: ${equipCounts.langhantel} · Kabel: ${equipCounts.kabel}
→ Wähle die Geräte-VARIANTE jedes Slots entsprechend dieser Daten. Bereits genutzte Varianten für PR-Kontinuität bevorzugen.`;

  const injuryBlock = cp.injuries
    ? `\n⚠️ VERLETZUNGEN: ${cp.injuries} — passe die gewählte Variante an (keine Überkopf-LH bei Schulterproblemen, keine schwere Kniebeuge bei Knieproblemen usw.).`
    : "";

  const targetsBlock = targets
    ? `\n🍽️ ERNÄHRUNGSZIELE — Trainingstag ${(targets as any).kcal} kcal / P${(targets as any).protein_g}g · Restday ${(targets as any).kcal_rest} kcal.`
    : "";

  const adherenceBlock = `\n📊 ADHÄRENZ letzte 30 Tage — Trainings: ${sessionsLast30} · Daily-Checks: ${checksLast30} · perfekte Tage: ${perfectDays30}${weightTrendKg !== null ? ` · Gewichtstrend: ${weightTrendKg > 0 ? "+" : ""}${weightTrendKg} kg` : ""}`;

  const startWeightsBlock = `\n💪 STARTGEWICHTE (Woche 1, RPE 7, e1RM×0,75) — HARTE OBERGRENZE, wird automatisch gekappt:
- Bankdrücken/Brustpresse: MAX ${startWeights.bench_press_kg ?? "?"} kg
- Schulterdrücken: MAX ${startWeights.shoulder_press_kg ?? "?"} kg
- Kniebeuge: MAX ${startWeights.squat_kg ?? "?"} kg · Kreuzheben: MAX ${startWeights.deadlift_kg ?? "?"} kg
- Latzug: MAX ${startWeights.lat_pulldown_kg ?? "?"} kg · Rudern: MAX ${startWeights.row_kg ?? "?"} kg
- Beinpresse: MAX ${startWeights.leg_press_kg ?? "?"} kg · Beinbeuger: MAX ${startWeights.leg_curl_kg ?? "?"} kg
- Plank: ${plankSeconds ? plankSeconds + "s" : "unbekannt"}
Kurzhantel-Übungen: Gewicht PRO SEITE. Langhantel/Maschine: GESAMTGEWICHT. Isolationen konservativ.`;

  const prompt = `Du bekommst eine FERTIGE, deterministische Wochenstruktur mit Slots.
Deine EINZIGE Aufgabe: pro Slot EINE konkrete Übungs-VARIANTE (Name + Kategorie + Startgewichte + 1-Satz-Ausführungshinweis) wählen. Sätze/Reps/Pausen sind FEST und dürfen NICHT geändert werden.

👤 KUNDE
- Ziel: ${goalLabel[trainingGoal] ?? trainingGoal}${cp.coaching_goal ? ` · Eigenangabe: "${cp.coaching_goal}"` : ""}
${bw ? `- Körpergewicht: ${bw} kg` : ""}${bfPct ? ` · KFA: ${bfPct}%` : ""}${cp.height_cm ? ` · Größe: ${cp.height_cm} cm` : ""}${ageYears ? ` · Alter: ${ageYears} J.` : ""}${cp.gender ? ` · ${cp.gender}` : ""}
- Erfahrung: ${experience} · Sessionlänge: ${sessionMinutes} Min
${cp.sport ? `- Sportart: ${cp.sport}${cp.sport_position ? ` (${cp.sport_position})` : ""}` : "- Kein Sport angegeben — keine sportartspezifischen Übungen."}
${injuryBlock}${targetsBlock}${adherenceBlock}${equipBlock}${startWeightsBlock}

📐 WOCHENSTRUKTUR (VERBINDLICH)
${weekPlanBlock}

📤 ANTWORT — NUR JSON, keine Erklärung:
{
  "sessions": [
    {
      "week": 1,
      "weekday": "monday",
      "warmup": [
        { "name": "Warm-up: Rudergerät locker", "category": "cardio", "notes": "5 Min lockeres Rudern, Puls auf ~120" },
        { "name": "Warm-up: Band Pull-Apart", "category": "bodyweight", "notes": "Theraband auf Brusthöhe, Schulterblätter zusammen" }
      ],
      "slots": {
        "push_main": { "name": "Bankdrücken Langhantel", "category": "barbell", "target_weights": "60,60,60,60", "notes": "Schulterblätter zusammen, Stange zur Brustmitte, Tempo 3-1-1" },
        "push_vertical": { "name": "...", "category": "...", "target_weights": "...", "notes": "..." }
      },
      "cooldown": [
        { "name": "Cool-down: Brustdehnung Türrahmen", "category": "bodyweight", "notes": "Arm 90° an Türrahmen, Oberkörper nach vorn drehen, 30s/Seite" }
      ]
    },
    { "week": 1, "weekday": "tuesday", "role": "sport",
      "sport": { "name": "Mannschaftstraining", "category": "cardio", "notes": "60–90 Min, RPE 6–8" } },
    { "week": 1, "weekday": "wednesday", "role": "recovery",
      "mobility": [
        { "name": "Foam Roll Beine/Rücken", "category": "bodyweight", "notes": "je Bereich 60s, langsam" },
        { "name": "90/90 Hüftrotation", "category": "core", "notes": "8/Seite, kontrolliert" },
        { "name": "Cat-Cow", "category": "core", "notes": "10 Wdh, ruhig atmen" }
      ] },
    { "week": 1, "weekday": "thursday", "role": "rest" }
  ]
}

REGELN:
- Genau EIN Eintrag pro slot_id aus der Wochenstruktur oben. slot_id als Objekt-Key nutzen.
- target_weights: kommaseparierte Zahlen (nur working sets), passend zur Satzzahl des Slots. Bei Bodyweight/Isolation ohne Startwert: null.
- Kategorie ∈ ["barbell","dumbbell","machine","cable","cardio","core","bodyweight"].
- Namens-Präfix "Warm-up: …" / "Cool-down: …" verpflichtend.
- Sport-Tage: NUR das "sport"-Feld. Recovery-Tage: 3 Mobility-Einträge. Rest-Tage: leer lassen (kein Eintrag).
- Notes: IMMER 1 Satz Ausführung in einfachem Deutsch, keine Fachjargon-Abkürzungen.
- Sportartspezifische Übungen NUR wenn Sportart oben genannt — sonst niemals.
- NIEMALS das Wort "Akzessoires" verwenden.`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      max_tokens: 32000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (aiRes.status === 429) throw new Error("Rate-Limit erreicht — gleich nochmal versuchen.");
  if (aiRes.status === 402) throw new Error("Guthaben aufgebraucht — bitte aufladen.");
  if (!aiRes.ok) {
    const txt = await aiRes.text();
    throw new Error(`Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
  }
  const aiJson = await aiRes.json();
  const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
  let parsed: { sessions?: LlmSession[] } = {};
  try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { throw new Error("Antwort konnte nicht gelesen werden."); }

  const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
  const sessionKey = (w: number, wd: WeekdayKey) => `${w}::${wd}`;
  const sessionMap = new Map<string, LlmSession>();
  for (const s of sessions) {
    if (typeof s?.week === "number" && s?.weekday) {
      sessionMap.set(sessionKey(s.week, s.weekday as WeekdayKey), s);
    }
  }

  // ============================================================
  //   Plan anlegen
  // ============================================================
  await supabase
    .from("nutrition_plans")
    .update({ status: "archived" } as any)
    .eq("client_id", target)
    .eq("plan_type", "training")
    .in("status", ["draft", "approved", "published"]);

  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(start);
  end.setDate(end.getDate() + planSpan - 1);

  const { data: planRow, error: planErr } = await supabase
    .from("nutrition_plans")
    .insert({
      client_id: target,
      title:
        title?.trim() ||
        `Smart-Trainingsplan ${totalWeeks} Wochen — ${new Date().toLocaleDateString("de-DE")}`,
      plan_type: "training",
      is_active: false,
      status: "draft",
      generated_by: "ai_auto",
      source: "smart_ai",
      uploaded_by: uploadedBy,
      file_path: `ai-generated/${target}/training-${Date.now()}.json`,
      file_name: "ai-training.json",
      scheduled_start_date: isoDate(start),
      scheduled_end_date: isoDate(end),
      weeks_count: totalWeeks,
      last_auto_generated_at: new Date().toISOString(),
    } as any)
    .select("id").single();
  if (planErr || !planRow) throw new Error(planErr?.message ?? "Plan konnte nicht angelegt werden");

  // ============================================================
  //   Tage & Übungen einfügen — WEEKPLAN ist Source of Truth
  // ============================================================
  let totalEx = 0;
  let totalDays = 0;

  for (const wp of weekPlans) {
    for (let i = 0; i < wp.days.length; i++) {
      const day: PlannedDay = wp.days[i];
      const session = sessionMap.get(sessionKey(wp.week_number, day.weekday));

      const dayName = day.focus_label.slice(0, 120);

      const { data: dayRow, error: dayErr } = await supabase
        .from("training_days")
        .insert({
          plan_id: planRow.id,
          name: dayName,
          sort_order: (wp.week_number - 1) * 7 + i,
          week_number: wp.week_number,
          day_date: day.day_date,
        } as any)
        .select("id").single();
      if (dayErr || !dayRow) continue;
      totalDays++;

      const rows = buildExerciseRowsForDay(day, session, wp.week_number, startWeights, dayRow.id);
      totalEx += rows.length;
      if (rows.length) {
        await supabase.from("training_exercises").insert(rows as any);
      }
    }
  }

  if (totalEx === 0) {
    await supabase.from("nutrition_plans").delete().eq("id", planRow.id);
    throw new Error("Keine Übungen geliefert (Antwort vermutlich abgeschnitten). Bitte erneut versuchen.");
  }

  return {
    ok: true,
    plan_id: planRow.id,
    status: "draft",
    weeks: weekPlans.length,
    days: totalDays,
    exercises: totalEx,
    scheduled_start_date: isoDate(start),
    scheduled_end_date: isoDate(end),
  };
}

// ============================================================
//   Zeilen für einen Tag aus WeekPlan + LLM-Session bauen
// ============================================================
type ExerciseRow = {
  day_id: string;
  name: string;
  category: string | null;
  set_type: "warmup" | "working" | "cooldown";
  target_sets: number | null;
  target_reps: string | null;
  target_weights: string | null;
  rest_seconds: number | null;
  notes: string | null;
  sort_order: number;
};

function buildExerciseRowsForDay(
  day: PlannedDay,
  session: LlmSession | undefined,
  weekNumber: number,
  startWeights: StartWeights,
  dayId: string,
): ExerciseRow[] {
  const rows: ExerciseRow[] = [];
  let order = 0;

  const push = (r: Omit<ExerciseRow, "day_id" | "sort_order">) => {
    if (!r.name) return;
    rows.push({ ...r, day_id: dayId, sort_order: order++ });
  };

  // ---- Sport-Tag ----
  if (day.role === "sport") {
    const s = session?.sport;
    push({
      name: (s?.name ? stripAkzessoires(s.name) : "Mannschaftstraining").slice(0, 200),
      category: validCategory(s?.category) ?? "cardio",
      set_type: "working",
      target_sets: 1,
      target_reps: "60–90 Min",
      target_weights: null,
      rest_seconds: null,
      notes: s?.notes ? stripAkzessoires(s.notes).slice(0, 500) : "Team-/Spielbelastung, RPE 6–8.",
    });
    return rows;
  }

  // ---- Recovery-Tag ----
  if (day.role === "recovery") {
    const mob = session?.mobility ?? [];
    const fallback: LlmEx[] = [
      { name: "Foam Roll Beine & Rücken", category: "bodyweight", notes: "Je Bereich 60s langsam rollen." },
      { name: "90/90 Hüftrotation", category: "core", notes: "Sitzend, kontrolliert rotieren, 8/Seite." },
      { name: "Cat-Cow", category: "core", notes: "Mit Atmung koppeln, 10 Wdh." },
    ];
    const items = mob.length ? mob : fallback;
    for (const m of items.slice(0, 5)) {
      push({
        name: stripAkzessoires(String(m.name ?? "")).slice(0, 200),
        category: validCategory(m.category) ?? "bodyweight",
        set_type: "warmup",
        target_sets: 2,
        target_reps: "8–10",
        target_weights: null,
        rest_seconds: 30,
        notes: m.notes ? stripAkzessoires(String(m.notes)).slice(0, 500) : null,
      });
    }
    return rows;
  }

  // ---- Rest-Tag ----
  if (day.role === "rest") {
    push({
      name: "Rest — frei",
      category: "bodyweight",
      set_type: "warmup",
      target_sets: 1,
      target_reps: "—",
      target_weights: null,
      rest_seconds: null,
      notes: "Vollständige Erholung — Schlaf & Ernährung priorisieren.",
    });
    return rows;
  }

  // ---- Gym / Gym-Light ----
  // Warm-up
  const wus = session?.warmup ?? [];
  const wuFallback: LlmEx[] = [
    { name: "Warm-up: Rudergerät locker", category: "cardio", notes: "5 Min locker, Puls auf ~120." },
    { name: "Warm-up: Dynamische Aktivierung", category: "bodyweight", notes: "Passend zum Tagesfokus." },
  ];
  for (const w of (wus.length ? wus : wuFallback).slice(0, 3)) {
    push({
      name: ensurePrefix(w.name, "Warm-up: ").slice(0, 200),
      category: validCategory(w.category) ?? "bodyweight",
      set_type: "warmup",
      target_sets: 1,
      target_reps: "5 Min",
      target_weights: null,
      rest_seconds: 30,
      notes: w.notes ? stripAkzessoires(String(w.notes)).slice(0, 500) : null,
    });
  }

  // Working Slots — deterministisch aus day.slots
  const llmSlots = session?.slots ?? {};
  for (const slot of day.slots) {
    const chosen: LlmSlotEx | undefined = llmSlots[slot.slot_id];
    const name = chosen?.name?.trim() || fallbackNameForSlot(slot);
    const clampedWeights = clampWeightsForExercise(
      name,
      chosen?.target_weights ?? null,
      weekNumber,
      startWeights,
    );
    push({
      name: stripAkzessoires(name).slice(0, 200),
      category: validCategory(chosen?.category) ?? guessCategoryFromName(name),
      set_type: "working",
      target_sets: slot.sets,
      target_reps: slot.rep_range,
      target_weights: clampedWeights,
      rest_seconds: slot.rest_seconds,
      notes: chosen?.notes ? stripAkzessoires(String(chosen.notes)).slice(0, 500) : slot.hint,
    });
  }

  // Cool-down
  const cds = session?.cooldown ?? [];
  const cdFallback: LlmEx[] = [
    { name: "Cool-down: Statisches Dehnen", category: "bodyweight", notes: "Trainierte Muskelgruppen je 30s dehnen." },
  ];
  for (const c of (cds.length ? cds : cdFallback).slice(0, 2)) {
    push({
      name: ensurePrefix(c.name, "Cool-down: ").slice(0, 200),
      category: validCategory(c.category) ?? "bodyweight",
      set_type: "cooldown",
      target_sets: 2,
      target_reps: "30s",
      target_weights: null,
      rest_seconds: 30,
      notes: c.notes ? stripAkzessoires(String(c.notes)).slice(0, 500) : null,
    });
  }

  return rows;
}

function fallbackNameForSlot(slot: MovementSlot): string {
  return slot.hint.split("/")[0].trim() || slot.pattern;
}

function ensurePrefix(name: string | undefined, prefix: string): string {
  const n = String(name ?? "").trim();
  if (!n) return prefix.replace(/[: ]+$/, "");
  return n.toLowerCase().startsWith(prefix.trim().toLowerCase()) ? n : `${prefix}${n}`;
}

function guessCategoryFromName(name: string): string {
  const n = name.toLowerCase();
  if (/(langhantel|barbell|\blh\b)/.test(n)) return "barbell";
  if (/(kurzhantel|dumbbell|\bkh\b|\bdb\b)/.test(n)) return "dumbbell";
  if (/(kabel|seilzug|cable)/.test(n)) return "cable";
  if (/(maschine|machine|presse)/.test(n)) return "machine";
  if (/(plank|crunch|leg raise|core|dead bug|pallof)/.test(n)) return "core";
  if (/(cardio|rudergerät|crosstrainer|laufband|bike)/.test(n)) return "cardio";
  return "bodyweight";
}

// ============================================================
//   Helpers (unchanged)
// ============================================================
function stripAkzessoires(s: string): string {
  return s
    .replace(/akzessoires?/gi, "Zusatzübungen")
    .replace(/accessoires?/gi, "Zusatzübungen");
}

function validCategory(c: unknown): string | null {
  const allowed = ["barbell","dumbbell","machine","cardio","core","bodyweight","cable"];
  if (typeof c !== "string") return null;
  const v = c.toLowerCase().trim();
  return allowed.includes(v) ? v : null;
}

type StartWeights = {
  bench_press_kg: number | null;
  shoulder_press_kg: number | null;
  squat_kg: number | null;
  deadlift_kg: number | null;
  lat_pulldown_kg: number | null;
  row_kg: number | null;
  leg_press_kg: number | null;
  leg_curl_kg: number | null;
};

function detectStartKey(name: string): keyof StartWeights | null {
  const n = name.toLowerCase();
  if (/(brustpresse|bankdr(ü|u)ck|bench[- ]?press|chest[- ]?press|brustdr(ü|u)ck)/.test(n)) return "bench_press_kg";
  if (/(schulterpresse|schulterdr(ü|u)ck|shoulder[- ]?press|overhead[- ]?press|military[- ]?press)/.test(n)) return "shoulder_press_kg";
  if (/(kniebeuge|squat\b|back ?squat|front ?squat|hack[- ]?squat)/.test(n)) return "squat_kg";
  if (/(kreuzheb|deadlift|rdl|rom(a|á)nian)/.test(n)) return "deadlift_kg";
  if (/(latzug|lat[- ]?pulldown|pull[- ]?down)/.test(n)) return "lat_pulldown_kg";
  if (/(rudern|row\b|kabelruder|cable[- ]?row|seated[- ]?row|t[- ]?bar)/.test(n)) return "row_kg";
  if (/beinpresse|leg[- ]?press/.test(n)) return "leg_press_kg";
  if (/(beinbeuger|leg[- ]?curl|hamstring[- ]?curl)/.test(n)) return "leg_curl_kg";
  return null;
}

function weekCapFactor(weekNumber: number): number {
  switch (weekNumber) {
    case 1: return 1.0;
    case 2: return 1.08;
    case 3: return 1.15;
    case 4: return 1.0; // Deload
    default: return 1.15;
  }
}

function clampWeightsForExercise(
  name: string,
  raw: unknown,
  weekNumber: number,
  start: StartWeights,
): string | null {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str.length) return null;
  if (str.length > 120) return str.slice(0, 120);
  const key = detectStartKey(name);
  const baseline = key ? start[key] : null;
  if (!baseline || baseline <= 0) return str;
  const cap = Math.max(2.5, Math.round((baseline * weekCapFactor(weekNumber)) / 2.5) * 2.5);
  const tokens = str.split(/[,;]/).map((t) => t.trim());
  const nums: number[] = [];
  for (const t of tokens) {
    if (!/^-?\d+(?:[\.,]\d+)?$/.test(t)) return str;
    nums.push(parseFloat(t.replace(",", ".")));
  }
  const clamped = nums.map((n) => (n > cap ? cap : n));
  return clamped.map((n) => (Number.isInteger(n) ? String(n) : n.toFixed(1))).join(",");
}
