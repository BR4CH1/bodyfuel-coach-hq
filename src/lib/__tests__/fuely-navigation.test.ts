import { describe, expect, it } from "vitest";

import { resolveFuelyNavigationPath } from "@/lib/fuely-tools.server";

describe("Fuely navigation guard", () => {
  it("allows known personal BodyFuel areas", () => {
    expect(resolveFuelyNavigationPath("/training", null)).toBe("/training");
    expect(resolveFuelyNavigationPath("/{orgSlug}/checkin", null)).toBe("/check-in");
  });

  it("maps personal and placeholder links into the current organization", () => {
    expect(resolveFuelyNavigationPath("/training", "coesfeld-bulls")).toBe(
      "/coesfeld-bulls/training",
    );
    expect(resolveFuelyNavigationPath("/{orgSlug}/profil", "coesfeld-bulls")).toBe(
      "/coesfeld-bulls/profil",
    );
  });

  it("rejects external, traversal and cross-organization paths", () => {
    expect(resolveFuelyNavigationPath("https://example.com", null)).toBeNull();
    expect(resolveFuelyNavigationPath("/training/../coach", null)).toBeNull();
    expect(resolveFuelyNavigationPath("/other-org/training", "coesfeld-bulls")).toBeNull();
    expect(resolveFuelyNavigationPath("/training", "../coach")).toBeNull();
  });
});
