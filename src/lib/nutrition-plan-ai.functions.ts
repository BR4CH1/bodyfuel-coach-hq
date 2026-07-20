import { createServerFn } from "@tanstack/react-start";
import type {
  GenerateNutritionPlanInput,
  GenerateNutritionPlanOpts,
  NutritionPlanGenerationResult,
  NutritionPlanSupabaseClient,
} from "@/features/nutrition-plan-ai/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";

export type { GenerateNutritionPlanOpts } from "@/features/nutrition-plan-ai/types";

/**
 * Creates an AI-generated nutrition-plan draft for the authenticated user or
 * an athlete the current coach/staff member is allowed to manage.
 */
export const generateAiNutritionPlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: GenerateNutritionPlanInput) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const target = data.user_id;

    if (target !== userId) {
      await assertCoachOrOrgStaffForAthlete(context, target, "nutrition");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateAiNutritionPlanCore: generateCore } =
      await import("@/features/nutrition-plan-ai/server/generate-plan.server");

    return await generateCore(supabaseAdmin, {
      target,
      uploadedBy: userId,
      scheduled_start_date: data.scheduled_start_date ?? null,
      title: data.title,
      start_mode: data.start_mode,
      plan_days: data.plan_days ?? null,
      apiKey,
    });
  });

/**
 * Server-only compatibility wrapper used by autopilot and renewal jobs.
 * The implementation stays behind a dynamic import so this client-importable
 * server-function entry never pulls server modules into the browser bundle.
 */
export async function generateAiNutritionPlanCore(
  supabase: NutritionPlanSupabaseClient,
  opts: GenerateNutritionPlanOpts,
): Promise<NutritionPlanGenerationResult> {
  const { generateAiNutritionPlanCore: generateCore } =
    await import("@/features/nutrition-plan-ai/server/generate-plan.server");
  return await generateCore(supabase, opts);
}
