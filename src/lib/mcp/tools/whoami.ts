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
    const [{ data: profile, error: profileError }, { data: roleRows, error: rolesError }] =
      await Promise.all([
        sb
          .from("profiles")
          .select("display_name,nickname,coaching_goal,training_goal,height_cm,activity_level")
          .eq("id", userId)
          .maybeSingle(),
        sb.from("user_roles").select("role").eq("user_id", userId),
      ]);
    if (profileError) {
      return { content: [{ type: "text", text: profileError.message }], isError: true };
    }
    if (rolesError) {
      return { content: [{ type: "text", text: rolesError.message }], isError: true };
    }
    const roles = (roleRows ?? []).map((row) => row.role);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ email: ctx.getUserEmail(), roles, ...profile }),
        },
      ],
      structuredContent: { email: ctx.getUserEmail(), roles, profile },
    };
  },
});
