import { describe, expect, it } from "vitest";
import {
  MAX_RECENT_ACTIVITY_DAYS,
  RECENT_ACTIVITY_DAYS,
  buildRecentActivityWindow,
  clampRecentActivityDays,
} from "@/lib/customer-recent-activity.logic";

describe("clampRecentActivityDays", () => {
  it("shows the last 10 days by default", () => {
    expect(RECENT_ACTIVITY_DAYS).toBe(10);
    expect(clampRecentActivityDays(undefined)).toBe(10);
  });

  it("never exceeds 10 days and never drops below 1", () => {
    expect(clampRecentActivityDays(999)).toBe(MAX_RECENT_ACTIVITY_DAYS);
    expect(clampRecentActivityDays(3)).toBe(3);
    expect(clampRecentActivityDays(0)).toBe(1);
    expect(clampRecentActivityDays(-5)).toBe(1);
    expect(clampRecentActivityDays(Number.NaN)).toBe(1);
  });
});

describe("buildRecentActivityWindow", () => {
  it("covers exactly 10 consecutive days, newest first", () => {
    const window = buildRecentActivityWindow(
      RECENT_ACTIVITY_DAYS,
      new Date("2026-11-26T12:00:00Z"),
    );

    expect(window.dateList).toHaveLength(10);
    expect(window.dateList[0]).toBe("2026-11-26");
    expect(window.dateList[window.dateList.length - 1]).toBe("2026-11-17");
    expect(new Set(window.dateList).size).toBe(10);
    expect(window.fromDate).toBe("2026-11-17");
    expect(window.toDate).toBe("2026-11-26");
    expect(window.fromIso).toBe("2026-11-17T00:00:00.000Z");
    expect(window.toEndIso).toBe("2026-11-26T23:59:59.999Z");
  });

  it("crosses the month boundary without gaps", () => {
    const window = buildRecentActivityWindow(
      RECENT_ACTIVITY_DAYS,
      new Date("2026-12-03T12:00:00Z"),
    );

    expect(window.dateList).toEqual([
      "2026-12-03",
      "2026-12-02",
      "2026-12-01",
      "2026-11-30",
      "2026-11-29",
      "2026-11-28",
      "2026-11-27",
      "2026-11-26",
      "2026-11-25",
      "2026-11-24",
    ]);
  });
});
