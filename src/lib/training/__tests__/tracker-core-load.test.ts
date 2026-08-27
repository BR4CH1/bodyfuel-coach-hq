import { describe, expect, it, vi } from "vitest";

import {
  chunkIds,
  loadTrainingTrackerCore,
  mergeReloadedTrainingLogs,
  type TrackerCoreSource,
} from "@/lib/training/tracker-core-load";
import type {
  CachedTrainingSetLog,
  TrainingTrackerSnapshot,
} from "@/lib/training/training-tracker-cache";

const TODAY = "2026-08-27";

function log(partial: Partial<CachedTrainingSetLog> & { id: string }): CachedTrainingSetLog {
  return {
    exercise_id: "ex-1",
    client_id: "stefan",
    set_number: 1,
    weight_kg: 60,
    reps: 10,
    performed_at: `${TODAY}T12:00:00.000Z`,
    ...partial,
  };
}

function makeSource(overrides: Partial<TrackerCoreSource> = {}): TrackerCoreSource {
  return {
    fetchActivePlan: async () => ({
      id: "plan-1",
      client_id: "stefan",
      title: "Plan",
      weeks_count: 1,
      scheduled_start_date: TODAY,
    }),
    fetchDays: async () => [{ id: "day-1", name: "Beine", sort_order: 0, week_number: 1 }],
    fetchExercises: async () => [
      {
        id: "ex-1",
        day_id: "day-1",
        name: "Kniebeuge",
        target_sets: 3,
        target_reps: "8",
        notes: null,
        sort_order: 0,
      },
    ],
    fetchHistoricExercises: async () => [],
    fetchCurrentLogs: async () => [],
    fetchHistoricLogs: async () => [],
    ...overrides,
  };
}

/** Minimal stand-in for the tracker's committed state. */
type TrackerState = {
  plan: TrainingTrackerSnapshot["plan"] | null;
  days: TrainingTrackerSnapshot["days"];
  exercises: TrainingTrackerSnapshot["exercises"];
  logs: CachedTrainingSetLog[];
};

async function safeReload(state: TrackerState, source: TrackerCoreSource) {
  const snapshots: TrackerState[] = [];
  try {
    const result = await loadTrainingTrackerCore(source, { todayKey: TODAY });
    if (result.status === "no-plan") {
      if (state.plan) throw new Error("plan not confirmed");
      const next = { plan: null, days: [], exercises: [], logs: [] };
      snapshots.push(next);
      return { state: next, error: null as string | null, snapshots };
    }
    const next: TrackerState = {
      plan: result.plan,
      days: result.days,
      exercises: result.exercises,
      logs: mergeReloadedTrainingLogs(
        state.logs,
        result.logs,
        result.exercises.map((e) => e.id),
        TODAY,
      ),
    };
    snapshots.push(next);
    return { state: next, error: null as string | null, snapshots };
  } catch (error) {
    return { state, error: (error as Error).message, snapshots };
  }
}

