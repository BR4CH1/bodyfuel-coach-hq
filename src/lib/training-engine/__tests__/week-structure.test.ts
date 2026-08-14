import { describe, expect, it } from "vitest";
import { buildWeekPlan } from "@/lib/training-engine/week-structure";

describe("buildWeekPlan calendar alignment", () => {
  it("aligns configured weekdays when a plan starts on Tuesday", () => {
    const [week] = buildWeekPlan({
      startDate: new Date("2026-07-21T00:00:00Z"), // Dienstag
      weeks: 1,
      trainingWeekdays: ["monday", "tuesday", "wednesday", "friday", "saturday"],
      sportWeekdays: [],
      experience: "intermediate",
    });

    expect(
      week.days.map((day) => ({
        date: day.day_date,
        weekday: day.weekday,
        role: day.role,
        focus: day.focus,
      })),
    ).toEqual([
      { date: "2026-07-21", weekday: "tuesday", role: "gym", focus: "push" },
      { date: "2026-07-22", weekday: "wednesday", role: "gym", focus: "pull" },
      { date: "2026-07-23", weekday: "thursday", role: "rest", focus: null },
      { date: "2026-07-24", weekday: "friday", role: "gym", focus: "legs" },
      { date: "2026-07-25", weekday: "saturday", role: "gym", focus: "upper" },
      { date: "2026-07-26", weekday: "sunday", role: "rest", focus: null },
      { date: "2026-07-27", weekday: "monday", role: "gym", focus: "lower" },
    ]);
  });

  it("keeps every emitted weekday consistent with its day_date", () => {
    const plans = buildWeekPlan({
      startDate: new Date("2026-08-14T00:00:00Z"), // Freitag
      weeks: 2,
      trainingWeekdays: ["monday", "friday"],
      sportWeekdays: [],
      experience: "intermediate",
    });

    const expectedByJsDay = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    for (const day of plans.flatMap((week) => week.days)) {
      const jsDay = new Date(`${day.day_date}T00:00:00Z`).getUTCDay();
      expect(day.weekday).toBe(expectedByJsDay[jsDay]);
    }
  });
});
