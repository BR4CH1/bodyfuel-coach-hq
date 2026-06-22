import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Erlaubt Kunden, einen bereits vorhandenen Trainingsplan zu importieren
 * (PDF/Bild via KI, Text via KI, oder manuell).
 *
 * - parseCustomerTrainingPlan: nimmt rohen Text ODER ein data:URL (PDF/Bild)
 *   und liefert ein strukturiertes Plan-JSON zurück, das im Editor bearbeitet
 *   werden kann.
 * - saveCustomerTrainingPlan: speichert den vom Kunden bestätigten Plan als
 *   neuen aktiven Trainingsplan. Vorherige aktive Pläne werden archiviert,
 *   sodass der Coach später trotzdem einen neuen Plan freigeben kann.
 */

export type ImportedExercise = {
  name: string;
  category?: string | null;
  target_sets?: number | null;
  target_reps?: string | null;
  target_weights?: string | null;
  rest_seconds?: number | null;
  notes?: string | null;
};

export type ImportedDay = {
  name: string;
  focus?: string | null;
  week_number?: number | null;
  exercises: ImportedExercise[];
};

export type ImportedPlan = {
  title?: string;
  weeks_count?: number;
  days: ImportedDay[];
};

const CATEGORIES = new Set([
  "barbell", "dumbbell", "machine", "cardio", "core", "bodyweight", "cable",
]);

function normalizePlan(input: any): ImportedPlan {
  const raw: any = input ?? {};
  let days: any[] = [];
  if (Array.isArray(raw.days)) days = raw.days;
  else if (Array.isArray(raw.weeks)) {
    for (const w of raw.weeks) {
      for (const d of w?.days ?? []) {
        days.push({ ...d, week_number: w?.week_number ?? d?.week_number ?? 1 });
      }
    }
  }
  const cleanedDays: ImportedDay[] = days.map((d) => ({
    name: String(d?.name ?? "Trainingstag").slice(0, 120),
    focus: d?.focus ? String(d.focus).slice(0, 120) : null,
    week_number: Number.isFinite(Number(d?.week_number)) ? Math.max(1, Math.min(12, Number(d.week_number))) : 1,
    exercises: (Array.isArray(d?.exercises) ? d.exercises : []).map((e: any) => ({
      name: String(e?.name ?? "").slice(0, 200),
      category: e?.category && CATEGORIES.has(String(e.category)) ? String(e.category) : null,
      target_sets:
        Number.isFinite(Number(e?.target_sets))
          ? Math.max(1, Math.min(20, Math.round(Number(e.target_sets))))
          : null,
      target_reps: e?.target_reps ? String(e.target_reps).slice(0, 80) : null,
      target_weights: e?.target_weights ? String(e.target_weights).slice(0, 120) : null,
      rest_seconds:
        Number.isFinite(Number(e?.rest_seconds))
          ? Math.max(15, Math.min(600, Math.round(Number(e.rest_seconds))))
          : null,
      notes: e?.notes ? String(e.notes).slice(0, 500) : null,
    })).filter((e: ImportedExercise) => e.name),
  })).filter((d) => d.exercises.length || d.name);

  const weeks_count = Math.max(
    1,
    Math.min(12, Number(raw.weeks_count) || cleanedDays.reduce((m, d) => Math.max(m, d.week_number ?? 1), 1)),
  );
  return {
    title: raw.title ? String(raw.title).slice(0, 160) : undefined,
    weeks_count,
    days: cleanedDays,
  };
}

const SYSTEM_PROMPT = `Du bist ein Assistent, der bestehende Trainingspläne in strukturiertes JSON umwandelt.
Antworte AUSSCHLIESSLICH mit gültigem JSON in dieser Form:
{"title":"...","weeks_count":1,"days":[{"name":"Push","focus":"Brust/Schulter","week_number":1,"exercises":[{"name":"Bankdrücken","category":"barbell","target_sets":4,"target_reps":"8","target_weights":"60","rest_seconds":120,"notes":null}]}]}
Regeln:
- category: einer von barbell|dumbbell|machine|cable|cardio|core|bodyweight
- target_reps: String wie "8" oder "8,8,10,12"
- target_weights: String in kg, komma-getrennt (oder null)
- rest_seconds: Zahl in Sekunden (oder null)
- Wenn keine Wochen erkennbar: weeks_count=1 und alle Tage week_number=1
- Keine Erklärungen außerhalb des JSON.`;

