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

  it("routes organization athletes to their org home", () => {
    expect(
      determineHomeRoute(
        {
          isPlatformCoach: false,
          personalBodyfuelAccess: false,
          freeAccess: false,
          organizationMemberships: [
            {
              organizationId: "org-1",
              organizationSlug: "bulls",
              membershipStatus: "active",
              staffRole: null,
            },
          ],
        },
        0,
      ),
    ).toBe("/bulls/home");
  });

  it("never falls back into an auth redirect loop", () => {
    const fallback = determineHomeRoute(
      {
        isPlatformCoach: false,
        personalBodyfuelAccess: false,
        freeAccess: false,
        organizationMemberships: [],
      },
      0,
    );
    expect(fallback).toBe("/tracker/app");
    expect(["/app", "/welcome", "/auth", "/login"]).not.toContain(fallback);
  });

  it("ignores an external next parameter on the welcome link", () => {
    expect(
      parseAuthLink(
        "https://bodyfuel-coaching.com/welcome?code=pkce&next=https%3A%2F%2Fevil.example%2Fx",
      ).next,
    ).toBeUndefined();
    expect(
      parseAuthLink("https://bodyfuel-coaching.com/welcome?code=pkce&next=%2Fdashboard").next,
    ).toBe("/dashboard");
  });
});
