import { describe, expect, it } from "vitest";

import {
  buildCoachDashboardViewModel,
  calculateCoachScore,
  daysAgo,
  getPlanValidity,
  mondayOf,
} from "../coach-dashboard.logic";
import type { CoachClient } from "../../types";

const today = new Date("2026-07-20T12:00:00.000Z");

function client(overrides: Partial<CoachClient> = {}): CoachClient {
  return {
    id: "client-1",
    display_name: "Alex",
    last_checkin: "2026-07-20",
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

describe("coach dashboard logic", () => {
  it("resolves the dashboard week and relative days", () => {
    expect(mondayOf(today)).toBe("2026-07-20");
    expect(daysAgo("2026-07-18T12:00:00.000Z", today.getTime())).toBe(2);
    expect(daysAgo(null, today.getTime())).toBeNull();
  });

  it("keeps healthy clients green", () => {
    expect(calculateCoachScore(client(), "2026-07-20", today)).toEqual({
      score: 100,
      level: "green",
      reasons: [],
    });
  });

  it("combines missing activity, plan and nutrition risks into a red score", () => {
    const score = calculateCoachScore(
      client({
        last_checkin: null,
        last_weight_at: null,
        last_nutrition_at: null,
        last_training_at: null,
        nutrition_plan_end: "2026-07-18",
        training_plan_end: null,
        kcal_dev: 650,
        kcal_dev_dir: "over",
        plateau_days: 14,
      }),
      "2026-07-20",
      today,
    );

    expect(score.level).toBe("red");
    expect(score.score).toBe(5);
    expect(score.reasons).toEqual([
      "Noch nie eingecheckt",
      "Keine Aktivität",
      "kcal-Abweichung 650",
      "Plateau 14T",
      "Plan abgelaufen",
    ]);
  });

  it("builds sorted attention and activity collections", () => {
    const view = buildCoachDashboardViewModel(
      [
        client({ id: "current", display_name: "Current" }),
        client({
          id: "inactive",
          display_name: "Inactive",
          last_checkin: "2026-06-20",
          last_training_at: "2026-06-20T10:00:00.000Z",
          last_nutrition_at: null,
          last_weight_at: null,
          training_plan_end: "2026-07-22",
        }),
        client({
          id: "expired",
          display_name: "Expired",
          last_checkin: "2026-07-13",
          nutrition_plan_end: "2026-07-19",
          last_nutrition_at: "2026-07-19T12:00:00.000Z",
        }),
      ],
      today,
    );

    expect(view.openWeek.map((entry) => entry.id)).toEqual(["inactive", "expired"]);
    expect(view.inactive.map((entry) => entry.id)).toEqual(["inactive"]);
    expect(view.expiringPlans.map((plan) => `${plan.id}:${plan.kind}:${plan.days}`)).toEqual([
      "expired:nutrition:-1",
      "inactive:training:2",
    ]);
    expect(view.recentNutrition[0].id).toBe("current");
    expect(view.scoreCounts.green + view.scoreCounts.yellow + view.scoreCounts.red).toBe(3);
  });

  it("describes missing, expiring and expired plan validity", () => {
    expect(getPlanValidity(null, today)).toMatchObject({ endDate: null, note: "—" });
    expect(getPlanValidity("2026-07-20", today)).toMatchObject({
      days: 0,
      note: "läuft heute aus",
      warning: true,
    });
    expect(getPlanValidity("2026-07-18", today)).toMatchObject({
      days: -2,
      note: "abgelaufen (vor 2 T.)",
      warning: true,
    });
  });
});
