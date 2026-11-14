import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), render: vi.fn(async () => "rendered") }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: mocks }));
vi.mock("@react-email/components", () => ({ render: mocks.render }));
vi.mock("@/lib/email-templates/registry", () => ({ TEMPLATES: { "account-setup": { component: () => null, subject: "Zugang" } } }));
import { sendAccountSetupEmail } from "@/lib/account-setup.server";

let suppressed = false;
let used = false;
let storedToken: string | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  suppressed = false;
  used = false;
  storedToken = "existing-unsubscribe-token";
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) => {
    const chain: Record<string, any> = {};
    for (const method of ["select", "eq", "limit"]) chain[method] = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => ({ error: null, data:
      table === "suppressed_emails" ? (suppressed ? { id: "blocked" } : null) :
      table === "email_unsubscribe_tokens" ? (storedToken ? { token: storedToken, used_at: used ? "2026-11-14" : null } : null) :
      { token: "existing-account-link" },
    }));
    chain.insert = vi.fn(async () => ({ error: null }));
    chain.upsert = vi.fn(async (row: { token: string }) => { storedToken = row.token; return { error: null }; });
    return chain;
  });
});

describe("account setup email delivery", () => {
  it("includes the required stored unsubscribe token", async () => {
    await sendAccountSetupEmail("user-1", " Kunde@Example.com ", "Kunde");
    expect(mocks.rpc).toHaveBeenCalledWith("enqueue_email", expect.objectContaining({
      queue_name: "transactional_emails", payload: expect.objectContaining({
        to: "kunde@example.com", purpose: "transactional", unsubscribe_token: "existing-unsubscribe-token",
      }),
    }));
  });
  it("creates and reads back a token for a first invitation", async () => {
    storedToken = undefined;
    await sendAccountSetupEmail("user-1", "kunde@example.com");
    expect(storedToken).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.rpc.mock.calls[0][1].payload.unsubscribe_token).toBe(storedToken);
  });
  it("does not enqueue suppressed recipients", async () => {
    suppressed = true;
    await expect(sendAccountSetupEmail("user-1", "kunde@example.com")).rejects.toThrow("gesperrt");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not enqueue recipients whose unsubscribe token was used", async () => {
    used = true;
    await expect(sendAccountSetupEmail("user-1", "kunde@example.com")).rejects.toThrow("abgemeldet");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});