import { describe, expect, it } from "vitest";
import {
  remapHistoricLogs,
  resolveExternalDaySelection,
  resolveOpenDayId,
  resolveRestoredOpenDayId,
} from "../tracker-day-selection";

const dateKeyOf = (v: string | number | Date) => new Date(v).toISOString().slice(0, 10);

describe("resolveOpenDayId", () => {
  it("keeps the current day when it still exists in the visible week", () => {
    expect(
      resolveOpenDayId({ current: "b", visibleDayIds: ["a", "b"], preferredDayId: "a" }),
    ).toBe("b");
  });
  it("falls back to preferred only when current is gone", () => {
    expect(
      resolveOpenDayId({ current: "x", visibleDayIds: ["a", "b"], preferredDayId: "a" }),
    ).toBe("a");
  });
});

describe("resolveExternalDaySelection", () => {
  it("ignores day names", () => {
    expect(
      resolveExternalDaySelection({
        requestedDayId: "Push 08.11",
        visibleDayIds: ["a", "b"],
        current: "a",
      }),
    ).toBe("a");
  });
  it("ignores unknown ids and empty values", () => {
    expect(
      resolveExternalDaySelection({ requestedDayId: "zzz", visibleDayIds: ["a"], current: "a" }),
    ).toBe("a");
    expect(
      resolveExternalDaySelection({ requestedDayId: null, visibleDayIds: ["a"], current: "a" }),
    ).toBe("a");
  });
  it("accepts an explicit valid day id", () => {
    expect(
      resolveExternalDaySelection({ requestedDayId: "b", visibleDayIds: ["a", "b"], current: "a" }),
    ).toBe("b");
  });
});

describe("remapHistoricLogs", () => {
  const currentExercises = [{ id: "cur", name: "Bankdrücken" }];
  const historicExercises = [{ id: "old", name: "Bankdrücken" }];

  it("never remaps today's logs onto another exercise_id", () => {
    const [log] = remapHistoricLogs({
      logs: [{ exercise_id: "old", training_date: "2026-08-27" }],
      currentExercises,
      historicExercises,
      todayKey: "2026-08-27",
      dateKeyOf,
    });
    expect(log.exercise_id).toBe("old");
  });

  it("remaps historic logs by name for analytics", () => {
    const [log] = remapHistoricLogs({
      logs: [{ exercise_id: "old", training_date: "2026-07-01" }],
      currentExercises,
      historicExercises,
      todayKey: "2026-08-27",
      dateKeyOf,
    });
    expect(log.exercise_id).toBe("cur");
  });

  it("keeps current-plan logs untouched", () => {
    const [log] = remapHistoricLogs({
      logs: [{ exercise_id: "cur", training_date: "2026-07-01" }],
      currentExercises,
      historicExercises,
      todayKey: "2026-08-27",
      dateKeyOf,
    });
    expect(log.exercise_id).toBe("cur");
  });
});

describe("resolveRestoredOpenDayId", () => {
  const week4 = [
    { id: "push-0811", day_date: "2026-08-11" },
    { id: "pull-0812", day_date: "2026-08-12" },
    { id: "beine-0810", day_date: "2026-08-10" },
    { id: "beine-0813", day_date: "2026-08-13" },
  ];

  it("keeps a still-valid current day (reload / remount / hidden→visible)", () => {
    expect(
      resolveRestoredOpenDayId({
        current: "beine-0810",
        trackableDays: week4,
        todayDateKey: "2026-08-27",
      }),
    ).toBe("beine-0810");
  });

  it("maps an extended plan's reused last week by weekday when no current day", () => {
    // Thursday 27.08. → Thursday 13.08.
    expect(
      resolveRestoredOpenDayId({
        current: null,
        trackableDays: week4,
        todayDateKey: "2026-08-27",
      }),
    ).toBe("beine-0813");
  });

  it("prefers an exact date match", () => {
    expect(
      resolveRestoredOpenDayId({
        current: null,
        trackableDays: [...week4, { id: "today", day_date: "2026-08-27" }],
        todayDateKey: "2026-08-27",
      }),
    ).toBe("today");
  });

  it("falls back to the first trackable day when no weekday matches", () => {
    expect(
      resolveRestoredOpenDayId({
        current: "gone",
        trackableDays: [{ id: "a", day_date: "2026-08-11" }],
        todayDateKey: "2026-08-27",
      }),
    ).toBe("a");
  });
});
