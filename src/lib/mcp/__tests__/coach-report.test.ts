import { describe, expect, it } from "vitest";

import type { CoachDashboardData } from "@/features/coach-dashboard/types";
import { buildBusinessSummaryPayload, buildOpenTasksPayload } from "../coach-report";

const NOW = new Date("2026-08-12T08:00:00.000Z");

const data: CoachDashboardData = {
  productCounts: { coaching: 2, smart: 7 },
  leads: [
    {
      id: "lead-1",
      name: "Lea",
      email: "lea@example.com",
      goal: "Abnehmen",
      created_at: NOW.toISOString(),
    },
  ],
  clients: [
    {
      id: "client-1",
      display_name: "Michelle",
      last_checkin: "2026-08-10",
      last_checkin_submitted_at: "2026-08-12T07:00:00.000Z",
      pending_checkin_week_start: "2026-08-10",
      pending_checkin_submitted_at: "2026-08-12T07:00:00.000Z",
      last_weight: null,
      last_weight_at: null,
      last_nutrition_at: null,
      last_nutrition_name: null,
      last_training_at: null,
      nutrition_plan_end: "2026-08-11",
      training_plan_end: null,
      kcal_dev: 650,
      kcal_dev_dir: "over",
      plateau_days: 14,
    },
    {
      id: "client-2",
      display_name: "Timo",
      last_checkin: "2026-08-10",
      last_checkin_submitted_at: "2026-08-10T07:00:00.000Z",
      pending_checkin_week_start: null,
      pending_checkin_submitted_at: null,
      last_weight: 82,
      last_weight_at: "2026-08-12T07:00:00.000Z",
      last_nutrition_at: "2026-08-12T07:00:00.000Z",
      last_nutrition_name: "Frühstück",
      last_training_at: "2026-08-12T07:00:00.000Z",
      nutrition_plan_end: "2026-09-01",
      training_plan_end: "2026-09-01",
      kcal_dev: null,
      kcal_dev_dir: null,
      plateau_days: null,
    },
  ],
};

describe("coach agent reports", () => {
  it("builds the morning business summary from dashboard rules", () => {
    const summary = buildBusinessSummaryPayload(data, NOW);

    expect(summary.products).toEqual({ coaching: 2, smart: 7 });
    expect(summary.leads.open).toBe(1);
    expect(summary.coaching.openCheckins).toBe(1);
    expect(summary.coaching.missingCheckins).toBe(0);
    expect(summary.coaching.expiringPlans).toBe(1);
    expect(summary.coaching.riskCustomers).toBe(1);
  });

  it("groups risk, check-in and plan work before leads", () => {
    const tasks = buildOpenTasksPayload(data, { limit: 10, now: NOW });

    expect(tasks.openTotal).toBeGreaterThan(0);
    expect(tasks.tasks[0]).toMatchObject({
      category: "risk",
      customerOrLead: "Michelle",
    });
    expect(tasks.tasks[0].reason).toContain("Ernährungsplan");
    expect(tasks.tasks.some((task) => task.category === "plan")).toBe(false);
    expect(tasks.tasks.some((task) => task.category === "lead")).toBe(true);
  });
});
