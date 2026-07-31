import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chooseNewestDraft,
  isWorkoutDraftEnvelope,
  readEmergencyDraft,
  writeLocalDraft,
} from "@/lib/training/workout-session-draft.store";
import {
  createEmptyTrainingExerciseDraft,
  createEmptyTrainingSessionDraft,
  hasMeaningfulTrainingExerciseDraft,
} from "@/lib/training/training-session-state";
import type {
  TrainingSessionDraftState,
  WorkoutDraftEnvelope,
} from "@/lib/training/workout-session-draft.types";

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

function envelope(
  revision: number,
  updatedAt: string,
  deviceId = "iphone",
): WorkoutDraftEnvelope<TrainingSessionDraftState> {
  return {
    schemaVersion: 1,
    draftKey: "user:2026-07-31",
    deviceId,
    localRevision: revision,
    remoteRevision: null,
    updatedAt,
    view: { scrollY: 640 },
    state: createEmptyTrainingSessionDraft("user", "2026-07-31"),
  };
}

describe("workout session draft", () => {
  beforeEach(() => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("indexedDB", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes the emergency snapshot synchronously and restores it", async () => {
    const draft = envelope(4, "2026-07-31T05:20:00.000Z");
    const write = writeLocalDraft(draft);

    expect(readEmergencyDraft<TrainingSessionDraftState>(draft.draftKey)).toEqual(draft);
    await write;
  });

  it("prefers a higher same-device revision despite an older clock", () => {
    const oldRevision = envelope(3, "2026-07-31T06:00:00.000Z");
    const newRevision = envelope(4, "2026-07-31T05:00:00.000Z");
    expect(chooseNewestDraft(oldRevision, newRevision)).toBe(newRevision);
  });

  it("rejects malformed persisted data", () => {
    expect(isWorkoutDraftEnvelope({ schemaVersion: 1 })).toBe(false);
  });

  it("recognizes unsaved exercise input and absolute timers", () => {
    const empty = createEmptyTrainingExerciseDraft(90);
    expect(hasMeaningfulTrainingExerciseDraft(empty)).toBe(false);
    expect(
      hasMeaningfulTrainingExerciseDraft({
        ...empty,
        overrides: { "1": { weight: "80", reps: "8" } },
      }),
    ).toBe(true);
    expect(
      hasMeaningfulTrainingExerciseDraft({
        ...empty,
        restTimer: { ...empty.restTimer, running: true, endsAt: Date.now() + 90_000 },
      }),
    ).toBe(true);
  });
});
