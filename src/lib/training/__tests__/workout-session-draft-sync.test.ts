import { describe, expect, it } from "vitest";

import {
  recoverWorkoutDraft,
  saveDraftWithSingleRebaseRetry,
  withWorkoutDraftView,
} from "@/lib/training/workout-session-draft.sync";
import { createEmptyTrainingSessionDraft } from "@/lib/training/training-session-state";
import type {
  TrainingSessionDraftState,
  WorkoutDraftEnvelope,
} from "@/lib/training/workout-session-draft.types";

function envelope(
  localRevision: number,
  remoteRevision: number | null,
  updatedAt: string,
  marker: string,
): WorkoutDraftEnvelope<TrainingSessionDraftState> {
  return {
    schemaVersion: 1,
    draftKey: "user:2026-08-25",
    deviceId: "iphone-pwa",
    localRevision,
    remoteRevision,
    updatedAt,
    view: { scrollY: 120 },
    state: {
      ...createEmptyTrainingSessionDraft("user", "2026-08-25"),
      activeExerciseId: marker,
    },
  };
}

describe("workout session draft sync", () => {
  it("rebases and retries once after a lost save response/revision conflict", async () => {
    const local = envelope(481, 155, "2026-08-25T19:29:02.000Z", "butterfly");
    const remote = envelope(481, 155, "2026-08-25T19:26:54.000Z", "brustpresse");
    const saved: WorkoutDraftEnvelope<TrainingSessionDraftState>[] = [];

    const result = await saveDraftWithSingleRebaseRetry({
      draft: local,
      getCurrentDraft: () => local,
      remote: {
        save: async (draft) => {
          saved.push(draft);
          if (saved.length === 1) {
            return { applied: false, remoteRevision: 155, current: remote };
          }
          return { applied: true, remoteRevision: 156, current: draft };
        },
      },
    });

    expect(result.applied).toBe(true);
    expect(result.rebased).toBe(true);
    expect(saved).toHaveLength(2);
    expect(saved[1]?.remoteRevision).toBe(155);
    expect(saved[1]?.localRevision).toBe(482);
    expect(saved[1]?.state.activeExerciseId).toBe("butterfly");
  });

  it("recovers hidden-to-visible without letting an older remote draft overwrite local state", () => {
    const current = envelope(489, 155, "2026-08-25T19:30:00.000Z", "latest-local");
    const local = envelope(488, 155, "2026-08-25T19:29:30.000Z", "indexed-local");
    const remote = envelope(481, 155, "2026-08-25T19:26:54.000Z", "stale-remote");

    const recovered = recoverWorkoutDraft({ current, local, remote });

    expect(recovered.shouldPushRemote).toBe(true);
    expect(recovered.draft.state.activeExerciseId).toBe("latest-local");
    expect(recovered.draft.remoteRevision).toBe(155);
    expect(recovered.draft.localRevision).toBe(489);
  });

  it("stores scroll/view changes without increasing the workout revision", () => {
    const current = envelope(7, 3, "2026-08-25T19:30:00.000Z", "exercise");
    const next = withWorkoutDraftView(current, 880, "2026-08-25T19:30:10.000Z");

    expect(next.localRevision).toBe(7);
    expect(next.view.scrollY).toBe(880);
  });
});