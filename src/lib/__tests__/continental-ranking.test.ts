import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CONTINENTAL_GROUP } from "../continental-challenge.functions";
import { MAX_DAILY_POINTS, TASKS, pointsForDay, type CheckTaskKey } from "../bodyfuel/data";

describe("Challenge-Punkte", () => {
  for (const [key, points] of Object.entries({ protein: 3, training: 3, water: 2, fruitsVeg: 2, steps: 2, sleep: 2, recovery: 1 })) {
    it(`${key} gibt ${points} Punkte`, () => {
      const tasks = Object.fromEntries(TASKS.map(task => [task.key, task.key === key])) as Record<CheckTaskKey, boolean>;
      expect(pointsForDay({ date: "2026-11-15", tasks })).toBe(points);
    });
  }
  it("begrenzt die sieben Tagesziele auf 15 Punkte", () => {
    const tasks = Object.fromEntries(TASKS.map(task => [task.key, true])) as Record<CheckTaskKey, boolean>;
    expect(MAX_DAILY_POINTS).toBe(15);
    expect(pointsForDay({ date: "2026-11-15", tasks })).toBe(15);
  });
});

describe("Challenge-Zugriffsregel", () => {
  const sql = readFileSync("drizzle/migrations/0002_continental_ranking_group.sql", "utf8");
  it("stellt die vorhandene Kundengruppe bereit", () => {
    expect(CONTINENTAL_GROUP).toBe("continental");
    expect(sql).toContain("ALTER TYPE public.app_group ADD VALUE IF NOT EXISTS 'continental'");
  });
  it("filtert Teilnehmer serverseitig und verlangt eine angemeldete Identität", () => {
    expect(sql).toContain("auth.uid() IS NOT NULL");
    expect(sql).toContain("own_group.user_id=auth.uid() AND own_group.group_name::text='continental'");
    expect(sql).toContain("participant_group.user_id=p.id AND participant_group.group_name::text='continental'");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.get_ranking() FROM PUBLIC, anon");
  });
});