describe("transactional tracker reload", () => {
  const existing: TrackerState = {
    plan: { id: "plan-1", client_id: "stefan", title: "Plan", weeks_count: 1 },
    days: [{ id: "day-1", name: "Beine", sort_order: 0, week_number: 1 }],
    exercises: [
      {
        id: "ex-1",
        day_id: "day-1",
        name: "Kniebeuge",
        target_sets: 3,
        target_reps: "8",
        notes: null,
        sort_order: 0,
      },
    ],
    logs: Array.from({ length: 18 }, (_, index) =>
      log({ id: `log-${index}`, set_number: index + 1 }),
    ),
  };

  it("keeps all 18 logs when the set-log query fails", async () => {
    const result = await safeReload(
      existing,
      makeSource({
        fetchCurrentLogs: async () => {
          throw new Error("Failed to fetch");
        },
      }),
    );

    expect(result.error).toBe("Failed to fetch");
    expect(result.state.logs).toHaveLength(18);
    expect(result.state).toBe(existing);
  });

  it("keeps the whole tracker state when plan/day/exercise queries fail", async () => {
    for (const key of ["fetchActivePlan", "fetchDays", "fetchExercises"] as const) {
      const result = await safeReload(
        existing,
        makeSource({
          [key]: async () => {
            throw new Error("network down");
          },
        } as Partial<TrackerCoreSource>),
      );
      expect(result.error).toBe("network down");
      expect(result.state).toBe(existing);
      expect(result.snapshots).toHaveLength(0);
    }
  });

  it("does not commit or snapshot anything on a failed refresh", async () => {
    const result = await safeReload(
      existing,
      makeSource({
        fetchCurrentLogs: async () => {
          throw new Error("timeout");
        },
      }),
    );
    expect(result.snapshots).toHaveLength(0);
    expect(result.state.plan).toEqual(existing.plan);
  });

  it("commits fresh data on a successful reload", async () => {
    const remote = log({ id: "remote-1", set_number: 1, weight_kg: 80 });
    const result = await safeReload(existing, makeSource({ fetchCurrentLogs: async () => [remote] }));

    expect(result.error).toBeNull();
    expect(result.state.logs.map((l) => l.id)).toEqual(["remote-1"]);
    expect(result.snapshots).toHaveLength(1);
  });

  it("preserves unsynced offline sets on a successful reload", async () => {
    const state: TrackerState = {
      ...existing,
      logs: [
        log({ id: "offline-a", set_number: 4, performed_at: `${TODAY}T12:30:00.000Z` }),
        log({ id: "offline-b", set_number: 1, performed_at: `${TODAY}T12:31:00.000Z` }),
      ],
    };
    const remote = log({ id: "remote-1", set_number: 1, performed_at: `${TODAY}T12:32:00.000Z` });

    const result = await safeReload(state, makeSource({ fetchCurrentLogs: async () => [remote] }));

    expect(result.state.logs.map((l) => l.id)).toEqual(["remote-1", "offline-a"]);
  });

  it("tolerates a failing historic-exercise query", async () => {
    const spy = vi.fn(async () => [log({ id: "remote-1" })]);
    const result = await safeReload(
      existing,
      makeSource({
        fetchHistoricExercises: async () => {
          throw new Error("analytics down");
        },
        fetchCurrentLogs: spy,
      }),
    );
    expect(result.error).toBeNull();
    expect(spy).toHaveBeenCalledWith(["ex-1"]);
  });
});

describe("mergeReloadedTrainingLogs", () => {
  it("drops offline duplicates already confirmed by the server", () => {
    const merged = mergeReloadedTrainingLogs(
      [log({ id: "offline-1", set_number: 1 })],
      [log({ id: "remote-1", set_number: 1, performed_at: `${TODAY}T12:05:00.000Z` })],
      ["ex-1"],
      TODAY,
    );
    expect(merged.map((l) => l.id)).toEqual(["remote-1"]);
  });
});

describe("history is decoupled from the live workout", () => {
  it("keeps today's logs when the historic log query fails", async () => {
    const live = log({ id: "live-1", set_number: 1 });
    const result = await loadTrainingTrackerCore(
      makeSource({
        fetchCurrentLogs: async () => [live],
        fetchHistoricExercises: async () => [{ id: "old-1", name: "Kniebeuge" }],
        fetchHistoricLogs: async () => {
          throw new Error("history too big");
        },
      }),
      { todayKey: TODAY },
    );

    expect(result.status).toBe("loaded");
    if (result.status !== "loaded") return;
    expect(result.historyDegraded).toBe(true);
    expect(result.logs.map((l) => l.id)).toEqual(["live-1"]);
  });

  it("requests history chunked and without the current exercise ids", async () => {
    const historicIds = Array.from({ length: 320 }, (_, i) => `old-${i}`);
    const calls: string[][] = [];
    await loadTrainingTrackerCore(
      makeSource({
        fetchHistoricExercises: async () =>
          historicIds.concat("ex-1").map((id) => ({ id, name: "Kniebeuge" })),
        fetchHistoricLogs: async (ids) => {
          for (const chunk of chunkIds(ids)) calls.push(chunk);
          return [];
        },
      }),
      { todayKey: TODAY },
    );

    expect(calls.length).toBe(3);
    expect(calls.flat()).toHaveLength(320);
    expect(calls.flat()).not.toContain("ex-1");
  });
});
