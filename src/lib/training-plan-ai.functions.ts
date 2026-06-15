import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ExerciseCategory =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cardio"
  | "core"
  | "bodyweight"
  | "cable";

type GeneratedExercise = {
  name: string;
  category?: ExerciseCategory;
  target_sets?: number;
  target_reps?: string;
  target_weights?: string | null;
  rest_seconds?: number | null;
  notes?: string | null;
};
type GeneratedDay = {
  name: string;
  focus?: string;
  exercises: GeneratedExercise[];
};

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
const WEEKDAY_LABELS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

/**
 * Generate a smart, AI-driven training plan draft for the given user.
 * Uses Strength-Check e1RM values, training goal, training weekdays and
 * the customer's existing exercise names (for alignment) as input.
 *
 * Creates a nutrition_plans row with plan_type='training', status='draft'
 * (not auto-active) and populates training_days + training_exercises.
 */
export const generateAiTrainingPlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      user_id: string;
      title?: string;
      /** "today" = startet sofort; "next_week" = beginnt nächsten Montag. */
      start_mode?: "today" | "next_week";
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data.user_id;

    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "coach",
    });
    if (target !== userId && !isCoach) throw new Error("Forbidden");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const [
      { data: profile },
      { data: clientProfile },
      { data: latestWeight },
      { data: lastCheck },
      { data: priorExercises },
    ] = await Promise.all([
      supabase
        .from("smart_nutrition_profile")
        .select("training_weekdays, training_session_minutes")
        .eq("user_id", target)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select(
          "display_name, height_cm, birthdate, gender, training_goal, coaching_goal",
        )
        .eq("id", target)
        .maybeSingle(),
      supabase
        .from("body_measurements")
        .select("weight_kg")
        .eq("user_id", target)
        .not("weight_kg", "is", null)
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("strength_checks")
        .select(
          "id, performed_at, bodyweight_kg, score_total, score_lower, score_push, score_pull, score_core",
        )
        .eq("user_id", target)
        .eq("status", "completed")
        .order("performed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Existing exercise names from the user's plans — used for alignment.
      supabase
        .from("nutrition_plans")
        .select("id, training_days(training_exercises(name))")
        .eq("client_id", target)
        .eq("plan_type", "training")
        .limit(5),
    ]);

    const checkResults =
      lastCheck?.id
        ? (
            await supabase
              .from("strength_check_results")
              .select("test_key, weight_kg, reps, duration_seconds, e1rm_kg")
              .eq("check_id", lastCheck.id)
          ).data ?? []
        : [];

    // ----- e1RM map -----
    const e1rm: Record<string, number | null> = {
      leg_press: null,
      leg_curl: null,
      chest_press: null,
      shoulder_press: null,
      lat_pulldown: null,
      cable_row: null,
    };
    let plankSeconds: number | null = null;
    for (const r of checkResults as any[]) {
      if (r.test_key === "plank") plankSeconds = r.duration_seconds ?? null;
      else if (r.test_key in e1rm)
        e1rm[r.test_key] = r.e1rm_kg ? Number(r.e1rm_kg) : null;
    }

    const bw =
      lastCheck?.bodyweight_kg ?? (latestWeight as any)?.weight_kg ?? null;

    // Suggested working weights for 8 reps ≈ ~75% of e1RM
    const w8 = (val: number | null) => (val ? Math.round((val * 0.75) / 2.5) * 2.5 : null);
    const startWeights = {
      bench_press_kg: w8(e1rm.chest_press),
      shoulder_press_kg: w8(e1rm.shoulder_press),
      squat_kg: e1rm.leg_press
        ? Math.round((e1rm.leg_press * 0.35) / 2.5) * 2.5
        : null,
      deadlift_kg: e1rm.leg_press
        ? Math.round((e1rm.leg_press * 0.45) / 2.5) * 2.5
        : null,
      lat_pulldown_kg: w8(e1rm.lat_pulldown),
      row_kg: w8(e1rm.cable_row),
      leg_press_kg: w8(e1rm.leg_press),
      leg_curl_kg: w8(e1rm.leg_curl),
    };

    // ----- training schedule -----
    const trainingDayKeys: string[] =
      (profile as any)?.training_weekdays?.length
        ? (profile as any).training_weekdays
        : ["monday", "wednesday", "friday"];
    const numDays = Math.max(2, Math.min(6, trainingDayKeys.length));
    const trainingSet = new Set(trainingDayKeys.map((s) => s.toLowerCase()));

    // Build a 7-day schedule starting today or next Monday.
    const startMode = data.start_mode ?? "today";
    const start = (() => {
      const d = new Date();
      if (startMode === "next_week") {
        const day = d.getDay();
        const delta = day === 1 ? 7 : ((1 - day + 7) % 7) || 7;
        d.setDate(d.getDate() + delta);
      }
      return d;
    })();
    const planSpan = 7;
    const schedule = Array.from({ length: planSpan }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const wkIdx = d.getDay();
      const wkKey = WEEKDAY_KEYS[wkIdx];
      const wkLabel = WEEKDAY_LABELS_DE[wkIdx];
      const isTraining = trainingSet.has(wkKey);
      return { wkKey, wkLabel, isTraining };
    });

    // ----- alignment list -----
    const priorNames = new Set<string>();
    for (const p of (priorExercises as any[]) ?? []) {
      for (const d of p?.training_days ?? []) {
        for (const ex of d?.training_exercises ?? []) {
          if (ex?.name) priorNames.add(String(ex.name).trim());
        }
      }
    }
    const priorList = Array.from(priorNames).slice(0, 60);

    const cp: any = clientProfile ?? {};
    const ageYears: number | null = cp.birthdate
      ? Math.floor((Date.now() - new Date(cp.birthdate).getTime()) / (365.25 * 86400000))
      : null;
    const sessionMinutes =
      (profile as any)?.training_session_minutes ?? 60;
    const trainingGoal: string = cp.training_goal ?? "performance";

    const goalLabel: Record<string, string> = {
      muscle_gain: "Muskelaufbau",
      lean_bulk: "lean bulk / Muskelaufbau",
      bulk: "Massephase",
      weight_loss: "Fettabbau",
      fat_loss: "Fettabbau",
      aggressive_cut: "aggressiver Cut (Muskel halten)",
      recomp: "Recomposition (Fett↓ Muskel↑)",
      recomposition: "Recomposition (Fett↓ Muskel↑)",
      maintain: "Gewicht halten / Leistung halten",
      maintenance: "Gewicht halten",
      strength: "Maximalkraft",
      performance: "Leistungssteigerung / Athletik",
      health: "Gesundheit & Beweglichkeit",
    };

    const startWeightsBlock = `Vorgeschlagene Arbeitsgewichte (für ~8 Wdh. nutzen, sonst angemessen anpassen — runde immer auf 2,5 kg):
- Bankdrücken / Brustpresse: ${startWeights.bench_press_kg ?? "?"} kg
- Schulterdrücken: ${startWeights.shoulder_press_kg ?? "?"} kg
- Kniebeuge (Langhantel): ${startWeights.squat_kg ?? "?"} kg
- Kreuzheben (Langhantel): ${startWeights.deadlift_kg ?? "?"} kg
- Latzug: ${startWeights.lat_pulldown_kg ?? "?"} kg
- Kabelrudern: ${startWeights.row_kg ?? "?"} kg
- Beinpresse: ${startWeights.leg_press_kg ?? "?"} kg
- Beinbeuger: ${startWeights.leg_curl_kg ?? "?"} kg
- Plank-Niveau: ${plankSeconds ? plankSeconds + "s" : "unbekannt"}

Bei Kurzhantel-Übungen: Gewicht pro Seite angeben. Bei Langhantel/Maschinen: Gesamtgewicht.`;

    const splitHint =
      numDays <= 2
        ? "2er-Split: Ganzkörper A / B"
        : numDays === 3
          ? "3er-Split: Push / Pull / Beine ODER Oberkörper / Unterkörper / Ganzkörper"
          : numDays === 4
            ? "4er-Split: Push / Pull / Beine / Ganzkörper-Schwächen"
            : numDays === 5
              ? "5er-Split: Push / Pull / Beine / Oberkörper / Unterkörper"
              : "6er-Split: Push A / Pull A / Beine A / Push B / Pull B / Beine B";

    const prompt = `Erstelle einen vollständigen Trainingsplan für ein Standard-Fitnessstudio mit ${numDays} Trainingstagen pro Woche.

👤 KUNDE
- Trainingsziel: ${goalLabel[trainingGoal] ?? trainingGoal}
${cp.coaching_goal ? `- Eigenangabe: "${cp.coaching_goal}"` : ""}
${bw ? `- Körpergewicht: ${bw} kg` : ""}
${cp.height_cm ? `- Größe: ${cp.height_cm} cm` : ""}
${ageYears ? `- Alter: ${ageYears} J.` : ""}
${cp.gender ? `- Geschlecht: ${cp.gender}` : ""}
- Sessionlänge: ca. ${sessionMinutes} Min.

🏋️ STRENGTH-CHECK (letzter Test)
${lastCheck ? `- Gesamtscore: ${lastCheck.score_total ?? "?"} / 100 · Unterkörper ${lastCheck.score_lower ?? "?"} · Push ${lastCheck.score_push ?? "?"} · Pull ${lastCheck.score_pull ?? "?"} · Core ${lastCheck.score_core ?? "?"}` : "- Kein Strength Check vorhanden — wähle moderate Anfängergewichte."}

${startWeightsBlock}

📐 STRUKTUR
- ${splitHint}
- Jeder Tag enthält: 1–2 Hauptübungen (compound), 2–3 Nebenübungen, 1 Kabel-/Maschinen-Übung, 1 Core-Übung, optional 1 Cardio-Block (5–15 Min HIIT/Stepper/Laufband).
- Übungen sollen so heißen, wie sie im deutschen Studio üblich genannt werden (z. B. "Bankdrücken Langhantel", "Latzug eng", "Beinpresse", "Kurzhantel-Schulterdrücken", "Cable Row", "Beinbeuger liegend", "Plank").
${priorList.length ? `- BEVORZUGE — wo passend — folgende bereits vom Kunden genutzten Übungsnamen 1:1 (für saubere PR-Historie):\n${priorList.map((n) => `  • ${n}`).join("\n")}` : ""}
- Pro Übung: Sätze, Wiederholungen (z.B. "8" oder "8, 8, 10, 12"), Startgewichte je Satz in kg (komma-getrennt, nur Zahlen, ohne Einheit), Pausenzeit in Sekunden, kurze Notiz wenn nötig.
- Kategorie pro Übung wählen aus: barbell | dumbbell | machine | cable | cardio | core | bodyweight

📤 ANTWORT
Antworte AUSSCHLIESSLICH mit gültigem JSON in dieser Struktur:
{"days":[{"name":"Push","focus":"Brust/Schulter/Trizeps","exercises":[{"name":"Bankdrücken Langhantel","category":"barbell","target_sets":4,"target_reps":"8, 8, 8, 10","target_weights":"60, 60, 60, 50","rest_seconds":120,"notes":"Tempo 3-1-1"}]}]}
Genau ${numDays} Tage. Jeder Tag mindestens 5 Übungen. Keine Erklärungen außerhalb des JSON.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (aiRes.status === 429)
      throw new Error("Rate-Limit erreicht — bitte gleich nochmal versuchen.");
    if (aiRes.status === 402)
      throw new Error("KI-Guthaben aufgebraucht — bitte aufladen.");
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`KI-Fehler [${aiRes.status}]: ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { days?: GeneratedDay[] } = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("KI-Antwort konnte nicht gelesen werden.");
    }
    const days = (parsed.days ?? []).slice(0, numDays);
    if (!days.length) throw new Error("Keine Tage generiert.");

    // ----- name alignment -----
    const aligned = days.map((d) => ({
      ...d,
      exercises: (d.exercises ?? []).map((e) => ({
        ...e,
        name: alignExerciseName(e.name, priorList),
      })),
    }));

    // ----- archive previous draft/approved/published training plan -----
    await supabase
      .from("nutrition_plans")
      .update({ status: "archived" })
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
          data.title?.trim() ||
          `Smart-Trainingsplan — ${new Date().toLocaleDateString("de-DE")}`,
        plan_type: "training",
        is_active: false,
        status: "draft",
        generated_by: "ai_auto",
        source: "smart_ai",
        uploaded_by: userId,
        file_path: `ai-generated/${target}/training-${Date.now()}.json`,
        file_name: "ai-training.json",
        scheduled_start_date: isoDate(start),
        scheduled_end_date: isoDate(end),
      })
      .select("id")
      .single();
    if (planErr || !planRow)
      throw new Error(planErr?.message ?? "Plan konnte nicht angelegt werden");

    let totalEx = 0;
    for (let i = 0; i < aligned.length; i++) {
      const d = aligned[i];
      const dayName = d.focus ? `${d.name} — ${d.focus}` : d.name;
      const { data: dayRow, error: dayErr } = await supabase
        .from("training_days")
        .insert({
          plan_id: planRow.id,
          name: String(dayName).slice(0, 120),
          sort_order: i,
        })
        .select("id")
        .single();
      if (dayErr || !dayRow) continue;

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
        await supabase.from("training_exercises").insert(rows);
      }
    }

    return {
      ok: true,
      plan_id: planRow.id,
      status: "draft",
      days: aligned.length,
      exercises: totalEx,
      scheduled_start_date: isoDate(start),
      scheduled_end_date: isoDate(end),
    };
  });

function validCategory(c: unknown): string | null {
  const allowed = [
    "barbell",
    "dumbbell",
    "machine",
    "cardio",
    "core",
    "bodyweight",
    "cable",
  ];
  if (typeof c !== "string") return null;
  const v = c.toLowerCase().trim();
  return allowed.includes(v) ? v : null;
}

/** Pick the closest prior exercise name if it's a clear match, else keep the AI name. */
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
      tokensA.forEach((t) => {
        if (t.length > 2 && tokensB.has(t)) inter++;
      });
      score = (inter / Math.max(tokensA.size, tokensB.size)) * 70;
    }
    if (!best || score > best.score) best = { name: p, score };
  }
  return best && best.score >= 65 ? best.name : raw;
}
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äöü]/g, (c) => ({ ä: "a", ö: "o", ü: "u" })[c] as string)
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
