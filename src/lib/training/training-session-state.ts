import type {
  TrainingExerciseDraft,
  TrainingSessionDraftState,
} from "./workout-session-draft.types";

export function createEmptyTrainingExerciseDraft(durationSeconds = 90): TrainingExerciseDraft {
  const safeDuration = Math.max(15, Math.min(600, durationSeconds));
  return {
    overrides: {},
    extraSets: 0,
    note: "",
    noteTouched: false,
    restTimer: {
      durationSeconds: safeDuration,
      remainingSeconds: safeDuration,
      endsAt: null,
      running: false,
    },
  };
}

export function createEmptyTrainingSessionDraft(
  clientId: string,
  sessionDate: string,
  openDayId: string | null = null,
): TrainingSessionDraftState {
  return {
    version: 1,
    clientId,
    sessionDate,
    planId: null,
    openDayId,
    activeExerciseId: null,
    addingDayId: null,
    newExercise: {
      name: "",
      sets: "3",
      reps: "8",
    },
    exercises: {},
  };
}

export function getTrainingExerciseDraft(
  state: TrainingSessionDraftState,
  exerciseId: string,
  durationSeconds = 90,
): TrainingExerciseDraft {
  return state.exercises[exerciseId] ?? createEmptyTrainingExerciseDraft(durationSeconds);
}

export function hasMeaningfulTrainingExerciseDraft(draft: TrainingExerciseDraft): boolean {
  return (
    Object.keys(draft.overrides).length > 0 ||
    draft.extraSets > 0 ||
    draft.noteTouched ||
    draft.note.length > 0 ||
    draft.restTimer.running ||
    draft.restTimer.endsAt !== null ||
    draft.restTimer.remainingSeconds !== draft.restTimer.durationSeconds
  );
}
