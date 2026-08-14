import { describe, expect, it } from "vitest";

import { buildCoachTodayQueue, filterCoachTodayQueue } from "../coach-today.logic";
import type {
  CoachIntelligenceViewModel,
  CoachWorkloadViewModel,
} from "../../types";

const emptyIntelligence: CoachIntelligenceViewModel = {
  title: "",
  summary: "",
  stagnating: [],
  atRisk: [],
  needsAttention: [],
};

function workload(overrides: Partial<CoachWorkloadViewModel> = {}): CoachWorkloadViewModel {
  return {
    state: "steady",
    title: "",
    summary: "",
    total: 0,
    metrics: [
      { key: "risk", label: "Risiko", value: 0, tone: "neutral", items: [] },
      { key: "checkin", label: "Check-ins", value: 0, tone: "neutral", items: [] },
      { key: "plan", label: "Pläne ≤ 5 Tage", value: 0, tone: "neutral", items: [] },
      { key: "lead", label: "Leads", value: 0, tone: "neutral", items: [] },
    ],
    ...overrides,
  };
}

describe("coach today queue", () => {
  it("deduplicates one customer across risk, check-in and plan signals", () => {
    const target = { kind: "customer", userId: "1" } as const;
    const result = buildCoachTodayQueue(
      workload({
        metrics: [
          {
            key: "risk",
            label: "Risiko",
            value: 1,
            tone: "urgent",
            items: [
              {
                id: "1",
                name: "Mia",
                reason: "Risiko",
                target,
                sourceSignalId: "r1",
                actionSignalIds: ["risk-1"],
              },
            ],
          },
          {
            key: "checkin",
            label: "Check-ins",
            value: 1,
            tone: "attention",
            items: [
              {
                id: "1",
                name: "Mia",
                reason: "Check-in wartet",
                target,
                sourceSignalId: "c1",
                actionSignalIds: ["checkin-review-1-2026-07-20"],
              },
            ],
          },
          {
            key: "plan",
            label: "Pläne ≤ 5 Tage",
            value: 2,
            tone: "attention",
            items: [
              {
                id: "1",
                name: "Mia",
                reason: "Plan läuft aus",
                target,
                sourceSignalId: "p1",
                actionSignalIds: ["plan-nutrition-1", "plan-training-1"],
              },
            ],
          },
          { key: "lead", label: "Leads", value: 0, tone: "neutral", items: [] },
        ],
      }),
      emptyIntelligence,
    );

    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe("urgent");
    expect(result[0].categories).toEqual(expect.arrayContaining(["risk", "checkin", "plan"]));
    expect(result[0].reasons).toEqual(
      expect.arrayContaining(["Risiko", "Check-in wartet", "Plan läuft aus"]),
    );
    expect(result[0].actionSignalIds).toEqual(
      expect.arrayContaining([
        "risk-1",
        "checkin-review-1-2026-07-20",
        "plan-nutrition-1",
        "plan-training-1",
      ]),
    );
  });

  it("adds intelligence signals to the existing customer instead of duplicating it", () => {
    const target = { kind: "customer", userId: "1" } as const;
    const result = buildCoachTodayQueue(
      workload({
        metrics: [
          { key: "risk", label: "Risiko", value: 0, tone: "neutral", items: [] },
          {
            key: "checkin",
            label: "Check-ins",
            value: 1,
            tone: "attention",
            items: [{ id: "1", name: "Mia", reason: "Check-in wartet", target, sourceSignalId: "c1" }],
          },
          { key: "plan", label: "Pläne ≤ 5 Tage", value: 0, tone: "neutral", items: [] },
          { key: "lead", label: "Leads", value: 0, tone: "neutral", items: [] },
        ],
      }),
      {
        ...emptyIntelligence,
        stagnating: [
          {
            id: "stagnation-1",
            userId: "1",
            name: "Mia",
            category: "stagnation",
            severity: "urgent",
            headline: "Mia stagniert",
            detail: "Seit 14 Tagen kein klarer Fortschritt.",
          },
        ],
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe("urgent");
    expect(result[0].categories).toEqual(expect.arrayContaining(["checkin", "stagnation"]));
    expect(result[0].actionSignalIds).toEqual(expect.arrayContaining(["c1", "stagnation-1"]));
  });

  it("filters the queue by workload category", () => {
    const items = buildCoachTodayQueue(
      workload({
        metrics: [
          { key: "risk", label: "Risiko", value: 0, tone: "neutral", items: [] },
          { key: "checkin", label: "Check-ins", value: 0, tone: "neutral", items: [] },
          { key: "plan", label: "Pläne ≤ 5 Tage", value: 0, tone: "neutral", items: [] },
          {
            key: "lead",
            label: "Leads",
            value: 1,
            tone: "info",
            items: [
              {
                id: "lead-1",
                name: "Lukas",
                reason: "Neue Anfrage",
                target: { kind: "lead", leadId: "lead-1" },
                sourceSignalId: "lead-1",
              },
            ],
          },
        ],
      }),
      emptyIntelligence,
    );

    expect(filterCoachTodayQueue(items, "lead")).toHaveLength(1);
    expect(filterCoachTodayQueue(items, "checkin")).toHaveLength(0);
  });
});
