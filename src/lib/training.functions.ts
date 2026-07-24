import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { progressExerciseAfterSession, type LoggedSet } from "./training-engine/progression";
import {
  normalizeExerciseKey,
  readinessCooldownActive,
  stateFromDecision,
} from "./training-engine/athlete-exercise-state";
import {
  evaluateReadinessGate,
  applyReadinessGateWithMeta,
} from "./training-engine/readiness-gate";
import type { ReadinessCheckin } from "@/lib/readiness";

/** Zentrales Laden der letzten 30 Tage Check-ins für das Readiness-Gate. */
async function loadRecentCheckins(supabase: any, userId: string): Promise<ReadinessCheckin[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data } = await supabase
    .from("athlete_checkins")
    .select("checkin_date, sleep, energy, stress, training_feel, pain_level, pain_note")
    .eq("user_id", userId)
    .gte("checkin_date", since.toISOString().slice(0, 10))
    .order("checkin_date", { ascending: false });
  return (data as ReadinessCheckin[]) ?? [];
}

/**
 * Phase 6 — Gate-Cooldown: liefert die Session-Daten der letzten 7 Tage,
 * an denen der Athlet ein hartes Readiness-Gate (`reduce`) getriggert hat.
 * Wird genutzt, um die Confidence auch NACH dem akuten Gate-Zeitraum
 * gedeckelt zu halten, bis 7 Tage ohne harte Bremse vergangen sind.
 */
