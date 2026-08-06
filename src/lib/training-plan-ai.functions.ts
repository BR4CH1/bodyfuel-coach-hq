import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";

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
    }) => d,
  )
  .handler(async ({ data, context }) => {
    // Smart-Gate: Free- und abgelaufene Trial-Nutzer haben hier keinen Zugriff.
    {
      const { assertSmartAccess } = await import("@/lib/entitlements.server");
      await assertSmartAccess(context.userId);
    }

    const { supabase, userId } = context;
    const target = data.user_id;

    if (target !== userId) {
      await assertCoachOrOrgStaffForAthlete(context, target, "training");
    }


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
