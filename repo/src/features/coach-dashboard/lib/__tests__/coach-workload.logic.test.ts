import { describe, expect, it } from "vitest";
import { buildCoachWorkload } from "../coach-workload.logic";
import type { CoachDashboardViewModel } from "../../types";

function view(overrides: Partial<CoachDashboardViewModel> = {}): CoachDashboardViewModel {
  return {
    weekStart: "2026-07-20",
    openWeek: [],
    inactive: [],
    recentMeasurements: [],
    recentNutrition: [],
    recentTraining: [],
    expiringPlans: [],
    planOverview: [],
    scoreById: new Map(),
    scoreCounts: { green: 0, yellow: 0, red: 0 },
    redClients: [],
    ...overrides,
  };
}

describe("coach workload logic", () => {
  it("prioritizes risk clients", () => {
    const result = buildCoachWorkload(
      view({
        redClients: [
          {
            id: "1",
            display_name: "Mia",
            last_checkin: null,
            last_weight: null,
            last_weight_at: null,
            last_nutrition_at: null,
            last_nutrition_name: null,
            last_training_at: null,
            nutrition_plan_end: null,
            training_plan_end: null,
            kcal_dev: null,
            kcal_dev_dir: null,
            plateau_days: null,
            _score: { score: 10, level: "red", reasons: [] },
          },
        ],
      }),
      [],
    );
    expect(result.state).toBe("critical");
    expect(result.total).toBe(1);
  });

  it("only counts plans expiring within three days", () => {
    const result = buildCoachWorkload(
      view({
        expiringPlans: [
          { id: "1", name: "A", kind: "nutrition", end: "2026-07-21", days: 1 },
          { id: "2", name: "B", kind: "training", end: "2026-07-27", days: 7 },
        ],
      }),
      [],
    );
    expect(result.metrics.find((metric) => metric.label === "Pläne ≤ 3 Tage")?.value).toBe(1);
  });

  it("returns clear without open work", () => {
    expect(buildCoachWorkload(view(), []).state).toBe("clear");
  });
});
