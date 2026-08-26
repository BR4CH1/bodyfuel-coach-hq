import { describe, expect, it } from "vitest";

import {
  TRAINING_SET_LOG_UPSERT_CONFLICT,
  buildTrainingSetLogUpsert,
  mergeTodaysTrainingLogs,
} from "@/lib/training/training-set-log.logic";

describe("training set log idempotency", () => {
  it("builds an idempotent row keyed by client, exercise, local training date and set", () => {
    const row = buildTrainingSetLogUpsert(
      {
        exercise_id: "exercise-1",
        set_number: 1,
        weight_kg: 55,
        reps: 10,
        training_date: "2026-08-25",
        performed_at: "2026-08-25T19:29:02.000Z",
      },
      "client-1",
    );

    expect(TRAINING_SET_LOG_UPSERT_CONFLICT).toBe(
      "client_id,exercise_id,training_date,set_number",
    );
    expect(row).toMatchObject({
      client_id: "client-1",
      exercise_id: "exercise-1",
      set_number: 1,
      training_date: "2026-08-25",
      weight_kg: 55,
      reps: 10,
    });
  });

  it("replaces today's stale visible logs with remote rows while preserving unsynced offline sets", () => {
    const merged = mergeTodaysTrainingLogs(
      [
        {
          id: "old-1",
          exercise_id: "exercise-1",
          set_number: 1,
          performed_at: "2026-08-25T19:20:00.000Z",
        },
        {
          id: "offline-1",
          exercise_id: "exercise-1",
          set_number: 2,
          performed_at: "2026-08-25T19:21:00.000Z",
        },
        {
          id: "previous-day",
          exercise_id: "exercise-1",
          set_number: 1,
          performed_at: "2026-08-24T19:20:00.000Z",
        },
      ],
      [
        {
          id: "remote-1",
          exercise_id: "exercise-1",
          set_number: 1,
          performed_at: "2026-08-25T19:22:00.000Z",
        },
      ],
      ["exercise-1"],
      "2026-08-25",
    );

    expect(merged.map((log) => log.id)).toEqual(["remote-1", "offline-1", "previous-day"]);
  });
});