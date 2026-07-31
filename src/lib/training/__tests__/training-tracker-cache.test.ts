import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearTrainingTrackerSnapshot,
  readTrainingTrackerSnapshot,
  writeTrainingTrackerSnapshot,
  type TrainingTrackerSnapshot,
} from "@/lib/training/training-tracker-cache";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function snapshot(
  clientId: string,
  logs: TrainingTrackerSnapshot["logs"] = [],
): Omit<TrainingTrackerSnapshot, "version" | "updatedAt"> {
  return {
    clientId,
    plan: {
      id: `plan-${clientId}`,
      client_id: clientId,
      title: "Kraftplan",
      weeks_count: 4,
    },
    days: [{ id: "day-1", name: "Tag 1", sort_order: 0, week_number: 1 }],
    exercises: [
      {
        id: "exercise-1",
        day_id: "day-1",
        name: "Kniebeuge",
        target_sets: 3,
        target_reps: "8",
        notes: null,
        sort_order: 0,
      },
    ],
    logs,
    activeWeek: 1,
    weeksCount: 4,
  };
}

describe("training tracker cache", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("restores the last plan, exercises and set logs", () => {
    const performedAt = "2026-07-30T10:00:00.000Z";
    writeTrainingTrackerSnapshot(
      snapshot("client-1", [
        {
          id: "log-1",
          exercise_id: "exercise-1",
          client_id: "client-1",
          set_number: 1,
          weight_kg: 100,
          reps: 8,
          performed_at: performedAt,
        },
      ]),
    );

    expect(readTrainingTrackerSnapshot("client-1")).toMatchObject({
      version: 1,
      clientId: "client-1",
      plan: { id: "plan-client-1" },
      logs: [{ weight_kg: 100, reps: 8, performed_at: performedAt }],
    });
  });

  it("keeps the newest 400 logs and evicts snapshots beyond four clients", () => {
    const logs = Array.from({ length: 405 }, (_, index) => ({
      id: `log-${index}`,
      exercise_id: "exercise-1",
      client_id: "client-1",
      set_number: 1,
      weight_kg: index,
      reps: 8,
      performed_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    }));

    writeTrainingTrackerSnapshot(snapshot("client-1", logs));
    expect(readTrainingTrackerSnapshot("client-1")?.logs).toHaveLength(400);
    expect(readTrainingTrackerSnapshot("client-1")?.logs[0]?.id).toBe("log-404");
    for (let client = 2; client <= 5; client += 1) {
      writeTrainingTrackerSnapshot(snapshot(`client-${client}`));
    }

    expect(readTrainingTrackerSnapshot("client-1")).toBeNull();
    expect(readTrainingTrackerSnapshot("client-5")).not.toBeNull();
    const latest = readTrainingTrackerSnapshot("client-2");
    expect(latest?.logs).toHaveLength(0);
  });

  it("can remove a stored workout explicitly", () => {
    writeTrainingTrackerSnapshot(snapshot("client-1"));
    clearTrainingTrackerSnapshot("client-1");
    expect(readTrainingTrackerSnapshot("client-1")).toBeNull();
  });
});
