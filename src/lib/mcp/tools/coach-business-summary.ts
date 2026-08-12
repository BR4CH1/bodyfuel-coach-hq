import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

import { loadCoachDashboardDataForClient } from "@/features/coach-dashboard/lib/coach-dashboard.data";
import { authenticatedMcpClient, requireCoach, toolError } from "@/lib/mcp/coach-access";
import { buildBusinessSummaryPayload } from "@/lib/mcp/coach-report";

export default defineTool({
  name: "coach_business_summary",
  title: "BodyFuel business summary",
  description:
    "Read-only BodyFuel coach overview: active Coaching and Smart customers, open leads, check-ins, expiring plans, inactivity, risks, and workload.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx: ToolContext) => {
    const client = authenticatedMcpClient(ctx);
    if (!client) return toolError("Not authenticated");

    try {
      if (!(await requireCoach(client, ctx))) return toolError("Coach role required");
      const data = await loadCoachDashboardDataForClient(client, { strict: true });
      const payload = buildBusinessSummaryPayload(data);
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    } catch (error) {
      console.error("mcp coach_business_summary", error);
      return toolError("BodyFuel coach summary is temporarily unavailable");
    }
  },
});
