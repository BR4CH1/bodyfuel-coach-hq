/**
 * Client-facing Server-Funktionen für individuelle Athletik-Sessions.
 * Athleten lesen ihre Sessions und markieren Übungen/Session als erledigt.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyAthleticSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("athlete_training_session")
      .select(
        "id, session_date, focus, title, position_code, duration_min, exercises, status, progress, completed_at, team_id, organization_id",
      )
      .eq("user_id", userId);
    if (data.from) q = q.gte("session_date", data.from);
    if (data.to) q = q.lte("session_date", data.to);
    const { data: rows, error } = await q.order("session_date", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
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
