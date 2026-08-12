import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/integrations/supabase/types";
import { requireCoach } from "../coach-access";

function contextWithUser(userId: string | undefined): ToolContext {
  return { getUserId: () => userId } as ToolContext;
}

function clientWithRoleResults(
  ...results: Array<{ data: boolean; error: null | { message: string } }>
) {
  return {
    rpc: vi.fn().mockImplementation(() => Promise.resolve(results.shift())),
  } as unknown as SupabaseClient<Database>;
}

describe("MCP coach access", () => {
  it("accepts a global coach", async () => {
    const client = clientWithRoleResults({ data: true, error: null });

    await expect(requireCoach(client, contextWithUser("coach-1"))).resolves.toBe("coach-1");
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("has_role", {
      _user_id: "coach-1",
      _role: "coach",
    });
  });

  it("accepts a platform owner as a platform coach", async () => {
    const client = clientWithRoleResults({ data: false, error: null }, { data: true, error: null });

    await expect(requireCoach(client, contextWithUser("owner-1"))).resolves.toBe("owner-1");
    expect(client.rpc).toHaveBeenNthCalledWith(2, "has_role", {
      _user_id: "owner-1",
      _role: "platform_owner",
    });
  });

  it("rejects users without a global coach role", async () => {
    const client = clientWithRoleResults(
      { data: false, error: null },
      { data: false, error: null },
    );

    await expect(requireCoach(client, contextWithUser("client-1"))).resolves.toBeNull();
  });

  it("rejects an authenticated context without a user id", async () => {
    const client = clientWithRoleResults({ data: true, error: null });

    await expect(requireCoach(client, contextWithUser(undefined))).resolves.toBeNull();
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
