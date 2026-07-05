import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "log_weight",
  title: "Log a body-weight measurement",
  description:
    "Inserts a new body-weight measurement (kg) for the signed-in user, timestamped now.",
  inputSchema: {
    weight_kg: z.number().min(25).max(400).describe("Body weight in kg (25–400)."),
    body_fat_pct: z.number().min(2).max(70).optional().describe("Optional body-fat percentage."),
    notes: z.string().max(500).optional().describe("Optional short note."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ weight_kg, body_fat_pct, notes }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .from("body_measurements")
      .insert({
        user_id: ctx.getUserId(),
        weight_kg,
        body_fat_pct: body_fat_pct ?? null,
        notes: notes ?? null,
        measured_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Logged ${weight_kg} kg.` }],
      structuredContent: { row: data },
    };
  },
});
