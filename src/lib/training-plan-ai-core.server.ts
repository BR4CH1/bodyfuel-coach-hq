/**
 * Shared core for AI Smart-Trainingsplan generation.
 * Used by both the user-facing server function (with the user's
 * supabase client) and the cron route (with supabaseAdmin).
 * File ends in `.server.ts` so it is stripped from client bundles.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type ExerciseCategory =
  | "barbell" | "dumbbell" | "machine" | "cardio"
  | "core" | "bodyweight" | "cable";

type GenEx = {
  name: string;
  category?: ExerciseCategory;
  target_sets?: number;
  target_reps?: string;
  target_weights?: string | null;
  rest_seconds?: number | null;
  notes?: string | null;
};
type GenDay = { name: string; focus?: string; exercises: GenEx[] };
type GenWeek = { week_number: number; focus?: string; days: GenDay[] };

export type GenerateOpts = {
  target: string;
  uploadedBy?: string | null;
  title?: string;
  startMode?: "today" | "next_week";
  apiKey: string;
};

export async function generateTrainingPlanCore(
  supabase: SupabaseClient,
  opts: GenerateOpts,
) {
  const { target, uploadedBy = null, title, startMode = "today", apiKey } = opts;

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
        "sport, injuries, training_experience, activity_level, goal_weight_kg",
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
  const startWeights = {
    bench_press_kg: w8(e1rm.chest_press),
    shoulder_press_kg: w8(e1rm.shoulder_press),
    squat_kg: e1rm.leg_press ? Math.round((e1rm.leg_press * 0.35) / 2.5) * 2.5 : null,
    deadlift_kg: e1rm.leg_press ? Math.round((e1rm.leg_press * 0.45) / 2.5) * 2.5 : null,
    lat_pulldown_kg: w8(e1rm.lat_pulldown),
    row_kg: w8(e1rm.cable_row),
    leg_press_kg: w8(e1rm.leg_press),
    leg_curl_kg: w8(e1rm.leg_curl),
  };

  const trainingDayKeys: string[] =
    (smartProfile as any)?.training_weekdays?.length
      ? (smartProfile as any).training_weekdays
      : ["monday", "wednesday", "friday"];
  const numDays = Math.max(2, Math.min(6, trainingDayKeys.length));

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
  const totalWeeks = 4;
  const planSpan = totalWeeks * 7;

  const priorNames = new Set<string>();
  for (const p of (priorPlans as any[]) ?? []) {
    for (const d of p?.training_days ?? []) {
      for (const ex of d?.training_exercises ?? []) {
        if (ex?.name) priorNames.add(String(ex.name).trim());
      }
    }
  }
  const priorList = Array.from(priorNames).slice(0, 80);

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
  const experience: string = cp.training_experience ?? (sessionsLast30 >= 8 ? "intermediate" : "beginner");

  const goalLabel: Record<string, string> = {
    muscle_gain: "Muskelaufbau", lean_bulk: "lean bulk / Muskelaufbau",
    bulk: "Massephase", weight_loss: "Fettabbau", fat_loss: "Fettabbau",
    aggressive_cut: "aggressiver Cut (Muskel halten)",
    recomp: "Recomposition", recomposition: "Recomposition",
    maintain: "Halten", maintenance: "Halten",
    strength: "Maximalkraft", performance: "Leistung / Athletik",
    health: "Gesundheit & Beweglichkeit",
  };

  const splitHint = (() => {
    if (experience === "beginner")
      return numDays <= 2 ? "Ganzkörper A / B"
        : numDays === 3 ? "Ganzkörper A / B / C"
        : "Oberkörper / Unterkörper-Splits (Anfängergerecht)";
    if (experience === "advanced")
      return numDays === 3 ? "Push / Pull / Beine (klassisch)"
        : numDays === 4 ? "Oberkörper / Unterkörper / Push / Pull"
        : numDays === 5 ? "Push / Pull / Beine / Oberkörper-Schwächen / Unterkörper-Schwächen"
        : numDays === 6 ? "Push A / Pull A / Beine A / Push B / Pull B / Beine B"
        : "Ganzkörper x2";
    return numDays === 3 ? "Push / Pull / Beine"
      : numDays === 4 ? "Oberkörper / Unterkörper x 2"
      : numDays === 5 ? "Push / Pull / Beine / Oberkörper / Unterkörper"
      : numDays >= 6 ? "PPL x 2"
      : "Oberkörper / Unterkörper";
  })();

  const sportBlock = cp.sport
    ? `\n🏈 SPORTART: ${cp.sport}\n- Berücksichtige Spieltage / Saisonphase: zwischen Trainings- und Spieltagen ausreichend Regeneration einplanen.\n- Kraft-Schwerpunkt sportartspezifisch (Explosivität, Schnellkraft, Wurfschulter, Stabilität).`
    : "";
  const injuryBlock = cp.injuries
    ? `\n⚠️ VERLETZUNGEN/EINSCHRÄNKUNGEN: ${cp.injuries}\n- VERMEIDE belastende Übungen für diese Bereiche, biete alternative Varianten an.`
    : "";
  const targetsBlock = targets
    ? `\n🍽️ ERNÄHRUNGSZIELE
- Trainingstag: ${(targets as any).kcal} kcal · P ${(targets as any).protein_g}g · KH ${(targets as any).carbs_g}g · F ${(targets as any).fat_g}g
- Restday: ${(targets as any).kcal_rest} kcal · P ${(targets as any).protein_g_rest}g · KH ${(targets as any).carbs_g_rest}g · F ${(targets as any).fat_g_rest}g
→ Trainingsintensität an Trainingstagen höher (mehr Volumen, schwerere Hauptsätze). Restdays für Regeneration nutzen.`
    : "";
  const adherenceBlock = `\n📊 ADHÄRENZ (letzte 30 Tage)
- Trainingseinheiten: ${sessionsLast30}
- Daily-Checks: ${checksLast30}/30 · perfekte Tage: ${perfectDays30}
${weightTrendKg !== null ? `- Gewichtstrend: ${weightTrendKg > 0 ? "+" : ""}${weightTrendKg} kg` : ""}
${sessionsLast30 < 4 ? "→ Kunde trainiert selten — Plan etwas konservativer starten, Einstiegshürden niedrig halten." : ""}
${sessionsLast30 >= 12 ? "→ Hohe Trainingsfrequenz — Volumen darf höher liegen, mehr Akzessoires." : ""}`;
  const startWeightsBlock = `\n💪 VORGESCHLAGENE STARTGEWICHTE (Woche 1, ~8 Wdh, runden auf 2,5 kg)
- Bankdrücken / Brustpresse: ${startWeights.bench_press_kg ?? "?"} kg
- Schulterdrücken: ${startWeights.shoulder_press_kg ?? "?"} kg
- Kniebeuge (LH): ${startWeights.squat_kg ?? "?"} kg
- Kreuzheben (LH): ${startWeights.deadlift_kg ?? "?"} kg
- Latzug: ${startWeights.lat_pulldown_kg ?? "?"} kg
- Kabelrudern: ${startWeights.row_kg ?? "?"} kg
- Beinpresse: ${startWeights.leg_press_kg ?? "?"} kg
- Beinbeuger: ${startWeights.leg_curl_kg ?? "?"} kg
- Plank-Niveau: ${plankSeconds ? plankSeconds + "s" : "unbekannt"}

Kurzhantel-Übungen: Gewicht PRO SEITE angeben. Langhantel/Maschinen: GESAMTGEWICHT.`;

  const prompt = `Erstelle einen INDIVIDUELLEN 4-WOCHEN-TRAININGSPLAN für ein Standard-Fitnessstudio.
NIEMALS Standardplan — nutze ALLE folgenden Daten.

👤 KUNDE
- Ziel: ${goalLabel[trainingGoal] ?? trainingGoal}
${cp.coaching_goal ? `- Eigenangabe: "${cp.coaching_goal}"` : ""}
${bw ? `- Körpergewicht: ${bw} kg` : ""}${bfPct ? ` · KFA: ${bfPct}%` : ""}
${cp.height_cm ? `- Größe: ${cp.height_cm} cm` : ""}${ageYears ? ` · Alter: ${ageYears} J.` : ""}${cp.gender ? ` · ${cp.gender}` : ""}
- Trainings-Erfahrung: ${experience}
- Sessionlänge: ca. ${sessionMinutes} Min · ${numDays} Trainingstage/Woche
${sportBlock}${injuryBlock}

🏋️ LETZTER STRENGTH CHECK
${lastCheck ? `Gesamt: ${lastCheck.score_total}/100 · Unter ${lastCheck.score_lower} · Push ${lastCheck.score_push} · Pull ${lastCheck.score_pull} · Core ${lastCheck.score_core}
→ Priorisiere schwächste Muskelgruppe(n) mit mehr Sätzen.` : "- Kein Check vorhanden → konservativ starten."}
${startWeightsBlock}
${targetsBlock}
${adherenceBlock}

📐 STRUKTUR
- Split: ${splitHint}
- 4 Wochen mit PROGRESSION:
  • Woche 1: Anpassungsphase, RPE 7, Startgewichte
  • Woche 2: +2,5–5 kg auf Hauptübungen oder +1 Wdh
  • Woche 3: Belastungsspitze, RPE 8–9, ggf. +1 Satz auf Hauptübung
  • Woche 4: Deload — Gewicht ~85%, Sätze -1, Fokus Technik & Regeneration
- Pro Tag: 1–2 Hauptübungen (compound), 2–3 Nebenübungen, 1 Kabel-/Maschine, 1 Core, optional Cardio (5–15 Min)
- Übungsnamen wie im deutschen Studio: "Bankdrücken Langhantel", "Latzug eng", "Beinpresse", "Kurzhantel-Schulterdrücken", "Cable Row", "Beinbeuger liegend", "Plank"
${priorList.length ? `- BEVORZUGE bereits genutzte Übungsnamen für saubere PR-Historie:\n${priorList.map((n) => `  • ${n}`).join("\n")}` : ""}
- Pro Übung: Sätze, Wiederholungen (z.B. "8" oder "8,8,10,12"), Startgewichte je Satz in kg (komma-getrennt, nur Zahlen), Pause in Sek, Notiz wenn nötig
- Kategorie: barbell | dumbbell | machine | cable | cardio | core | bodyweight

📤 ANTWORT
NUR gültiges JSON, KEINE Erklärung außerhalb:
{"weeks":[{"week_number":1,"focus":"Anpassung","days":[{"name":"Push","focus":"Brust/Schulter/Trizeps","exercises":[{"name":"Bankdrücken Langhantel","category":"barbell","target_sets":4,"target_reps":"8,8,8,10","target_weights":"60,60,60,50","rest_seconds":120,"notes":"Tempo 3-1-1"}]}]}]}
GENAU 4 Wochen. Jede Woche GENAU ${numDays} Tage. Mind. 5 Übungen pro Tag.`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (aiRes.status === 429) throw new Error("Rate-Limit erreicht — gleich nochmal versuchen.");
  if (aiRes.status === 402) throw new Error("KI-Guthaben aufgebraucht — bitte aufladen.");
  if (!aiRes.ok) {
    const txt = await aiRes.text();
    throw new Error(`KI-Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
  }
  const aiJson = await aiRes.json();
  const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
  let parsed: { weeks?: GenWeek[]; days?: GenDay[] } = {};
  try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { throw new Error("KI-Antwort konnte nicht gelesen werden."); }

  let weeks: GenWeek[] = parsed.weeks ?? [];
  if (!weeks.length && parsed.days?.length) {
    weeks = Array.from({ length: totalWeeks }, (_, i) => ({
      week_number: i + 1,
      focus: i === 3 ? "Deload" : `Woche ${i + 1}`,
      days: parsed.days as GenDay[],
    }));
  }
  weeks = weeks.slice(0, totalWeeks);
  if (!weeks.length) throw new Error("Keine Trainingswochen generiert.");

  for (const w of weeks) {
    w.days = (w.days ?? []).slice(0, numDays).map((d) => ({
      ...d,
      exercises: (d.exercises ?? []).map((e) => ({
        ...e,
        name: alignExerciseName(e.name, priorList),
      })),
    }));
  }

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

  let totalEx = 0;
  let totalDays = 0;
  for (const w of weeks) {
    for (let i = 0; i < w.days.length; i++) {
      const d = w.days[i];
      const dayName = d.focus ? `${d.name} — ${d.focus}` : d.name;
      const { data: dayRow, error: dayErr } = await supabase
        .from("training_days")
        .insert({
          plan_id: planRow.id,
          name: String(dayName).slice(0, 120),
          sort_order: i,
          week_number: w.week_number,
        } as any)
        .select("id").single();
      if (dayErr || !dayRow) continue;
      totalDays++;

      const rows = (d.exercises ?? [])
        .map((e, idx) => ({
          day_id: dayRow.id,
          name: String(e.name ?? "").trim().slice(0, 200),
          category: validCategory(e.category),
          target_sets:
            typeof e.target_sets === "number" && Number.isFinite(e.target_sets)
              ? Math.max(1, Math.min(20, Math.round(e.target_sets)))
              : null,
          target_reps: e.target_reps ? String(e.target_reps).slice(0, 80) : null,
          target_weights:
            e.target_weights != null && String(e.target_weights).trim().length
              ? String(e.target_weights).slice(0, 120)
              : null,
          rest_seconds:
            typeof e.rest_seconds === "number" && Number.isFinite(e.rest_seconds)
              ? Math.max(15, Math.min(600, Math.round(e.rest_seconds)))
              : null,
          notes: e.notes ? String(e.notes).slice(0, 500) : null,
          sort_order: idx,
        }))
        .filter((r) => r.name);
      totalEx += rows.length;
      if (rows.length) {
        await supabase.from("training_exercises").insert(rows as any);
      }
    }
  }

  return {
    ok: true,
    plan_id: planRow.id,
    status: "draft",
    weeks: weeks.length,
    days: totalDays,
    exercises: totalEx,
    scheduled_start_date: isoDate(start),
    scheduled_end_date: isoDate(end),
  };
}

function validCategory(c: unknown): string | null {
  const allowed = ["barbell","dumbbell","machine","cardio","core","bodyweight","cable"];
  if (typeof c !== "string") return null;
  const v = c.toLowerCase().trim();
  return allowed.includes(v) ? v : null;
}

function alignExerciseName(name: string, priorList: string[]): string {
  const raw = String(name ?? "").trim();
  if (!raw) return raw;
  const n = normalize(raw);
  let best: { name: string; score: number } | null = null;
  for (const p of priorList) {
    const np = normalize(p);
    let score = 0;
    if (np === n) score = 100;
    else if (np.includes(n) || n.includes(np)) score = 80;
    else {
      const tokensA = new Set(n.split(/\s+/));
      const tokensB = new Set(np.split(/\s+/));
      let inter = 0;
      tokensA.forEach((t) => { if (t.length > 2 && tokensB.has(t)) inter++; });
      score = (inter / Math.max(tokensA.size, tokensB.size)) * 70;
    }
    if (!best || score > best.score) best = { name: p, score };
  }
  return best && best.score >= 65 ? best.name : raw;
}
function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[äöü]/g, (c) => ({ ä: "a", ö: "o", ü: "u" })[c] as string)
    .replace(/ß/g, "ss").replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ").trim();
}
