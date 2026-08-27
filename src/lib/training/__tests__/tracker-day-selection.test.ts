import { describe, expect, it } from "vitest";
import {
  remapHistoricLogs,
  resolveExternalDaySelection,
  resolveOpenDayId,
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
