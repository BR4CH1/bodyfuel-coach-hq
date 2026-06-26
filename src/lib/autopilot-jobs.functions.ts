import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Liefert den neuesten Smart-Autopilot-Job des aktuellen Nutzers.
 * Wird vom Dashboard-Status-Card alle paar Sekunden gepollt.
 */
export const getMyAutopilotJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("smart_autopilot_jobs")
      .select(
        "id, status, step, nutrition_plan_id, training_plan_id, error, created_at, started_at, finished_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });

/**
 * Stellt einen neuen Autopilot-Job in die Warteschlange. Wird vom Onboarding
 * (nach Speichern der Pflichtdaten) und ggf. von Verlängerungs-Flows
 * aufgerufen. Existiert bereits ein offener Job, wird dessen ID zurückgegeben.
 */
export const enqueueAutopilotJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabase
      .from("smart_autopilot_jobs")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) return { job_id: existing.id, reused: true };

    const { data, error } = await supabaseAdmin
      .from("smart_autopilot_jobs")
      .insert({ user_id: userId, status: "pending", step: "nutrition" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { job_id: data.id, reused: false };
  });
