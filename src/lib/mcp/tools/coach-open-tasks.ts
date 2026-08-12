import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { loadCoachDashboardDataForClient } from "@/features/coach-dashboard/lib/coach-dashboard.data";
import { authenticatedMcpClient, requireCoach, toolError } from "@/lib/mcp/coach-access";
import { buildOpenTasksPayload } from "@/lib/mcp/coach-report";

export default defineTool({
  name: "coach_open_tasks",
  title: "BodyFuel open coach tasks",
  description:
    "Returns prioritized read-only coach tasks from live BodyFuel Coaching data, including customer or lead names and the reason for action.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(15).describe("Maximum tasks to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx: ToolContext) => {
    const client = authenticatedMcpClient(ctx);
    if (!client) return toolError("Not authenticated");

    try {
      if (!(await requireCoach(client, ctx))) return toolError("Coach role required");
      const data = await loadCoachDashboardDataForClient(client, { strict: true });
      const payload = buildOpenTasksPayload(data, { limit });
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    } catch (error) {
      console.error("mcp coach_open_tasks", error);
      return toolError("BodyFuel coach tasks are temporarily unavailable");
    }
  },
});
