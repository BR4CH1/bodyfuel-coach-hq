import { describe, expect, it } from "vitest";

import { buildCustomerBriefing } from "../customer-briefing.logic";

const baseInput = {
  checkin: null,
  checkinMissingMeasures: false,
  trainedToday: true,
  measuredToday: true,
  todayPoints: 10,
  maxDailyPoints: 10,
  measurementCount: 3,
  latestMeasurementAt: "2026-07-19T08:00:00.000Z",
  hasActivePlan: true,
  planUnderReview: false,
  now: new Date("2026-07-20T12:00:00.000Z"),
} as const;

describe("customer briefing logic", () => {
  it("celebrates when all daily priorities are complete", () => {
    const briefing = buildCustomerBriefing(baseInput);

    expect(briefing.state).toBe("clear");
    expect(briefing.emotion).toBe("celebrating");
    expect(briefing.items).toEqual([]);
  });

  it("puts an overdue check-in first", () => {
    const briefing = buildCustomerBriefing({
      ...baseInput,
      checkin: { tone: "overdue", label: "Check-In überfällig seit 2 Tagen" },
      trainedToday: false,
      todayPoints: 2,
    });

    expect(briefing.state).toBe("urgent");
    expect(briefing.items[0]).toMatchObject({
      id: "checkin-overdue",
      target: { kind: "checkin" },
    });
  });

  it("prioritizes missing check-in measurements over normal daily tasks", () => {
    const briefing = buildCustomerBriefing({
      ...baseInput,
      checkin: { tone: "review", label: "Check-in wird überprüft" },
      checkinMissingMeasures: true,
      trainedToday: false,
      todayPoints: 0,
    });

    expect(briefing.items.map((item) => item.id)).toEqual([
      "checkin-measures-missing",
      "daily-points",
      "training-open",
    ]);
  });

  it("flags stale measurements after seven days", () => {
    const briefing = buildCustomerBriefing({
      ...baseInput,
      latestMeasurementAt: "2026-07-10T08:00:00.000Z",
    });

    expect(briefing.items[0]).toMatchObject({
      id: "measurement-stale",
      description: "Deine letzte Messung ist 10 Tage her.",
    });
  });

  it("limits the briefing to the three highest priorities", () => {
    const briefing = buildCustomerBriefing({
      ...baseInput,
      checkin: { tone: "today", label: "Check-in heute fällig" },
      measurementCount: 0,
      latestMeasurementAt: null,
      todayPoints: 0,
      trainedToday: false,
      hasActivePlan: false,
    });

    expect(briefing.items).toHaveLength(3);
    expect(briefing.items.map((item) => item.id)).toEqual([
      "checkin-today",
      "first-measurement",
      "daily-points",
    ]);
  });
});
