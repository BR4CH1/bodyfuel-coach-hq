/**
 * Client-facing Server-Funktionen für individuelle Athletik-Sessions.
 * Athleten lesen ihre Sessions und markieren Übungen/Session als erledigt.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Athleten-Kalender liest AUSSCHLIESSLICH aus der zentralen training_sessions-SoT.
 * Coach-Team-Trainings werden per Trigger (siehe Migration Phase 1b.1) aus
 * athlete_training_session in training_sessions materialisiert.
 * Mutationen (Übung erledigt/Session abgeschlossen) schreiben weiterhin auf
 * athlete_training_session; der Trigger spiegelt sie sofort zurück.
 */
const TS_STATUS_TO_ATS: Record<string, "scheduled" | "in_progress" | "completed" | "skipped"> = {
  planned: "scheduled",
  in_progress: "in_progress",
  completed: "completed",
  missed: "skipped",
  partially_completed: "in_progress",
};

export const getMyAthleticSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("training_sessions")
      .select(
        "source_ats_id, session_date, focus, name, duration_minutes, exercises, status, progress, completed_at, team_id, organization_id",
      )
      .eq("client_id", userId)
      .eq("training_source", "coach")
      .not("source_ats_id", "is", null);
    if (data.from) q = q.gte("session_date", data.from);
    if (data.to) q = q.lte("session_date", data.to);
    const { data: rows, error } = await q.order("session_date", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.source_ats_id,
      session_date: r.session_date,
      focus: r.focus,
      title: r.name,
      position_code: null,
      duration_min: r.duration_minutes,
      exercises: r.exercises ?? [],
      status: TS_STATUS_TO_ATS[r.status] ?? "scheduled",
      progress: r.progress ?? {},
      completed_at: r.completed_at,
      team_id: r.team_id,
      organization_id: r.organization_id,
    }));
  });

export const toggleAthleticExerciseDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string; exercise_id: string; done: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cur = await supabase
      .from("athlete_training_session")
      .select("id, user_id, progress, status")
      .eq("id", data.session_id)
      .maybeSingle();
    if (!cur.data || (cur.data as any).user_id !== userId) {
      throw new Error("Nicht gefunden.");
    }
    const progress = { ...((cur.data as any).progress ?? {}) };
    progress[data.exercise_id] = data.done
      ? { done: true, done_at: new Date().toISOString() }
      : { done: false };
    const status =
      (cur.data as any).status === "scheduled" && data.done ? "in_progress" : (cur.data as any).status;
    const { error } = await supabase
      .from("athlete_training_session")
      .update({ progress, status })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeAthleticSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cur = await supabase
      .from("athlete_training_session")
      .select("id, user_id")
      .eq("id", data.session_id)
      .maybeSingle();
    if (!cur.data || (cur.data as any).user_id !== userId) throw new Error("Nicht gefunden.");
    const { error } = await supabase
      .from("athlete_training_session")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
