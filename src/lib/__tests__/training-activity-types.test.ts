import { describe, expect, it } from "vitest";
import {
  clampActivityDuration,
  describeFlexActivity,
  nutritionDayTypeForKind,
  summarizeWeeklyActivityLoad,
} from "@/lib/training-activity-types";

describe("Flex-Aktivitäten", () => {
  it("begrenzt Dauern robust", () => {
    expect(clampActivityDuration("90")).toBe(90);
    expect(clampActivityDuration(0)).toBeNull();
    expect(clampActivityDuration("")).toBeNull();
    expect(clampActivityDuration(5000)).toBe(600);
  });

  it("beschreibt Padel 90 Minuten lesbar", () => {
    expect(
      describeFlexActivity({ title: "Padel", sport: "padel", durationMin: 90, intensity: "hoch" }),
    ).toBe("Padel · 90 Min · hoch");
  });

  it("weist Flex getrennt von Cardio aus, zählt aber in die Gesamtbelastung", () => {
    const load = summarizeWeeklyActivityLoad([
      { activities: [{ type: "flex", durationMin: 90 }, { type: "cardio", durationMin: 30 }] },
      { activities: [{ type: "mobility" }, { type: "class" }] },
    ]);
    expect(load.flexCount).toBe(1);
    expect(load.flexMinutes).toBe(90);
    expect(load.cardioMinutes).toBe(30);
    expect(load.recoveryCount).toBe(1);
    expect(load.otherCount).toBe(1);
    expect(load.totalMinutes).toBe(120);
    expect(load.totalCount).toBe(4);
  });

  it("behandelt Flex nicht pauschal wie Krafttraining", () => {
    expect(nutritionDayTypeForKind("strength")).toBe("training");
    expect(nutritionDayTypeForKind("flex")).toBe("rest");
    expect(nutritionDayTypeForKind("flex", { flexCountsAsTraining: true })).toBe("training");
    expect(nutritionDayTypeForKind("recovery")).toBe("rest");
  });
});