async function loadRecentHardGateDates(supabase: any, userId: string): Promise<string[]> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const { data } = await supabase
    .from("training_progression_events")
    .select("source_session_date")
    .eq("client_id", userId)
    .eq("readiness_gate", "reduce")
    .gte("source_session_date", since.toISOString().slice(0, 10));
  return ((data as any[]) ?? []).map((r) => String(r.source_session_date)).filter(Boolean);
}

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
      const rows = exes
        .map((e, i) => ({
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
        }))
        .filter((r) => r.name);
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
    const { error } = await context.supabase.from("training_set_logs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Smart-Progression pro Übung. Wird beim Abschluss der Trainingseinheit für
 * JEDE Übung aufgerufen, die tatsächlich Working-Sets geloggt hat.
 *
 * Wertet ALLE Working-Sets gemeinsam aus (Gewicht, Wdh., RPE, Satzabfall,
 * Ziel-Reprange, Historie), speichert die Entscheidung in
 * `training_progression_events` und schreibt — nur bei tatsächlicher
 * Veränderung — die neuen Vorgaben in die NÄCHSTE geplante Ausführung
 * derselben Übung. Die bereits absolvierte Session bleibt unverändert.
 */
export const progressAfterExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { exercise_id: string; session_date?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ex, error: exErr } = await supabase
      .from("training_exercises")
      .select(
        "id, name, day_id, target_sets, target_reps, target_weights, set_type, target_rir, training_days(plan_id, day_date, sort_order)",
      )
      .eq("id", data.exercise_id)
      .maybeSingle();
    if (exErr || !ex) throw new Error(exErr?.message ?? "Übung nicht gefunden");
    if ((ex as any).set_type && (ex as any).set_type !== "working") {
      return { ok: true as const, skipped: "not_working_set" as const };
    }

    const day = (ex as any).training_days;
    if (!day?.plan_id) return { ok: true as const, skipped: "no_plan" as const };

    const date = data.session_date ?? day.day_date ?? new Date().toISOString().slice(0, 10);
    const dayStart = new Date(date + "T00:00:00Z").toISOString();
    const dayEnd = new Date(new Date(date + "T00:00:00Z").getTime() + 86400000).toISOString();

    const { data: logs, error: logErr } = await supabase
      .from("training_set_logs")
      .select("set_number, weight_kg, reps, rpe")
      .eq("exercise_id", data.exercise_id)
      .eq("client_id", userId)
      .gte("performed_at", dayStart)
      .lt("performed_at", dayEnd)
      .order("set_number", { ascending: true });
    if (logErr) throw new Error(logErr.message);

    const sets: LoggedSet[] = ((logs as any[]) ?? []).map((r) => ({
      set_number: Number(r.set_number ?? 0),
      weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
      reps: r.reps == null ? null : Number(r.reps),
      rpe: r.rpe == null ? null : Number(r.rpe),
    }));

    if (sets.length === 0) {
      return { ok: true as const, skipped: "no_working_sets" as const };
    }

    const rawDecision = progressExerciseAfterSession({
      exerciseName: String((ex as any).name ?? ""),
      sets,
      repRange: String((ex as any).target_reps ?? "8-12"),
      targetSets: Number((ex as any).target_sets ?? sets.length ?? 3),
      targetRir: (ex as any).target_rir ?? null,
    });
    const checkins = await loadRecentCheckins(supabase, userId);
    const gate = evaluateReadinessGate(checkins);
    const gated = applyReadinessGateWithMeta(rawDecision, gate);
    const decision = gated.decision;

    // Nächste Instanz derselben Übung im selben Plan finden (nachfolgende Tage)
    const currentSort = Number(day.sort_order ?? 0);
    const { data: nextDayRows } = await supabase
      .from("training_days")
      .select("id, sort_order, training_exercises(id, name, set_type, target_weights, target_reps)")
      .eq("plan_id", day.plan_id)
      .gt("sort_order", currentSort)
      .order("sort_order", { ascending: true })
      .limit(60);

    let nextExerciseId: string | null = null;
    const currentName = String((ex as any).name ?? "")
      .toLowerCase()
      .trim();
    for (const d of (nextDayRows as any[]) ?? []) {
      for (const e of d.training_exercises ?? []) {
        if ((e.set_type ?? "working") !== "working") continue;
        if (
          String(e.name ?? "")
            .toLowerCase()
            .trim() === currentName
        ) {
          nextExerciseId = e.id;
          break;
        }
      }
      if (nextExerciseId) break;
    }

    const changesLoad =
      decision.action === "increase_load" ||
      decision.action === "reduce_load" ||
      decision.action === "keep_load";
    const changesReps = decision.action === "increase_reps_target";

    if (
      nextExerciseId &&
      ((changesLoad && decision.next_target_weights) || (changesReps && decision.next_target_reps))
    ) {
      const patch: Record<string, unknown> = { notes: decision.reason };
      if (decision.next_target_weights) patch.target_weights = decision.next_target_weights;
      if (decision.next_target_reps) patch.target_reps = decision.next_target_reps;
      await supabase
        .from("training_exercises")
        .update(patch as any)
        .eq("id", nextExerciseId);
    }

    await supabase.from("training_progression_events").insert({
      client_id: userId,
      source_exercise_id: data.exercise_id,
      source_day_id: (ex as any).day_id ?? null,
      source_session_date: date,
      applied_to_exercise_id: nextExerciseId,
      decision: decision.action,
      previous_load: decision.previous_load,
      next_load: decision.next_load,
      previous_target_weights: (ex as any).target_weights ?? null,
      next_target_weights: decision.next_target_weights,
      previous_target_reps: (ex as any).target_reps ?? null,
      next_target_reps: decision.next_target_reps,
      reason: decision.reason,
      readiness_gate: gated.applied,
      readiness_gate_reason: gated.reason,
    } as any);

    return {
      ok: true as const,
      decision,
      applied_to_exercise_id: nextExerciseId,
    };
  });

/**
 * Session-Complete-Trigger. Beim Klick auf „Einheit abschließen":
 *  1. Alle Working-Übungen des Trainingstags laden
 *  2. Nur solche mit mind. einem geloggten Working-Set am Session-Datum
 *  3. Für jede Übung Smart-Progression auswerten
 *  4. Erst dann `training_day_completions` markieren
 * Kein zweiter Progressions-Trigger, keine Nachbearbeitung der Session.
 */
