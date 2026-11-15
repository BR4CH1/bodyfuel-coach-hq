import { describe, expect, it } from "vitest";
import { summarizeChallengeChecks } from "../continental-progress.logic";
import { TASKS } from "../bodyfuel/data";

describe("Challenge-Tagesziele", () => {
  it("zählt nur Tagesziele vom 15.11. bis einschließlich 14.12., keine früheren Gesamtpunkte", () => {
    const checks = ["2026-11-14", "2026-11-15", "2026-12-14", "2026-12-15"].map(check_date => ({ check_date, tasks: { protein: true } }));
    const result = summarizeChallengeChecks(checks, "2026-11-15");
    expect(result.challenge_points).toBe(6);
    expect(result.day_points).toBe(3);
  });
  it("zeigt sieben Ziele und höchstens 15 Tagespunkte", () => {
    const result = summarizeChallengeChecks([{ check_date: "2026-11-15", tasks: Object.fromEntries(TASKS.map(task => [task.key, true])) }], "2026-11-15");
    expect(result.day_points).toBe(15);
    expect(result.perfect_days).toBe(1);
    expect(Object.values(result.tasks).filter(Boolean)).toHaveLength(7);
  });
  it("zeigt fehlende Tageschecks mit null statt erfundenen Punkten", () => {
    expect(summarizeChallengeChecks([], "2026-11-15").day_points).toBe(0);
  });
});