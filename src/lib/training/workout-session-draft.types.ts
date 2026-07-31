export type WorkoutSaveStatus =
  "restoring" | "saving" | "saved" | "saved-locally" | "offline" | "conflict" | "error";

export type WorkoutDraftView = {
  scrollY: number;
};

export type WorkoutDraftEnvelope<TState extends Record<string, unknown>> = {
  schemaVersion: 1;
  draftKey: string;
  deviceId: string;
  localRevision: number;
  remoteRevision: number | null;
  updatedAt: string;
  view: WorkoutDraftView;
  state: TState;
};

export type RemoteSaveResult<TState extends Record<string, unknown>> = {
  applied: boolean;
  remoteRevision: number;
  current: WorkoutDraftEnvelope<TState>;
};

export interface WorkoutDraftRemoteAdapter<TState extends Record<string, unknown>> {
  load(draftKey: string): Promise<WorkoutDraftEnvelope<TState> | null>;
  save(draft: WorkoutDraftEnvelope<TState>): Promise<RemoteSaveResult<TState>>;
  remove(draftKey: string): Promise<void>;
}

export type WorkoutStateUpdater<TState extends Record<string, unknown>> =
  TState | ((previous: TState) => TState);

export type TrainingSetDraft = {
  weight: string;
  reps: string;
};

export type TrainingRestTimerDraft = {
  durationSeconds: number;
  remainingSeconds: number;
  endsAt: number | null;
  running: boolean;
};

export type TrainingExerciseDraft = {
  overrides: Record<string, TrainingSetDraft>;
  extraSets: number;
  note: string;
  noteTouched: boolean;
  restTimer: TrainingRestTimerDraft;
};

export type TrainingSessionDraftState = Record<string, unknown> & {
  version: 1;
  clientId: string;
  sessionDate: string;
  planId: string | null;
  openDayId: string | null;
  activeExerciseId: string | null;
  addingDayId: string | null;
  newExercise: {
    name: string;
    sets: string;
    reps: string;
  };
  exercises: Record<string, TrainingExerciseDraft>;
};