async function callGateway(messages: any[]): Promise<any> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      max_tokens: 16000,
      messages,
    }),
  });
  if (res.status === 429) throw new Error("Rate-Limit erreicht — gleich nochmal versuchen.");
  if (res.status === 402) throw new Error("Guthaben aufgebraucht — bitte aufladen.");
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`KI-Fehler [${res.status}]: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content ?? "{}";
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("Antwort konnte nicht gelesen werden.");
  }
}

export const parseCustomerTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      mode: "text" | "image" | "pdf";
      payload: string;
      filename?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    if (!data.payload || data.payload.length < 10) {
      throw new Error("Kein Inhalt zum Parsen.");
    }
    let messages: any[];
    if (data.mode === "text") {
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            "Wandle den folgenden Trainingsplan in das geforderte JSON-Format um:\n\n" +
            data.payload.slice(0, 24000),
        },
      ];
    } else if (data.mode === "image") {
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrahiere den Trainingsplan aus diesem Bild als JSON wie spezifiziert." },
            { type: "image_url", image_url: { url: data.payload } },
          ],
        },
      ];
    } else {
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrahiere den Trainingsplan aus diesem PDF als JSON wie spezifiziert." },
            {
              type: "file",
              file: {
                filename: data.filename || "plan.pdf",
                file_data: data.payload,
              },
            },
          ],
        },
      ];
    }
    const parsed = await callGateway(messages);
    return normalizePlan(parsed);
  });

export const saveCustomerTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan: ImportedPlan }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const plan = normalizePlan(data.plan);
    if (!plan.days.length) throw new Error("Plan enthält keine Tage.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Vorherige Trainingspläne dieses Kunden archivieren
    await supabaseAdmin
      .from("nutrition_plans")
      .update({ is_active: false, status: "archived", archived_at: new Date().toISOString() } as any)
      .eq("client_id", userId)
      .eq("plan_type", "training")
      .eq("is_active", true);

    const weeks = plan.weeks_count ?? 1;
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + weeks * 7 - 1);

    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("nutrition_plans")
      .insert({
        client_id: userId,
        title: plan.title?.trim() || `Eigener Trainingsplan — ${today.toLocaleDateString("de-DE")}`,
        plan_type: "training",
        is_active: true,
        status: "active",
        source: "customer_import",
        generated_by: "customer",
        uploaded_by: userId,
        file_path: `customer-import/${userId}/training-${Date.now()}.json`,
        file_name: "customer-training.json",
        scheduled_start_date: start,
        scheduled_end_date: endDate.toISOString().slice(0, 10),
        activated_at: new Date().toISOString(),
        weeks_count: weeks,
      } as any)
      .select("id")
      .single();
    if (planErr || !planRow) throw new Error(planErr?.message ?? "Plan konnte nicht angelegt werden");

    let totalEx = 0;
    let dayIdx = 0;
    for (const d of plan.days) {
      const { data: dayRow, error: dayErr } = await supabaseAdmin
        .from("training_days")
        .insert({
          plan_id: planRow.id,
          name: d.focus ? `${d.name} — ${d.focus}` : d.name,
          sort_order: dayIdx++,
          week_number: d.week_number ?? 1,
        } as any)
        .select("id")
        .single();
      if (dayErr || !dayRow) continue;

      const rows = d.exercises.map((e, idx) => ({
        day_id: dayRow.id,
        name: e.name,
        category: e.category ?? null,
        target_sets: e.target_sets,
        target_reps: e.target_reps,
        target_weights: e.target_weights,
        rest_seconds: e.rest_seconds,
        notes: e.notes,
        sort_order: idx,
      }));
      if (rows.length) {
        const { error: exErr } = await supabaseAdmin.from("training_exercises").insert(rows as any);
        if (!exErr) totalEx += rows.length;
      }
    }

    return { ok: true, plan_id: planRow.id, days: plan.days.length, exercises: totalEx };
  });
