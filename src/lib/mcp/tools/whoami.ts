import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

import { authenticatedMcpClient } from "@/lib/mcp/coach-access";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Returns the signed-in BODYFUEL user's profile (name, role, goal).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx: ToolContext) => {
    const sb = authenticatedMcpClient(ctx);
    if (!sb) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const userId = ctx.getUserId();
    if (!userId) {
      return { content: [{ type: "text", text: "Authenticated user ID missing" }], isError: true };
    }
    const { data, error } = await sb
      .from("profiles")
      .select("display_name,nickname,coaching_goal,training_goal,height_cm,activity_level")
      .eq("id", userId)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ email: ctx.getUserEmail(), ...data }) }],
      structuredContent: { email: ctx.getUserEmail(), profile: data },
    };
  },
});
