import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { authenticatedMcpClient, requireCoach, toolError } from "@/lib/mcp/coach-access";
import { updateCoachTrainingPlanEndDate } from "@/lib/mcp/coach-training-plan-write";

export default defineTool({
  name: "coach_update_training_plan_end_date",
  title: "Update BodyFuel training plan end date",
  description:
    "Coach-only write action that changes the scheduled end date of a personal BodyFuel training plan. Performance/team plans are explicitly excluded.",
  inputSchema: {
    plan_id: z.string().uuid().describe("Training plan UUID."),
    scheduled_end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("New plan end date in YYYY-MM-DD format."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ plan_id, scheduled_end_date }, ctx: ToolContext) => {
    const client = authenticatedMcpClient(ctx);
    if (!client) return toolError("Not authenticated");

    try {
      if (!(await requireCoach(client, ctx))) return toolError("Coach role required");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const plan = await updateCoachTrainingPlanEndDate(supabaseAdmin, {
        planId: plan_id,
        scheduledEndDate: scheduled_end_date,
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
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    } catch (error) {
      console.error("mcp coach_update_training_plan_end_date", error);
      return toolError(error instanceof Error ? error.message : "Training plan update failed");
    }
  },
});