export const completeTrainingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { day_id: string; session_date?: string; timezone_offset_minutes?: number }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const date = data.session_date ?? new Date().toISOString().slice(0, 10);
    const timezoneOffsetMinutes = Number.isFinite(data.timezone_offset_minutes)
      ? Math.max(-840, Math.min(840, Number(data.timezone_offset_minutes)))
      : 0;
    // Date#getTimezoneOffset is UTC - local time. Adding it to local midnight
    // produces the matching UTC boundary (e.g. Berlin summer: -120 minutes).
    const dayStartMs = new Date(date + "T00:00:00Z").getTime() + timezoneOffsetMinutes * 60_000;
    const dayStart = new Date(dayStartMs).toISOString();
    const dayEnd = new Date(dayStartMs + 86_400_000).toISOString();

    const { data: dayEx, error: dayErr } = await supabase
      .from("training_exercises")
      .select(
        "id, name, set_type, target_sets, target_reps, target_weights, target_rir, smart_lock, day_id, training_days!inner(plan_id, sort_order, day_date)",
      )
      .eq("day_id", data.day_id)
      .order("sort_order", { ascending: true });
    if (dayErr) throw new Error(dayErr.message);

    const workingEx = ((dayEx as any[]) ?? []).filter(
      (e) => (e.set_type ?? "working") === "working",
    );
    if (workingEx.length === 0) {
      return { ok: true as const, evaluated: 0, decisions: [] as any[], skipped: "no_exercises" };
    }

    const exerciseIds = workingEx.map((e) => e.id as string);
    const { data: logs, error: logErr } = await supabase
      .from("training_set_logs")
      .select("exercise_id, set_number, weight_kg, reps, rpe")
      .in("exercise_id", exerciseIds)
      .eq("client_id", userId)
      .gte("performed_at", dayStart)
      .lt("performed_at", dayEnd);
    if (logErr) throw new Error(logErr.message);

    const setsByExercise = new Map<string, LoggedSet[]>();
    for (const r of (logs as any[]) ?? []) {
      const id = String(r.exercise_id);
      const arr = setsByExercise.get(id) ?? [];
      arr.push({
        set_number: Number(r.set_number ?? 0),
        weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
        reps: r.reps == null ? null : Number(r.reps),
        rpe: r.rpe == null ? null : Number(r.rpe),
      });
      setsByExercise.set(id, arr);
    }

    const decisions: Array<{
      exercise_id: string;
      exercise_name: string;
      action: string;
      previous_load: number | null;
      next_load: number | null;
      reason: string;
      applied_to_exercise_id: string | null;
    }> = [];

    // Readiness einmal pro Session-Complete laden — dient als zentrale Bremse
    // für alle Übungs-Progressionen dieses Tags. Phase 6: zusätzlich die
    // harten Gate-Daten der letzten 7 Tage laden, um Confidence auch nach
    // dem akuten Gate im Cooldown gedeckelt zu halten.
    const checkins = await loadRecentCheckins(supabase, userId);
    const gate = evaluateReadinessGate(checkins);
    const hardGateDates = await loadRecentHardGateDates(supabase, userId);
    const cooldownActive = readinessCooldownActive(hardGateDates);

    for (const ex of workingEx) {
      const sets = (setsByExercise.get(ex.id) ?? []).sort((a, b) => a.set_number - b.set_number);
      if (sets.length === 0) continue;

      const rawDecision = progressExerciseAfterSession({
        exerciseName: String(ex.name ?? ""),
        sets,
        repRange: String(ex.target_reps ?? "8-12"),
        targetSets: Number(ex.target_sets ?? sets.length ?? 3),
        targetRir: ex.target_rir ?? null,
      });
      const gated = applyReadinessGateWithMeta(rawDecision, gate);
      const { applySmartLock } = await import("./training-engine/lock");
      const decision = applySmartLock(gated.decision, (ex as any).smart_lock ?? "none");

      const planId = ex.training_days?.plan_id;
      const currentSort = Number(ex.training_days?.sort_order ?? 0);
      let nextExerciseId: string | null = null;
      if (planId) {
        const { data: nextDayRows } = await supabase
          .from("training_days")
          .select("id, sort_order, training_exercises(id, name, set_type)")
          .eq("plan_id", planId)
          .gt("sort_order", currentSort)
          .order("sort_order", { ascending: true })
          .limit(60);
        const currentName = String(ex.name ?? "")
          .toLowerCase()
          .trim();
        for (const d of (nextDayRows as any[]) ?? []) {
          for (const e of d.training_exercises ?? []) {
            if ((e.set_type ?? "working") !== "working") continue;
            if (
              String(e.name ?? "")
                .toLowerCase()
                .trim() === currentName
            ) {
              nextExerciseId = e.id;
              break;
            }
          }
          if (nextExerciseId) break;
        }
      }

      const changesLoad =
        decision.action === "increase_load" ||
        decision.action === "reduce_load" ||
        decision.action === "keep_load";
      const changesReps = decision.action === "increase_reps_target";

      if (
        nextExerciseId &&
        ((changesLoad && decision.next_target_weights) ||
          (changesReps && decision.next_target_reps))
      ) {
        const patch: Record<string, unknown> = { notes: decision.reason };
        if (decision.next_target_weights) patch.target_weights = decision.next_target_weights;
        if (decision.next_target_reps) patch.target_reps = decision.next_target_reps;
        await supabase
          .from("training_exercises")
          .update(patch as any)
          .eq("id", nextExerciseId);
      }

      await supabase.from("training_progression_events").insert({
        client_id: userId,
        source_exercise_id: ex.id,
        source_day_id: ex.day_id ?? null,
        source_session_date: date,
        applied_to_exercise_id: nextExerciseId,
        decision: decision.action,
        previous_load: decision.previous_load,
        next_load: decision.next_load,
        previous_target_weights: ex.target_weights ?? null,
        next_target_weights: decision.next_target_weights,
        previous_target_reps: ex.target_reps ?? null,
        next_target_reps: decision.next_target_reps,
        reason: decision.reason,
        readiness_gate: gated.applied,
        readiness_gate_reason: gated.reason,
      } as any);

      // --- Update athlete_exercise_state (living plan brain) ---
      const exerciseName = String(ex.name ?? "");
      const key = normalizeExerciseKey(exerciseName);
      if (key) {
        const gateActive = gated.applied !== null;
        const mapped = stateFromDecision({
          exerciseName,
          repRange: String(ex.target_reps ?? "8-12"),
          decision,
          readiness: {
            gateActive,
            cooldownActive,
            gateSeverity: gated.applied,
          },
        });
        // Verzahnung mit Readiness-Gate: bei aktivem Gate zählt die Session
        // NICHT als Progressions-Erfolg — der lebendige Plan-Wert
        // (Confidence/Trend/Streak) soll durch bewusst gehaltene Sessions
        // nicht künstlich verbessert werden.
        const isSuccess =
          !gateActive &&
          (decision.action === "increase_load" || decision.action === "increase_reps_target");
        const isFailure = decision.action === "reduce_load" || decision.action === "reduce_volume";
        const currentLoad =
          decision.action === "increase_load"
            ? decision.next_load
            : (decision.previous_load ?? decision.next_load);

        if (gateActive) {
          mapped.progression_status = "holding";
          mapped.last_reason = `🛡️ Readiness-Gate (${gated.applied}): ${gated.reason ?? mapped.last_reason}`;
        } else if (cooldownActive) {
          mapped.last_reason = `⏳ Gate-Cooldown aktiv (7d Nachwirkung) — ${mapped.last_reason}`;
        }

        const { data: prev } = await supabase
          .from("athlete_exercise_state")
          .select("id, successful_sessions, failed_sessions")
          .eq("user_id", userId)
          .eq("exercise_key", key)
          .maybeSingle();

        const prevRow = prev as any;
        const successful = Number(prevRow?.successful_sessions ?? 0) + (isSuccess ? 1 : 0);
        const failed = Number(prevRow?.failed_sessions ?? 0) + (isFailure ? 1 : 0);

        await supabase.from("athlete_exercise_state").upsert(
          {
            user_id: userId,
            exercise_key: key,
            exercise_name: exerciseName,
            current_working_load: currentLoad,
            recommended_next_load: mapped.recommended_next_load,
            target_rep_min: mapped.target_rep_min,
            target_rep_max: mapped.target_rep_max,
            progression_status: mapped.progression_status,
            confidence: mapped.confidence,
            trend: mapped.trend,
            successful_sessions: successful,
            failed_sessions: failed,
            last_completed_at: new Date().toISOString(),
            last_decision: mapped.last_decision,
            last_reason: mapped.last_reason,
          } as any,
          { onConflict: "user_id,exercise_key" },
        );
      }

      decisions.push({
        exercise_id: ex.id,
        exercise_name: String(ex.name ?? ""),
        action: decision.action,
        previous_load: decision.previous_load,
        next_load: decision.next_load,
        reason: decision.reason,
        applied_to_exercise_id: nextExerciseId,
      });
    }

    await supabase.from("training_day_completions").upsert(
      {
        client_id: userId,
        day_id: data.day_id,
        completion_date: date,
        exercises_evaluated: decisions.length,
        completed_at: new Date().toISOString(),
      } as any,
      { onConflict: "client_id,day_id,completion_date" },
    );

    return { ok: true as const, evaluated: decisions.length, decisions };
  });

