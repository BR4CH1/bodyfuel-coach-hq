import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * 4-Wochen-Smart-Trainingsplan (User-Endpoint).
 * Delegiert die eigentliche Generierung an `training-plan-ai-core.server.ts`.
 */
export const generateAiTrainingPlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      user_id: string;
      title?: string;
      start_mode?: "today" | "next_week";
      auto?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data.user_id;

    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId, _role: "coach",
    });
    if (target !== userId && !isCoach && !data.auto) throw new Error("Forbidden");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const { generateTrainingPlanCore } = await import("./training-plan-ai-core.server");
    return await generateTrainingPlanCore(supabase, {
      target,
      uploadedBy: userId,
      title: data.title,
      startMode: data.start_mode ?? "today",
      apiKey,
    });
  });
