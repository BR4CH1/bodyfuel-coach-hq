import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { authenticatedMcpClient, requireCoach, toolError } from "@/lib/mcp/coach-access";
import { reactivateCoachTrainingPlan } from "@/lib/mcp/coach-training-plan-write";

export default defineTool({
  name: "coach_reactivate_training_plan",
  title: "Reactivate archived BodyFuel training plan",
  description:
    "Coach-only write action that reactivates an archived personal BodyFuel training plan. By default it refuses to replace an existing active plan; replace_active must be set explicitly to archive and replace it.",
  inputSchema: {
    plan_id: z.string().uuid().describe("Archived training plan UUID."),
    replace_active: z
      .boolean()
      .default(false)
      .describe("Explicitly archive an existing active personal training plan before reactivation."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ plan_id, replace_active }, ctx: ToolContext) => {
    const client = authenticatedMcpClient(ctx);
    if (!client) return toolError("Not authenticated");

    try {
      if (!(await requireCoach(client, ctx))) return toolError("Coach role required");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const plan = await reactivateCoachTrainingPlan(supabaseAdmin, {
        planId: plan_id,
        replaceActive: replace_active,
      });
      const payload = {
        ok: true,
        plan_id: plan.id,
        client_id: plan.client_id,
        title: plan.title,
        status: plan.status,
        is_active: plan.is_active,
        scheduled_start_date: plan.scheduled_start_date,
        scheduled_end_date: plan.scheduled_end_date,
        activated_at: plan.activated_at,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    } catch (error) {
      console.error("mcp coach_reactivate_training_plan", error);
      return toolError(error instanceof Error ? error.message : "Training plan reactivation failed");
    }
  },
});
