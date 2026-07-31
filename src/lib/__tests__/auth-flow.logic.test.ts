import { describe, expect, it } from "vitest";
import { determineHomeRoute, parseAuthLink, sanitizeInternalRedirect } from "@/lib/auth-flow.logic";

describe("invited customer auth flow", () => {
  it("parses query- and hash-based invite credentials", () => {
    expect(
      parseAuthLink("https://bodyfuel-coaching.com/welcome?code=pkce&type=invite"),
    ).toMatchObject({ code: "pkce", type: "invite", hasCredentials: true });
    expect(
      parseAuthLink(
        "https://bodyfuel-coaching.com/welcome#access_token=a&refresh_token=r&type=recovery",
      ),
    ).toMatchObject({
      accessToken: "a",
      refreshToken: "r",
      type: "recovery",
      hasCredentials: true,
    });
  });

  it("rejects external and auth-loop redirect targets", () => {
    expect(sanitizeInternalRedirect("https://evil.example/phish")).toBeUndefined();
    expect(sanitizeInternalRedirect("//evil.example/phish")).toBeUndefined();
    expect(sanitizeInternalRedirect("/welcome")).toBeUndefined();
    expect(sanitizeInternalRedirect("/dashboard?tab=training")).toBe("/dashboard?tab=training");
  });

  it("routes an invited coaching customer from database access", () => {
    const access = {
      isPlatformCoach: false,
      personalBodyfuelAccess: true,
      freeAccess: false,
      organizationMemberships: [],
    };
    expect(determineHomeRoute(access, 0)).toBe("/measurements");
    expect(determineHomeRoute(access, 1)).toBe("/dashboard");
  });

  it("routes coaches before customer contexts", () => {
    expect(
      determineHomeRoute(
        {
          isPlatformCoach: true,
          personalBodyfuelAccess: true,
          freeAccess: false,
          organizationMemberships: [],
        },
        1,
      ),
    ).toBe("/coach");
  });
});
