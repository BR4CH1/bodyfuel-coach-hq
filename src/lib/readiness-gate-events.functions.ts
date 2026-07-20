import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReadinessGateEvent = {
  id: string;
  source_session_date: string;
  evaluated_at: string;
  decision: string;
  readiness_gate: "hold" | "reduce";
  readiness_gate_reason: string | null;
  exercise_name: string | null;
};

/**
 * Coach-Ansicht: Progressions-Events der letzten 14 Tage, bei denen das
 * Readiness-Gate die Entscheidung verändert hat. Wird im Coach Readiness-Tab
 * als kleine Historie angezeigt.
 */
export const listRecentReadinessGateEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string; days?: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;

    // Nur Coaches oder der Athlet selbst dürfen lesen.
    if (data.userId !== callerId) {
      const { data: isCoach } = await supabase.rpc("has_role", {
        _user_id: callerId,
        _role: "coach",
      });
      if (!isCoach) throw new Error("Forbidden");
    }

    const days = Math.min(60, Math.max(1, Number(data.days ?? 14)));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: rows, error } = await supabase
      .from("training_progression_events")
      .select(
        "id, source_session_date, evaluated_at, decision, readiness_gate, readiness_gate_reason, source_exercise_id, training_exercises:source_exercise_id(name)",
      )
      .eq("client_id", data.userId)
      .not("readiness_gate", "is", null)
      .gte("evaluated_at", since.toISOString())
      .order("evaluated_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);

    return ((rows as any[]) ?? []).map((r): ReadinessGateEvent => ({
      id: String(r.id),
      source_session_date: String(r.source_session_date),
      evaluated_at: String(r.evaluated_at),
      decision: String(r.decision),
      readiness_gate: r.readiness_gate,
      readiness_gate_reason: r.readiness_gate_reason ?? null,
      exercise_name: r.training_exercises?.name ?? null,
    }));
  });
