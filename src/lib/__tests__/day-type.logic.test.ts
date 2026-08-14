import { describe, expect, it } from "vitest";
import { resolveConfiguredDayType } from "@/lib/day-type.logic";
import { buildTrainingWeekSchedule } from "@/lib/training-schedule.logic";

describe("resolveConfiguredDayType", () => {
  it("uses the active training plan before stale profile weekdays", () => {
    const schedule = buildTrainingWeekSchedule([
      {
        name: "Do — Ruhetag",
        day_date: "2026-08-13",
        sort_order: 3,
        week_number: 1,
        exercise_count: 0,
      },
      {
        name: "Fr — Push",
        day_date: "2026-08-14",
        sort_order: 4,
        week_number: 1,
        exercise_count: 6,
      },
    ]);

    expect(
      resolveConfiguredDayType({
        date: "2026-08-13",
        trainingSchedule: schedule,
        configuredTrainingWeekdays: ["thursday"],
      }),
    ).toBe("rest");
    expect(
      resolveConfiguredDayType({
        date: "2026-08-14",
        trainingSchedule: schedule,
        configuredTrainingWeekdays: ["thursday"],
      }),
    ).toBe("training");
  });

  it("accepts German and numeric profile weekdays as fallback", () => {
    expect(
      resolveConfiguredDayType({
        date: "2026-08-14",
        trainingSchedule: null,
        configuredTrainingWeekdays: ["Freitag", "1"],
      }),
    ).toBe("training");
    expect(
      resolveConfiguredDayType({
        date: "2026-08-13",
        trainingSchedule: null,
        configuredTrainingWeekdays: ["Freitag", "1"],
      }),
    ).toBe("rest");
  });
});
