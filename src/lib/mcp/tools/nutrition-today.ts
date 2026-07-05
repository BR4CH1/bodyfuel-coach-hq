import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "nutrition_today",
  title: "Today's nutrition",
  description:
    "Returns the signed-in user's nutrition target and consumed kcal/macros for today.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (_input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const uid = ctx.getUserId();
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: target }, { data: entries }] = await Promise.all([
      sb
        .from("nutrition_targets")
        .select("kcal,protein_g,carbs_g,fat_g")
        .eq("user_id", uid)
        .maybeSingle(),
      sb
        .from("nutrition_entries")
        .select("kcal,protein_g,carbs_g,fat_g,name,meal_type,consumed_at")
        .eq("user_id", uid)
        .gte("consumed_at", `${today}T00:00:00`)
        .lte("consumed_at", `${today}T23:59:59`),
    ]);

    const sum = (entries ?? []).reduce(
      (a, e: any) => ({
        kcal: a.kcal + (e.kcal ?? 0),
        protein_g: a.protein_g + (e.protein_g ?? 0),
        carbs_g: a.carbs_g + (e.carbs_g ?? 0),
        fat_g: a.fat_g + (e.fat_g ?? 0),
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );

    const payload = { date: today, target, consumed: sum, entries: entries ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
