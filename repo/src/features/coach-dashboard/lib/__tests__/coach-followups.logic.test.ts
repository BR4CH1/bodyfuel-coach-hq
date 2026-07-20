import { describe, expect, it } from "vitest";

import { buildCoachFollowUps } from "../coach-followups.logic";
import { buildCoachDashboardViewModel } from "../coach-dashboard.logic";
import type { CoachClient, CoachLead } from "../../types";

const today = new Date("2026-07-20T12:00:00.000Z");

function client(overrides: Partial<CoachClient> = {}): CoachClient {
  return {
    id: "client-1",
    display_name: "Alex Muster",
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

function lead(overrides: Partial<CoachLead> = {}): CoachLead {
  return {
    id: "lead-1",
    name: "Lea Beispiel",
    email: "lea@example.com",
    goal: "Muskelaufbau",
    created_at: "2026-07-20T09:00:00.000Z",
    ...overrides,
  };
}

describe("coach follow-up logic", () => {
  it("creates a personalized risk message for the highest-priority client", () => {
    const view = buildCoachDashboardViewModel(
      [
        client({
          id: "risk-1",
          display_name: "Robin Beispiel",
          last_checkin: null,
          last_weight_at: null,
          last_nutrition_at: null,
          last_training_at: null,
          nutrition_plan_end: "2026-07-18",
          kcal_dev: 650,
          plateau_days: 14,
        }),
      ],
      today,
    );

    const drafts = buildCoachFollowUps({ view, leads: [] });

    expect(drafts[0]).toMatchObject({
      category: "risk",
      recipientName: "Robin Beispiel",
      target: { kind: "customer", userId: "risk-1" },
    });
    expect(drafts[0].message).toContain("Hi Robin");
    expect(drafts[0].message).toContain("Wie läuft es aktuell bei dir?");
  });

  it("deduplicates a customer who appears in several warning categories", () => {
    const view = buildCoachDashboardViewModel(
      [
        client({
          id: "multi",
          last_checkin: null,
          last_weight_at: null,
          last_nutrition_at: null,
          last_training_at: null,
          nutrition_plan_end: "2026-07-18",
        }),
      ],
      today,
    );

    const drafts = buildCoachFollowUps({ view, leads: [], limit: 10 });

    expect(drafts.filter((draft) => draft.target.kind === "customer")).toHaveLength(1);
    expect(drafts[0].category).toBe("risk");
  });

  it("creates a lead reply with the requested goal", () => {
    const view = buildCoachDashboardViewModel([client()], today);
    const drafts = buildCoachFollowUps({ view, leads: [lead()] });

    expect(drafts[0]).toMatchObject({ category: "lead", recipientName: "Lea Beispiel" });
    expect(drafts[0].message).toContain("Muskelaufbau");
  });

  it("falls back to an open check-in reminder", () => {
    const view = buildCoachDashboardViewModel(
      [client({ id: "open", display_name: "Sam", last_checkin: "2026-07-13" })],
      today,
    );

    const drafts = buildCoachFollowUps({ view, leads: [] });

    expect(drafts[0]).toMatchObject({ category: "checkin", recipientName: "Sam" });
    expect(drafts[0].message).toContain("Wochen-Check-in ist noch offen");
  });

  it("respects the configured result limit", () => {
    const view = buildCoachDashboardViewModel(
      [
        client({ id: "one", last_checkin: "2026-07-13" }),
        client({ id: "two", display_name: "Two", last_checkin: "2026-07-13" }),
      ],
      today,
    );

    const drafts = buildCoachFollowUps({ view, leads: [lead()], limit: 2 });

    expect(drafts).toHaveLength(2);
  });
});