/**
 * Ergänzt eine EIGENE Übung des Kunden zu einem bestehenden Trainingstag.
 * Der Coach-Plan bleibt unverändert – die Übung wird über `added_by_user`
 * dem Kunden zugeordnet, damit sie später auch von ihm selbst gelöscht
 * werden kann.
 */
export const addOwnTrainingExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      day_id: string;
      name: string;
      target_sets?: number | null;
      target_reps?: string | null;
      target_weights?: string | null;
      rest_seconds?: number | null;
      notes?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const name = String(data.name ?? "")
      .trim()
      .slice(0, 200);
    if (!name) throw new Error("Bitte gib einen Übungsnamen ein.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify the day belongs to a plan owned by this user.
    const { data: dayRow, error: dayErr } = await supabaseAdmin
      .from("training_days")
      .select("id, plan_id, nutrition_plans!inner(client_id)")
      .eq("id", data.day_id)
      .maybeSingle();
    if (dayErr || !dayRow) throw new Error("Trainingstag nicht gefunden.");
    const clientId = (dayRow as any).nutrition_plans?.client_id;
    if (clientId !== userId) {
      throw new Error("Du kannst nur zu deinem eigenen Plan Übungen ergänzen.");
    }

    // Next sort order at end of day.
    const { data: sortRow } = await supabaseAdmin
      .from("training_exercises")
      .select("sort_order")
      .eq("day_id", data.day_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = ((sortRow as any)?.sort_order ?? -1) + 1;

    const sets = Number.isFinite(Number(data.target_sets))
      ? Math.max(1, Math.min(20, Math.round(Number(data.target_sets))))
      : 3;
    const rest = Number.isFinite(Number(data.rest_seconds))
      ? Math.max(15, Math.min(600, Math.round(Number(data.rest_seconds))))
      : 90;

    const { data: row, error } = await supabaseAdmin
      .from("training_exercises")
      .insert({
        day_id: data.day_id,
        name,
        target_sets: sets,
        target_reps: data.target_reps ? String(data.target_reps).slice(0, 80) : "8",
        target_weights: data.target_weights ? String(data.target_weights).slice(0, 120) : null,
        rest_seconds: rest,
        notes: data.notes ? String(data.notes).slice(0, 500) : null,
        sort_order: nextSort,
        added_by_user: userId,
      } as any)
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Konnte Übung nicht anlegen.");
    return row;
  });

/**
 * Löscht eine vom Kunden selbst hinzugefügte Übung. Coach-Übungen bleiben
 * unantastbar – die serverseitige Prüfung stellt sicher, dass nur eigene
 * Ergänzungen entfernt werden können.
 */
export const deleteOwnTrainingExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { exercise_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ex, error } = await supabaseAdmin
      .from("training_exercises")
      .select("id, added_by_user")
      .eq("id", data.exercise_id)
      .maybeSingle();
    if (error || !ex) throw new Error("Übung nicht gefunden.");
    if ((ex as any).added_by_user !== userId) {
      throw new Error("Nur eigene Übungen können gelöscht werden.");
    }
    const { error: delErr } = await supabaseAdmin
      .from("training_exercises")
      .delete()
      .eq("id", data.exercise_id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });
