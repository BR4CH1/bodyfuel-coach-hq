import { describe, expect, it } from "vitest";

import {
  assertIsoDate,
  assertPersonalTrainingPlan,
  berlinDateKey,
  type CoachTrainingPlanWriteRow,
} from "../coach-training-plan-write";

function plan(overrides: Partial<CoachTrainingPlanWriteRow> = {}): CoachTrainingPlanWriteRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    client_id: "22222222-2222-4222-8222-222222222222",
    title: "Training",
    plan_type: "training",
    performance_context: false,
    status: "archived",
    is_active: false,
    scheduled_start_date: "2026-07-17",
    scheduled_end_date: "2026-08-13",
    activated_at: "2026-07-17T12:00:00.000Z",
    archived_at: "2026-08-14T03:15:00.000Z",
    ...overrides,
  };
}

describe("coach training plan MCP write guards", () => {
  it("accepts valid ISO dates and rejects invalid calendar dates", () => {
    expect(assertIsoDate("2026-08-31")).toBe("2026-08-31");
    expect(() => assertIsoDate("31.08.2026")).toThrow(/YYYY-MM-DD/);
    expect(() => assertIsoDate("2026-02-31")).toThrow(/valid calendar date/);
  });

  it("uses the Europe/Berlin calendar day", () => {
    expect(berlinDateKey(new Date("2026-08-16T22:30:00.000Z"))).toBe("2026-08-17");
  });

  it("allows personal training plans", () => {
    expect(() => assertPersonalTrainingPlan(plan())).not.toThrow();
  });

  it("rejects nutrition and performance/team plans", () => {
    expect(() => assertPersonalTrainingPlan(plan({ plan_type: "nutrition" }))).toThrow(
      /not a training plan/,
    );
    expect(() => assertPersonalTrainingPlan(plan({ performance_context: true }))).toThrow(
      /Performance\/team/,
    );
  });
});
