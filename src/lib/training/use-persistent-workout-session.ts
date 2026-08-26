import { useCallback, useEffect, useRef, useState } from "react";
import {
  chooseNewestDraft,
  deleteLocalDraft,
  getOrCreateWorkoutDeviceId,
  loadLocalDraft,
  readEmergencyDraft,
  writeLocalDraft,
} from "./workout-session-draft.store";
import {
  recoverWorkoutDraft,
  saveDraftWithSingleRebaseRetry,
  withWorkoutDraftView,
} from "./workout-session-draft.sync";
import type {
  WorkoutDraftEnvelope,
  WorkoutDraftRemoteAdapter,
  WorkoutSaveStatus,
  WorkoutStateUpdater,
} from "./workout-session-draft.types";

type Options<TState extends Record<string, unknown>> = {
  draftKey: string;
  initialState: TState;
  remote?: WorkoutDraftRemoteAdapter<TState>;
  autosaveMs?: number;
  captureScroll?: boolean;
  onConflict?: (local: WorkoutDraftEnvelope<TState>, remote: WorkoutDraftEnvelope<TState>) => void;
};

type Result<TState extends Record<string, unknown>> = {
  workoutState: TState;
  restored: boolean;
  saveStatus: WorkoutSaveStatus;
  updateWorkout: (update: WorkoutStateUpdater<TState>) => void;
  flush: () => Promise<void>;
  clearAfterCompletion: () => Promise<void>;
};

function createEnvelope<TState extends Record<string, unknown>>(
  draftKey: string,
  state: TState,
): WorkoutDraftEnvelope<TState> {
  return {
    schemaVersion: 1,
    draftKey,
    deviceId: getOrCreateWorkoutDeviceId(),
    localRevision: 0,
    remoteRevision: null,
    updatedAt: new Date().toISOString(),
    view: { scrollY: 0 },
    state,
  };
}

function browserIsOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function usePersistentWorkoutSession<TState extends Record<string, unknown>>({
  draftKey,
  initialState,
  remote,
  autosaveMs = 800,
  captureScroll = true,
  onConflict,
}: Options<TState>): Result<TState> {
  const [envelope, setEnvelope] = useState<WorkoutDraftEnvelope<TState>>(
    () => readEmergencyDraft<TState>(draftKey) ?? createEnvelope(draftKey, initialState),
  );
  const [restored, setRestored] = useState(false);
  const [saveStatus, setSaveStatus] = useState<WorkoutSaveStatus>("restoring");

  const envelopeRef = useRef(envelope);
  const initialStateRef = useRef(initialState);
  const remoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteQueueRef = useRef<WorkoutDraftEnvelope<TState> | null>(null);
  const remoteRunRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);
  const clearedRef = useRef(false);
  const stateEditCountRef = useRef(0);
  const lastKnownScrollYRef = useRef(0);

  initialStateRef.current = initialState;

  const replaceEnvelope = useCallback((next: WorkoutDraftEnvelope<TState>) => {
    envelopeRef.current = next;
    if (mountedRef.current) setEnvelope(next);
  }, []);

  const runRemoteQueue = useCallback(async () => {
    if (remoteRunRef.current) return remoteRunRef.current;

    const run = async () => {
      while (remoteQueueRef.current) {
        const snapshot = remoteQueueRef.current;
        remoteQueueRef.current = null;

        if (!remote) {
          if (mountedRef.current) setSaveStatus("saved-locally");
          continue;
        }
        if (browserIsOffline()) {
          remoteQueueRef.current = snapshot;
          if (mountedRef.current) setSaveStatus("offline");
          break;
        }

        if (mountedRef.current) setSaveStatus("saving");

        try {
          const result = await saveDraftWithSingleRebaseRetry({
            draft: snapshot,
            getCurrentDraft: () => envelopeRef.current,
            remote,
            persistRebasedDraft: async (rebased) => {
              replaceEnvelope(rebased);
              await writeLocalDraft(rebased);
            },
          });
          const current = envelopeRef.current;

          if (!result.applied) {
            if (mountedRef.current) setSaveStatus("conflict");
            if (result.conflictDraft) onConflict?.(result.savedDraft, result.conflictDraft);
            continue;
          }

          const nextRemoteRevision = result.remoteRevision;
          if (current.localRevision === result.savedDraft.localRevision) {
            const synced = { ...current, remoteRevision: nextRemoteRevision };
            replaceEnvelope(synced);
            await writeLocalDraft(synced);
            if (mountedRef.current) setSaveStatus("saved");
          } else {
            // A newer edit happened while the request was in flight. Rebase it
            // on the confirmed server revision and send only that latest state.
            const rebased = { ...current, remoteRevision: nextRemoteRevision };
            replaceEnvelope(rebased);
            await writeLocalDraft(rebased);
            remoteQueueRef.current = rebased;
          }
        } catch {
          remoteQueueRef.current = snapshot;
          if (mountedRef.current) {
            setSaveStatus(browserIsOffline() ? "offline" : "error");
          }
          break;
        }
      }
    };

    remoteRunRef.current = run().finally(() => {
      remoteRunRef.current = null;
    });
    return remoteRunRef.current;
  }, [onConflict, remote, replaceEnvelope]);

  const pushRemote = useCallback(
    async (snapshot: WorkoutDraftEnvelope<TState>) => {
      remoteQueueRef.current = chooseNewestDraft(remoteQueueRef.current, snapshot);
      await runRemoteQueue();
    },
    [runRemoteQueue],
  );

  const queueRemoteSave = useCallback(
    (snapshot: WorkoutDraftEnvelope<TState>) => {
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
      remoteTimerRef.current = setTimeout(() => {
        remoteTimerRef.current = null;
        void pushRemote(snapshot);
      }, autosaveMs);
    },
    [autosaveMs, pushRemote],
  );

  const updateWorkout = useCallback(
    (update: WorkoutStateUpdater<TState>) => {
      const previous = envelopeRef.current;
      const nextState = typeof update === "function" ? update(previous.state) : update;
      if (nextState === previous.state) return;
      const next: WorkoutDraftEnvelope<TState> = {
        ...previous,
        localRevision: previous.localRevision + 1,
        updatedAt: new Date().toISOString(),
        state: nextState,
      };

      clearedRef.current = false;
      stateEditCountRef.current += 1;
      replaceEnvelope(next);
      if (mountedRef.current) {
        setSaveStatus(browserIsOffline() ? "offline" : remote ? "saving" : "saved-locally");
      }

      // localStorage is written synchronously inside this call. IndexedDB
      // follows immediately; the backend write is debounced and serialized.
      void writeLocalDraft(next);
      queueRemoteSave(next);
    },
    [queueRemoteSave, remote, replaceEnvelope],
  );

  const flush = useCallback(async () => {
    if (remoteTimerRef.current) {
      clearTimeout(remoteTimerRef.current);
      remoteTimerRef.current = null;
    }

    const current = envelopeRef.current;
    await writeLocalDraft(current);
    await pushRemote(current);
  }, [pushRemote]);

  const flushLatestImmediately = useCallback(async () => {
    if (remoteTimerRef.current) {
      clearTimeout(remoteTimerRef.current);
      remoteTimerRef.current = null;
    }

    const current = envelopeRef.current;
    await writeLocalDraft(current);
    if (!browserIsOffline()) await pushRemote(current);
  }, [pushRemote]);

  const recoverAndRetry = useCallback(async () => {
    if (clearedRef.current) return;
    if (remoteTimerRef.current) {
      clearTimeout(remoteTimerRef.current);
      remoteTimerRef.current = null;
    }

    const current = envelopeRef.current;
    await writeLocalDraft(current);

    const [local, remoteDraft] = await Promise.all([
      loadLocalDraft<TState>(draftKey),
      remote && !browserIsOffline()
        ? remote.load(draftKey).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (clearedRef.current) return;

    const recovered = recoverWorkoutDraft({ current: envelopeRef.current, local, remote: remoteDraft });
    replaceEnvelope(recovered.draft);
    await writeLocalDraft(recovered.draft);

    if (remote && !browserIsOffline() && recovered.shouldPushRemote) {
      await pushRemote(recovered.draft);
    } else if (remote && !browserIsOffline() && remoteQueueRef.current) {
      await runRemoteQueue();
    }
  }, [draftKey, remote, replaceEnvelope, pushRemote, runRemoteQueue]);

  const clearAfterCompletion = useCallback(async () => {
    if (remoteTimerRef.current) {
      clearTimeout(remoteTimerRef.current);
      remoteTimerRef.current = null;
    }
    remoteQueueRef.current = null;
    if (remoteRunRef.current) {
      await remoteRunRef.current.catch(() => undefined);
      remoteQueueRef.current = null;
    }

    // The caller invokes this only after the completed workout itself was
    // confirmed by the backend.
    if (remote) await remote.remove(draftKey);
    await deleteLocalDraft(draftKey);
    clearedRef.current = true;
    if (mountedRef.current) setSaveStatus("saved");
  }, [draftKey, remote]);

  useEffect(() => {
    mountedRef.current = true;
    clearedRef.current = false;
    setRestored(false);
    setSaveStatus("restoring");
    let cancelled = false;

    const restore = async () => {
      const emergency = readEmergencyDraft<TState>(draftKey);
      const pristine = createEnvelope(draftKey, initialStateRef.current);
      const base = emergency ?? pristine;
      const editsAtRestoreStart = stateEditCountRef.current;
      replaceEnvelope(base);

      let remoteFailed = false;
      const localPromise = loadLocalDraft<TState>(draftKey);
      const remotePromise = remote
        ? remote.load(draftKey).catch(() => {
            remoteFailed = true;
            return null;
          })
        : Promise.resolve(null);
      const [local, remoteDraft] = await Promise.all([localPromise, remotePromise]);
      if (cancelled) return;

      // A freshly-created empty envelope must never outrank a real remote
      // draft merely because its timestamp is newer.
      const newestLocal = chooseNewestDraft(emergency, local);
      const newest = chooseNewestDraft(newestLocal, remoteDraft);
      const editedDuringRestore = stateEditCountRef.current !== editsAtRestoreStart;
      const selected = editedDuringRestore
        ? (chooseNewestDraft(newest, envelopeRef.current) ?? envelopeRef.current)
        : (newest ?? pristine);
      replaceEnvelope(selected);
      await writeLocalDraft(selected);

      if (remote && newestLocal && selected === newestLocal && selected !== remoteDraft) {
        queueRemoteSave(selected);
      }

      if (captureScroll && typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            window.scrollTo({ top: selected.view.scrollY, behavior: "auto" });
          });
        });
      }

      if (!cancelled) {
        setRestored(true);
        setSaveStatus(
          remoteFailed
            ? browserIsOffline()
              ? "offline"
              : "error"
            : remote
              ? "saved"
              : "saved-locally",
        );
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [captureScroll, draftKey, queueRemoteSave, remote, replaceEnvelope]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let lastScrollWrite = 0;
    lastKnownScrollYRef.current = window.scrollY;

    const saveCurrentView = () => {
      lastKnownScrollYRef.current = window.scrollY;
      const now = Date.now();
      if (now - lastScrollWrite < 250 || clearedRef.current) return;
      lastScrollWrite = now;

      const current = envelopeRef.current;
      const withView = withWorkoutDraftView(current, lastKnownScrollYRef.current);
      if (withView === current) return;
      envelopeRef.current = withView;
      void writeLocalDraft(withView);
    };

    const saveBeforeBackground = () => {
      if (clearedRef.current) return;
      const current = envelopeRef.current;
      const withView = withWorkoutDraftView(current, lastKnownScrollYRef.current);
      replaceEnvelope(withView);
      void writeLocalDraft(withView);
      void flushLatestImmediately();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") saveBeforeBackground();
      if (document.visibilityState === "visible") void recoverAndRetry();
    };
    const handleOnline = () => {
      if (!clearedRef.current) void recoverAndRetry();
    };

    if (captureScroll) window.addEventListener("scroll", saveCurrentView, { passive: true });
    window.addEventListener("pagehide", saveBeforeBackground);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (captureScroll) window.removeEventListener("scroll", saveCurrentView);
      window.removeEventListener("pagehide", saveBeforeBackground);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [captureScroll, flushLatestImmediately, recoverAndRetry, replaceEnvelope]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
      if (!clearedRef.current) void writeLocalDraft(envelopeRef.current);
    },
    [],
  );

  return {
    workoutState: envelope.state,
    restored,
    saveStatus,
    updateWorkout,
    flush,
    clearAfterCompletion,
  };
}
