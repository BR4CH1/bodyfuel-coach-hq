import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  progressExerciseAfterSession,
  type LoggedSet,
} from "./training-engine/progression";

type ParsedExercise = {
  name: string;
  target_sets?: number | null;
  target_reps?: string | null;
  target_weights?: string | null;
  notes?: string | null;
};
type ParsedDay = { name: string; exercises: ParsedExercise[] };

export const parseTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { plan_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    // Caller must be coach
    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "coach",
    });
    if (!isCoach) throw new Error("Forbidden");

    // Load plan
    const { data: plan, error: pErr } = await supabase
      .from("nutrition_plans")
      .select("id, file_path, plan_type")
      .eq("id", data.plan_id)
      .single();
    if (pErr || !plan) throw new Error(pErr?.message || "Plan nicht gefunden");
    if (plan.plan_type !== "training") throw new Error("Kein Trainingsplan");

    // Download PDF via admin client (storage RLS bypass)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("nutrition-plans")
      .download(plan.file_path);
    if (dlErr || !file) throw new Error(dlErr?.message || "Download fehlgeschlagen");

    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);

    const prompt = `Du bekommst einen Trainingsplan als PDF. Extrahiere ALLE Trainingstage und die Übungen jedes Tages.

Pro Übung extrahiere:
- name: Übungsname
- target_sets: Anzahl Sätze (Zahl). Beispiel "15x40kg | 12x50kg | 10x60kg | 8x60kg | Vollgas 60kg" → 5 Sätze.
- target_reps: Wiederholungen pro Satz, Komma-getrennt in Satz-Reihenfolge. Beispiel oben → "15, 12, 10, 8, max". Wenn nur ein Wert vorgegeben ist (z.B. "4×10"), gib "10" zurück.
- target_weights: Gewichte pro Satz IN KG, Komma-getrennt in Satz-Reihenfolge, OHNE Einheit. Beispiel oben → "40, 50, 60, 60, 60". Wenn ein Satz "Vollgas", "Burnout", "max" o.ä. ohne Gewicht ist, übernimm das Gewicht des vorherigen Satzes. Wenn gar keine Gewichte vorgegeben sind (z.B. nur Wiederholungen wie Klimmzüge "5 | 5 | 5 | max | max"), gib null zurück.
- notes: zusätzliche Hinweise wie "Vollgas", "Burnout", "Tempo 3-1-1", "Pause 90s" — alles was nicht Sätze/Reps/Gewicht ist. Sonst null.

Gib ausschließlich gültiges JSON zurück:
{ "days": [ { "name": "Push", "exercises": [ { "name": "Bankdrücken", "target_sets": 5, "target_reps": "15, 12, 10, 8, max", "target_weights": "40, 50, 60, 60, 60", "notes": "Vollgas letzter Satz" } ] } ] }
Keine Erklärungen.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "file",
                file: {
                  filename: "plan.pdf",
                  file_data: `data:application/pdf;base64,${b64}`,
                },
              },
            ],
          },
        ],
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`Fehler [${aiRes.status}]: ${txt.slice(0, 300)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "";
    let parsed: { days?: ParsedDay[] };
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("Antwort konnte nicht gelesen werden");
    }
    const days = Array.isArray(parsed.days) ? parsed.days : [];
    if (!days.length) throw new Error("Keine Übungen erkannt");

    // Replace existing days for this plan
    await supabaseAdmin.from("training_days").delete().eq("plan_id", plan.id);

    let totalEx = 0;
    for (let di = 0; di < days.length; di++) {
      const d = days[di];
      const { data: dayRow, error: dayErr } = await supabaseAdmin
        .from("training_days")
        .insert({
          plan_id: plan.id,
          name: String(d.name ?? `Tag ${di + 1}`).slice(0, 120),
          sort_order: di,
        })
        .select()
        .single();
      if (dayErr || !dayRow) throw new Error(dayErr?.message || "Insert fehlgeschlagen");
      const exes = Array.isArray(d.exercises) ? d.exercises : [];
      if (!exes.length) continue;
      const rows = exes.map((e, i) => ({
        day_id: dayRow.id,
        name: String(e.name ?? "").slice(0, 200),
        target_sets:
          typeof e.target_sets === "number" && Number.isFinite(e.target_sets)
            ? Math.max(1, Math.min(20, Math.round(e.target_sets)))
            : null,
        target_reps: e.target_reps ? String(e.target_reps).slice(0, 80) : null,
        target_weights: e.target_weights ? String(e.target_weights).slice(0, 120) : null,
        notes: e.notes ? String(e.notes).slice(0, 500) : null,
        sort_order: i,
      })).filter((r) => r.name);
      totalEx += rows.length;
      if (rows.length) {
        const { error: exErr } = await supabaseAdmin.from("training_exercises").insert(rows);
        if (exErr) throw new Error(exErr.message);
      }
    }
    return { days: days.length, exercises: totalEx };
  });

export const logSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      exercise_id: string;
      set_number: number;
      weight_kg: number | null;
      reps: number | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("training_set_logs")
      .insert({
        exercise_id: data.exercise_id,
        client_id: userId,
        set_number: data.set_number,
        weight_kg: data.weight_kg,
        reps: data.reps,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSetLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("training_set_logs")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
