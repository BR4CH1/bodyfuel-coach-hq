import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FUELY_MODEL = "google/gemini-3-flash-preview";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type Kind = "morning" | "evening";

function todayISO(offset = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function gatherSnapshot(supabase: any, userId: string) {
  const today = todayISO();
  const [profile, points, foodToday, waterToday, trainingToday, checkin, measurements, challenges, coachMsg, lastMorning] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, display_name, goal, current_weight_kg, target_weight_kg")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_points")
        .select("current_streak, level, weekly_points, total_points")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("food_entries")
        .select("meal, kcal, protein_g, carbs_g, fat_g")
        .eq("user_id", userId)
        .eq("entry_date", today),
      supabase
        .from("water_logs")
        .select("glasses")
        .eq("user_id", userId)
        .eq("entry_date", today)
        .maybeSingle(),
      supabase
        .from("training_sessions")
        .select("id, name, session_type, focus, status, session_date, duration_minutes")
        .eq("client_id", userId)
        .eq("session_date", today)
        .order("start_time", { ascending: true, nullsFirst: true }),
      supabase
        .from("athlete_checkins")
        .select("mood, sleep_quality, energy, soreness, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("body_measurements")
        .select("weight_kg, measured_at")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(2),
      supabase
        .from("organization_challenges")
        .select("id, title, ends_at")
        .lte("starts_at", new Date().toISOString())
        .gte("ends_at", new Date().toISOString())
        .limit(3),
      supabase
        .from("coach_messages")
        .select("body, created_at")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(2),
      supabase
        .from("fuely_daily_notes")
        .select("content, note_date")
        .eq("user_id", userId)
        .eq("kind", "morning")
        .order("note_date", { ascending: false })
        .limit(3),
    ]);

  const food = (foodToday.data ?? []) as any[];
  const totals = food.reduce(
    (a, r) => ({
      kcal: a.kcal + Number(r.kcal ?? 0),
      protein: a.protein + Number(r.protein_g ?? 0),
      carbs: a.carbs + Number(r.carbs_g ?? 0),
      fat: a.fat + Number(r.fat_g ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const measurementRows = (measurements.data ?? []) as any[];
  const weightTrend =
    measurementRows.length >= 2
      ? Number(measurementRows[0]?.weight_kg) - Number(measurementRows[1]?.weight_kg)
      : null;

  return {
    date: today,
    profile: profile.data ?? null,
    points: points.data ?? null,
    nutrition_today: {
      kcal: Math.round(totals.kcal),
      protein_g: Math.round(totals.protein),
      carbs_g: Math.round(totals.carbs),
      fat_g: Math.round(totals.fat),
      entries: food.length,
    },
    water_glasses_today: Number((waterToday.data as any)?.glasses ?? 0),
    training_today: (trainingToday.data ?? []) as any[],
    last_checkin: checkin.data ?? null,
    weight_kg: measurementRows[0]?.weight_kg ?? null,
    weight_trend_kg: weightTrend,
    active_challenges: (challenges.data ?? []) as any[],
    recent_coach_messages: (coachMsg.data ?? []) as any[],
    recent_morning_notes: (lastMorning.data ?? []) as any[],
  };
}

const MORNING_PROMPT = `Du bist Fuely, das offizielle Maskottchen und der persönliche KI-Coach von BodyFuel.
Du sprichst den Nutzer persönlich an – wie ein guter Freund, nicht wie ein System.

Schreibe ein MORNING BRIEFING für heute. Regeln:
- Persönliche Anrede mit dem Vornamen, falls bekannt.
- Warm, motivierend, locker – niemals belehrend.
- Kurze Sätze. Emoji sparsam, aber gezielt (💪 🔥 👊 ✅ 💧 🍗 🚶 💚).
- Variiere die Formulierung jeden Tag. NIEMALS Standardsätze wie "Hier sind deine Zahlen für heute".
- Nutze die realen Daten: Training, Kalorien, Protein, Wasser, Streak, Challenges, Coach-Nachrichten, Gewichtstrend, Check-in.
- Wenn passend, greif frühere Erfolge auf (aus "recent_morning_notes" / Streak / Gewichtstrend).
- Wenn Trainingsplan heute vorhanden: nenne konkret was ansteht.
- Halte es unter 90 Wörter. Kein System-Ton, keine Aufzählung sinnloser Nullen.
- Beende warm, z.B. "Ich begleite dich heute 💚".

Antworte NUR mit dem Text, keine Meta-Kommentare, keine Anführungszeichen drumherum.`;

const EVENING_PROMPT = `Du bist Fuely, das offizielle Maskottchen und der persönliche KI-Coach von BodyFuel.

Schreibe ein EVENING REVIEW für heute. Regeln:
- Persönliche Anrede mit dem Vornamen, falls bekannt.
- Bewerte den Tag freundlich, NIE negativ, NIE Schuld, NIE Warnfarben.
- Wenn Ziele erreicht: feiere kurz und konkret (Training erledigt, Wasser geschafft, Protein-Quote).
- Wenn nicht erreicht: "das ist völlig okay, morgen starten wir neu" – ohne Vorwurf.
- Variiere jeden Tag die Sprache. Keine Standardtexte.
- Emoji sparsam (✅ 🍗 💧 ⭐ 💚 🌙).
- Halte es unter 80 Wörter.
- Beende ruhig und ermutigend.

Antworte NUR mit dem Text, keine Meta-Kommentare, keine Anführungszeichen drumherum.`;

async function callFuelyText(system: string, snapshot: any, apiKey: string): Promise<string> {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: FUELY_MODEL,
      temperature: 0.9,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Hier sind die aktuellen Daten des Nutzers als JSON. Schreib den Text jetzt.\n\n${JSON.stringify(
            snapshot,
          )}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Fuely daily failed (${res.status})`);
  const j = await res.json();
  return String(j?.choices?.[0]?.message?.content ?? "").trim();
}

export const getFuelyDailyNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { kind: Kind }) => {
    if (input?.kind !== "morning" && input?.kind !== "evening") throw new Error("invalid kind");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = todayISO();

    const { data: existing } = await supabase
      .from("fuely_daily_notes")
      .select("id, kind, content, created_at, read_at")
      .eq("user_id", userId)
      .eq("note_date", today)
      .eq("kind", data.kind)
      .maybeSingle();

    if (existing) return existing as any;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const snapshot = await gatherSnapshot(supabase, userId);
    const prompt = data.kind === "morning" ? MORNING_PROMPT : EVENING_PROMPT;
    const content = await callFuelyText(prompt, snapshot, apiKey);
    if (!content) throw new Error("empty content");

    const { data: inserted, error } = await supabase
      .from("fuely_daily_notes")
      .insert({
        user_id: userId,
        note_date: today,
        kind: data.kind,
        content,
        data_snapshot: snapshot as any,
      })
      .select("id, kind, content, created_at, read_at")
      .single();

    if (error) throw new Error(error.message);

    // Timeline-Eintrag (privat) — Morning bzw. Evening
    try {
      const { insertTimelineEvent } = await import("./fuely-timeline.server");
      const isMorning = data.kind === "morning";
      const preview = content.split(/\n\n/)[0]?.slice(0, 160) ?? "";
      await insertTimelineEvent(supabase, userId, {
        event_type: isMorning ? "morning_briefing" : "evening_review",
        category: isMorning ? "morning" : "evening",
        icon: isMorning ? "🌅" : "🌙",
        title: isMorning ? "Morgen-Briefing" : "Tagesrückblick",
        summary: preview,
        coach_visible: false,
        metadata: { note_id: (inserted as any)?.id ?? null },
      });
    } catch {
      // Timeline-Fehler dürfen die Note nicht killen
    }

    return inserted as any;
  });

export const markFuelyDailyRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("fuely_daily_notes")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    return { ok: true };
  });
