import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

import type { Database } from "@/integrations/supabase/types";

export function authenticatedMcpClient(ctx: ToolContext): SupabaseClient<Database> | null {
  if (!ctx.isAuthenticated()) return null;

  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireCoach(
  client: SupabaseClient<Database>,
  ctx: ToolContext,
): Promise<string | null> {
  const userId = ctx.getUserId();
  if (!userId) return null;

  for (const role of ["coach", "platform_owner"] as const) {
    const { data, error } = await client.rpc("has_role", {
      _user_id: userId,
      _role: role,
    });

    if (error) throw new Error(`Coach access check failed for ${role}: ${error.message}`);
    if (data) return userId;
  }

  return null;
}

export function toolError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}
