import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCoach(supabase: any, userId: string) {
  const { data: isCoach } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "coach",
  });
  if (!isCoach) throw new Error("Forbidden — Coach-Rolle erforderlich");
}

export type CoachTaskState = {
  task_key: string;
  completed_at: string | null;
  snoozed_until: string | null;
  note: string | null;
};

export const listCoachTaskStates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: CoachTaskState[] }> => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);
    const { data, error } = await supabase
      .from("coach_task_state")
      .select("task_key, completed_at, snoozed_until, note")
      .eq("coach_id", userId);
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as CoachTaskState[] };
  });

export const setCoachTaskState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      task_key: string;
      action: "complete" | "reopen" | "snooze";
      snooze_hours?: number;
      note?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);

    const patch: {
      coach_id: string;
      task_key: string;
      completed_at: string | null;
      snoozed_until: string | null;
      note?: string | null;
    } = {
      coach_id: userId,
      task_key: data.task_key,
      completed_at: null,
      snoozed_until: null,
    };

    if (data.action === "complete") {
      patch.completed_at = new Date().toISOString();
    } else if (data.action === "snooze") {
      const hours = Math.max(1, Math.min(168, data.snooze_hours ?? 24));
      patch.snoozed_until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    }
    if (typeof data.note === "string") patch.note = data.note;

    const { error } = await supabase
      .from("coach_task_state")
      .upsert(patch, { onConflict: "coach_id,task_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const extendClientPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      client_id: string;
      kind: "nutrition" | "training";
      weeks: number;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);
    const weeks = Math.max(1, Math.min(26, data.weeks));

    const { data: plans, error: loadErr } = await supabase
      .from("nutrition_plans")
      .select("id, scheduled_end_date, weeks_count")
      .eq("client_id", data.client_id)
      .eq("plan_type", data.kind)
      .eq("status", "active");
    if (loadErr) throw new Error(loadErr.message);
    if (!plans || plans.length === 0)
      throw new Error("Kein aktiver Plan gefunden.");

    const today = new Date();
    let newEnd = "";
    for (const p of plans) {
      const base = p.scheduled_end_date ? new Date(p.scheduled_end_date) : today;
      const ref = base.getTime() < today.getTime() ? today : base;
      const next = new Date(ref.getTime() + weeks * 7 * 86400000);
      newEnd = next.toISOString().slice(0, 10);
      const { error: updErr } = await supabase
        .from("nutrition_plans")
        .update({
          scheduled_end_date: newEnd,
          weeks_count: (p.weeks_count ?? 0) + weeks,
        })
        .eq("id", p.id);
      if (updErr) throw new Error(updErr.message);
    }
    return { ok: true, new_end: newEnd };
  });
