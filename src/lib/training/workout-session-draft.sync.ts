import { chooseNewestDraft } from "./workout-session-draft.store";
import type {
  RemoteSaveResult,
  WorkoutDraftEnvelope,
  WorkoutDraftRemoteAdapter,
} from "./workout-session-draft.types";

function nowIso() {
  return new Date().toISOString();
}

export function withWorkoutDraftView<TState extends Record<string, unknown>>(
  draft: WorkoutDraftEnvelope<TState>,
  scrollY: number,
  updatedAt = nowIso(),
): WorkoutDraftEnvelope<TState> {
  if (draft.view.scrollY === scrollY) return draft;
  return {
    ...draft,
    updatedAt,
    view: { scrollY },
  };
}

export function rebaseWorkoutDraftForRetry<TState extends Record<string, unknown>>(
  local: WorkoutDraftEnvelope<TState>,
  remoteCurrent: WorkoutDraftEnvelope<TState>,
  remoteRevision: number,
  updatedAt = nowIso(),
): WorkoutDraftEnvelope<TState> {
  const minimumLocalRevision =
    remoteCurrent.deviceId === local.deviceId
      ? Math.max(local.localRevision, remoteCurrent.localRevision + 1)
      : local.localRevision;

  return {
    ...local,
    localRevision: minimumLocalRevision,
    remoteRevision,
    updatedAt: minimumLocalRevision === local.localRevision ? local.updatedAt : updatedAt,
  };
}

function saveResultMatchesDraft<TState extends Record<string, unknown>>(
  result: RemoteSaveResult<TState>,
  draft: WorkoutDraftEnvelope<TState>,
) {
  return result.current.deviceId === draft.deviceId && result.current.localRevision === draft.localRevision;
}

export async function saveDraftWithSingleRebaseRetry<TState extends Record<string, unknown>>({
  draft,
  getCurrentDraft,
  remote,
  persistRebasedDraft,
}: {
  draft: WorkoutDraftEnvelope<TState>;
  getCurrentDraft: () => WorkoutDraftEnvelope<TState>;
  remote: Pick<WorkoutDraftRemoteAdapter<TState>, "save">;
  persistRebasedDraft?: (draft: WorkoutDraftEnvelope<TState>) => Promise<void> | void;
}): Promise<{
  applied: boolean;
  savedDraft: WorkoutDraftEnvelope<TState>;
  remoteRevision: number;
  conflictDraft?: WorkoutDraftEnvelope<TState>;
  rebased: boolean;
}> {
  const first = await remote.save(draft);
  if (first.applied || saveResultMatchesDraft(first, draft)) {
    return {
      applied: true,
      savedDraft: draft,
      remoteRevision: first.remoteRevision,
      rebased: false,
    };
  }

  const newestLocal = chooseNewestDraft(draft, getCurrentDraft()) ?? getCurrentDraft();
  const rebased = rebaseWorkoutDraftForRetry(newestLocal, first.current, first.remoteRevision);
  await persistRebasedDraft?.(rebased);

  const retry = await remote.save(rebased);
  if (retry.applied || saveResultMatchesDraft(retry, rebased)) {
    return {
      applied: true,
      savedDraft: rebased,
      remoteRevision: retry.remoteRevision,
      rebased: true,
    };
  }

  return {
    applied: false,
    savedDraft: rebased,
    remoteRevision: retry.remoteRevision,
    conflictDraft: retry.current,
    rebased: true,
  };
}

export function recoverWorkoutDraft<TState extends Record<string, unknown>>({
  current,
  local,
  remote,
}: {
  current: WorkoutDraftEnvelope<TState>;
  local: WorkoutDraftEnvelope<TState> | null;
  remote: WorkoutDraftEnvelope<TState> | null;
}): { draft: WorkoutDraftEnvelope<TState>; shouldPushRemote: boolean } {
  const newestLocal = chooseNewestDraft(current, local) ?? current;
  const selected = chooseNewestDraft(newestLocal, remote) ?? newestLocal;

  if (remote && selected !== remote) {
    return {
      draft: rebaseWorkoutDraftForRetry(selected, remote, remote.remoteRevision ?? 0),
      shouldPushRemote: true,
    };
  }

  return {
    draft: selected,
    shouldPushRemote: !remote,
  };
}