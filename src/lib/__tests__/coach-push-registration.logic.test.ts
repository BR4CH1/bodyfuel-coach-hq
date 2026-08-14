import { describe, expect, it } from "vitest";

import { classifyRecentSelfRegistration } from "@/lib/coach-push-registration.logic";

const NOW = Date.parse("2026-08-14T19:00:00.000Z");

describe("classifyRecentSelfRegistration", () => {
  it("classifies a recent free self-registration", () => {
    expect(
      classifyRecentSelfRegistration(
        { created_at: "2026-08-14T18:59:00.000Z", user_metadata: { tier: "free" } },
        NOW,
      ),
    ).toBe("free");
  });

  it("uses recent email confirmation for delayed Smart activation", () => {
    expect(
      classifyRecentSelfRegistration(
        {
          created_at: "2026-08-10T10:00:00.000Z",
          email_confirmed_at: "2026-08-14T18:58:00.000Z",
          user_metadata: { tier: "smart" },
        },
        NOW,
      ),
    ).toBe("smart");
  });

  it("ignores admin invitations", () => {
    expect(
      classifyRecentSelfRegistration(
        {
          created_at: "2026-08-14T18:59:00.000Z",
          invited_at: "2026-08-14T18:58:00.000Z",
          user_metadata: { role: "client" },
        },
        NOW,
      ),
    ).toBeNull();
  });

  it("ignores explicitly coach-created accounts", () => {
    expect(
      classifyRecentSelfRegistration(
        {
          created_at: "2026-08-14T18:59:00.000Z",
          user_metadata: { tier: "free", created_via: "coach" },
        },
        NOW,
      ),
    ).toBeNull();
  });

  it("ignores stale existing accounts", () => {
    expect(
      classifyRecentSelfRegistration(
        { created_at: "2026-08-14T17:00:00.000Z", user_metadata: {} },
        NOW,
      ),
    ).toBeNull();
  });
});
