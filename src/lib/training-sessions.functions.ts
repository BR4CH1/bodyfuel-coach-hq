import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SessionType = "strength" | "cardio" | "class" | "mobility" | "sport" | "other";

export type LogTrainingSessionInput = {
  session_type: SessionType;
  name: string;
  session_date?: string; // YYYY-MM-DD, default today (UTC)
  duration_minutes?: number | null;
  intensity?: number | null; // 1..10
  sets?: number | null;
  reps?: string | null;
  weight_kg?: number | null;
  notes?: string | null;
};

const TYPES: SessionType[] = ["strength", "cardio", "class", "mobility", "sport", "other"];

export const logTrainingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: LogTrainingSessionInput) => d)
  .handler(async ({ data, context }) => {
    if (!TYPES.includes(data.session_type)) throw new Error("Ungültiger Typ");
    const name = (data.name ?? "").trim().slice(0, 120);
    if (!name) throw new Error("Name fehlt");

    const text = (v: string | null | undefined, max: number) =>
      v == null ? null : String(v).trim().slice(0, max) || null;
    const num = (v: number | null | undefined, min: number, max: number) => {
      if (v == null || v === ("" as any)) return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return Math.max(min, Math.min(max, n));
    };
    const intNum = (v: number | null | undefined, min: number, max: number) => {
      const n = num(v, min, max);
      return n == null ? null : Math.round(n);
    };

    const row = {
      client_id: context.userId,
      session_type: data.session_type,
      name,
      session_date: data.session_date ?? new Date().toISOString().slice(0, 10),
      duration_minutes: intNum(data.duration_minutes, 1, 600),
      intensity: intNum(data.intensity, 1, 10),
      sets: intNum(data.sets, 1, 30),
      reps: text(data.reps, 80),
      weight_kg: num(data.weight_kg, 0, 1000),
      notes: text(data.notes, 500),
    };

    const { data: ins, error } = await context.supabase
      .from("training_sessions")
      .insert(row as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Auto-tick the daily "Training" task so the streak/points stay in sync.
    try {
      const date = row.session_date;
      const { data: existing } = await context.supabase
        .from("daily_checks")
        .select("id, tasks")
        .eq("user_id", context.userId)
        .eq("check_date", date)
        .maybeSingle();
      const tasks: Record<string, boolean> = {
        ...(((existing as any)?.tasks as Record<string, boolean>) ?? {}),
        training: true,
      };
      if ((existing as any)?.id) {
        await context.supabase
          .from("daily_checks")
          .update({ tasks } as any)
          .eq("id", (existing as any).id);
      } else {
        await context.supabase
          .from("daily_checks")
          .insert({ user_id: context.userId, check_date: date, tasks } as any);
      }
    } catch {
      /* non-blocking */
    }

    return ins;
  });

export const listTrainingSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { client_id?: string; days?: number }) => d)
  .handler(async ({ data, context }) => {
    const target = data.client_id ?? context.userId;
    if (target !== context.userId) {
      const { data: isCoach } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "coach",
      });
      if (!isCoach) throw new Error("Forbidden");
    }
    const days = Math.max(1, Math.min(180, data.days ?? 30));
    const fromDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("training_sessions")
      .select("*")
      .eq("client_id", target)
      .gte("session_date", fromDate)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteTrainingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("training_sessions")
      .delete()
      .eq("id", data.id)
      .eq("client_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
