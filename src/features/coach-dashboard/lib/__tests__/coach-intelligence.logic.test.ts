import { expect, it } from "vitest";
import { buildCoachIntelligence } from "@/features/coach-dashboard/lib/coach-intelligence.logic";
import type { CoachClient, CoachDashboardViewModel } from "@/features/coach-dashboard/types";

const client: CoachClient = {
  id: "u1",
  display_name: "Manu",
  last_checkin: null,
  last_checkin_submitted_at: null,
  pending_checkin_week_start: null,
  pending_checkin_submitted_at: null,
  last_weight: 80,
  last_weight_at: null,
  last_nutrition_at: null,
  last_nutrition_name: null,
  last_training_at: null,
  nutrition_plan_end: null,
  training_plan_end: null,
  kcal_dev: null,
  kcal_dev_dir: null,
  plateau_days: 12,
};

const view: CoachDashboardViewModel = {
  weekStart: "2026-07-20",
  openWeek: [client],
  pendingCheckins: [],
  inactive: [{ ...client, days: 8 }],
  recentMeasurements: [],
  recentNutrition: [],
  recentTraining: [],
  expiringPlans: [],
  planOverview: [],
  scoreById: new Map(),
  scoreCounts: { green: 0, yellow: 0, red: 1 },
  redClients: [{ ...client, _score: { score: 21, level: "red", reasons: ["Check-in fehlt"] } }],
};

it("prioritizes stagnation, risk and attention signals", () => {
  const result = buildCoachIntelligence(view, [client]);
  expect(result.stagnating).toHaveLength(1);
  expect(result.atRisk).toHaveLength(1);
  expect(result.needsAttention).toHaveLength(0);
  expect(result.summary).toContain("2");
});

it("does not crash when the dashboard view or client list is unavailable", () => {
  expect(buildCoachIntelligence(undefined, undefined)).toEqual({
    title: "Coach Intelligence ist ruhig",
    summary: "Aktuell gibt es keine auffälligen Kundensignale.",
    stagnating: [],
    atRisk: [],
    needsAttention: [],
  });
});
