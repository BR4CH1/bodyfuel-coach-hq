import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setCheckinCoachNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { checkin_id: string; coach_notes: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isCoach, error: rErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "coach",
    });
    if (rErr) throw new Error(rErr.message);
    if (!isCoach) throw new Error("Nicht autorisiert");

    const { error } = await context.supabase
      .from("weekly_checkins")
      .update({ coach_notes: data.coach_notes })
      .eq("id", data.checkin_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
