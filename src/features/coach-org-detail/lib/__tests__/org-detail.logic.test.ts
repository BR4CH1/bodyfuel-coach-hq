import { describe, expect, it } from "vitest";
import {
  canManageLoad,
  canManageOrganization,
  getCoachExperienceCopy,
  isFeatureEnabled,
  normalizeCoachOrgTab,
  resolveDisplayKpis,
} from "../org-detail.logic";

describe("org detail logic", () => {
  it("normalizes known hashes and falls back safely", () => {
    expect(normalizeCoachOrgTab("#athletes")).toBe("athletes");
    expect(normalizeCoachOrgTab("ranking")).toBe("ranking");
    expect(normalizeCoachOrgTab("#unknown-tab")).toBe("cockpit");
    expect(normalizeCoachOrgTab(null)).toBe("cockpit");
  });

  it("returns the correct experience copy", () => {
    expect(getCoachExperienceCopy("org_admin").label).toBe("Vereinsleitung");
    expect(getCoachExperienceCopy("head_coach").label).toBe("Head Coach");
    expect(getCoachExperienceCopy("something-new").label).toBe("Coach");
  });

  it("checks feature flags strictly", () => {
    const features = [
      { feature: "community", enabled: true },
      { feature: "load_management", enabled: false },
    ];
    expect(isFeatureEnabled(features, "community")).toBe(true);
    expect(isFeatureEnabled(features, "load_management")).toBe(false);
    expect(isFeatureEnabled(features, "training")).toBe(false);
  });

  it("uses team KPIs only when the selected team exists", () => {
    const input = {
      teamKpis: [
        {
          team_id: "team-1",
          athletes: 12,
          weekly_compliance: 88,
          pending_onboardings: 2,
        },
      ],
      totalAthletes: 30,
      weeklyCompliance: 71,
      pendingOnboardings: 5,
    };

    expect(resolveDisplayKpis({ ...input, activeTeamId: "team-1" })).toEqual({
      athletes: 12,
      compliance: 88,
      pendingOnboardings: 2,
    });
    expect(resolveDisplayKpis({ ...input, activeTeamId: "missing" })).toEqual({
      athletes: 30,
      compliance: 71,
      pendingOnboardings: 5,
    });
  });

  it("derives management permissions without duplicating route logic", () => {
    expect(canManageOrganization("org_admin", false)).toBe(true);
    expect(canManageOrganization("head_coach", false)).toBe(false);
    expect(canManageOrganization("staff", true)).toBe(true);

    expect(canManageLoad("team_coach", false)).toBe(true);
    expect(canManageLoad("staff", false)).toBe(false);
    expect(canManageLoad("staff", true)).toBe(true);
  });
});
