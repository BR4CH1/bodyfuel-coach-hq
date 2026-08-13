import { describe, expect, it } from "vitest";

import { buildCoachBriefing } from "../coach-briefing.logic";
import { buildCoachDashboardViewModel } from "../coach-dashboard.logic";
import type { CoachClient, CoachLead } from "../../types";

const today = new Date("2026-07-20T12:00:00.000Z");

function client(overrides: Partial<CoachClient> = {}): CoachClient {
  return {
    id: "client-1",
    display_name: "Alex",
    last_checkin: "2026-07-20",
    last_checkin_submitted_at: "2026-07-20T07:00:00.000Z",
    pending_checkin_week_start: null,
    pending_checkin_submitted_at: null,
    last_weight: 80,
    last_weight_at: "2026-07-19T10:00:00.000Z",
    last_nutrition_at: "2026-07-20T08:00:00.000Z",
    last_nutrition_name: "Skyr",
    last_training_at: "2026-07-19T18:00:00.000Z",
    nutrition_plan_end: "2026-08-20",
    training_plan_end: "2026-08-20",
    kcal_dev: null,
    kcal_dev_dir: null,
    plateau_days: null,
    ...overrides,
  };
}

function lead(overrides: Partial<CoachLead> = {}): CoachLead {
  return {
    id: "lead-1",
    name: "Lea",
    email: "lea@example.com",
    goal: "Muskelaufbau",
    created_at: "2026-07-20T09:00:00.000Z",
    ...overrides,
  };
}

describe("coach briefing logic", () => {
  it("celebrates when there are no open priorities", () => {
    const view = buildCoachDashboardViewModel([client()], today);
    const briefing = buildCoachBriefing({
      view,
      leads: [],
      performancePending: 0,
      showPerformanceNavigation: false,
    });

    expect(briefing.state).toBe("clear");
    expect(briefing.items).toEqual([]);
    expect(briefing.emotion).toBe("celebrating");
  });

  it("puts the highest-risk client first", () => {
    const risky = client({
      id: "risk-1",
      display_name: "Robin",
      last_checkin: null,
      last_weight_at: null,
      last_nutrition_at: null,
      last_training_at: null,
      nutrition_plan_end: "2026-07-18",
      training_plan_end: null,
      kcal_dev: 650,
      kcal_dev_dir: "over",
      plateau_days: 14,
    });
    const view = buildCoachDashboardViewModel([risky], today);
    const briefing = buildCoachBriefing({
      view,
      leads: [],
      performancePending: 0,
      showPerformanceNavigation: false,
    });

    expect(briefing.state).toBe("urgent");
    expect(briefing.items[0]).toMatchObject({
      id: "risk-risk-1",
      title: "Robin zuerst prüfen",
      target: { kind: "customer", userId: "risk-1" },
    });
  });

  it("sorts actionable categories and limits the briefing to three items", () => {
    const view = buildCoachDashboardViewModel(
      [
        client({
          id: "expired",
          display_name: "Expired",
          last_checkin: "2026-07-13",
          nutrition_plan_end: "2026-07-19",
        }),
        client({
          id: "open",
          display_name: "Open",
          last_checkin: "2026-07-13",
          nutrition_plan_end: "2026-07-24",
        }),
      ],
      today,
    );

    const briefing = buildCoachBriefing({
      view,
      leads: [lead()],
      performancePending: 4,
      showPerformanceNavigation: true,
    });

    expect(briefing.items).toHaveLength(3);
    expect(briefing.items.map((item) => item.id)).toEqual([
      "expired-plans",
      "new-leads",
      "performance-checks",
    ]);
  });

  it("does not expose performance work without access", () => {
    const view = buildCoachDashboardViewModel([client()], today);
    const briefing = buildCoachBriefing({
      view,
      leads: [],
      performancePending: 5,
      showPerformanceNavigation: false,
    });

    expect(briefing.items.some((item) => item.id === "performance-checks")).toBe(false);
  });
});
