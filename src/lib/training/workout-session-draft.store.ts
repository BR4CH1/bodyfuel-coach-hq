import type { WorkoutDraftEnvelope } from "./workout-session-draft.types";

const DB_NAME = "bodyfuel-workout-drafts";
const DB_VERSION = 1;
const STORE_NAME = "drafts";
const EMERGENCY_PREFIX = "bf.workout-draft.v1.";
const DEVICE_ID_KEY = "bf.workout-device-id.v1";

let databasePromise: Promise<IDBDatabase> | null = null;

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined";
}

function emergencyKey(draftKey: string): string {
  return `${EMERGENCY_PREFIX}${encodeURIComponent(draftKey)}`;
}

export function isWorkoutDraftEnvelope<TState extends Record<string, unknown>>(
  value: unknown,
  draftKey?: string,
): value is WorkoutDraftEnvelope<TState> {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<WorkoutDraftEnvelope<TState>>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.draftKey === "string" &&
    (!draftKey || candidate.draftKey === draftKey) &&
    typeof candidate.deviceId === "string" &&
    typeof candidate.localRevision === "number" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.view?.scrollY === "number" &&
    typeof candidate.state === "object" &&
    candidate.state !== null
  );
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "draftKey" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return databasePromise;
}

function runTransaction<TResult>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<TResult>,
): Promise<TResult> {
  return openDatabase().then(
    (database) =>
      new Promise<TResult>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      }),
  );
}

export function getOrCreateWorkoutDeviceId(): string {
  if (!canUseBrowserStorage()) return "server-render";

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function readEmergencyDraft<TState extends Record<string, unknown>>(
  draftKey: string,
): WorkoutDraftEnvelope<TState> | null {
  if (!canUseBrowserStorage()) return null;

  try {
    const raw = window.localStorage.getItem(emergencyKey(draftKey));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return isWorkoutDraftEnvelope<TState>(parsed, draftKey) ? parsed : null;
  } catch {
    return null;
  }
}

export function chooseNewestDraft<TState extends Record<string, unknown>>(
  first: WorkoutDraftEnvelope<TState> | null,
  second: WorkoutDraftEnvelope<TState> | null,
): WorkoutDraftEnvelope<TState> | null {
  if (!first) return second;
  if (!second) return first;

  // Revisions from the same browser/device are authoritative even if the
  // device clock changed while the workout was running.
  if (first.deviceId === second.deviceId && first.localRevision !== second.localRevision) {
    return first.localRevision > second.localRevision ? first : second;
  }

  const firstTime = Date.parse(first.updatedAt);
  const secondTime = Date.parse(second.updatedAt);
  if (Number.isFinite(firstTime) && Number.isFinite(secondTime) && firstTime !== secondTime) {
    return firstTime > secondTime ? first : second;
  }

  if ((first.remoteRevision ?? -1) !== (second.remoteRevision ?? -1)) {
    return (first.remoteRevision ?? -1) > (second.remoteRevision ?? -1) ? first : second;
  }

  return first.localRevision >= second.localRevision ? first : second;
}

export async function loadLocalDraft<TState extends Record<string, unknown>>(
  draftKey: string,
): Promise<WorkoutDraftEnvelope<TState> | null> {
  const emergency = readEmergencyDraft<TState>(draftKey);
  if (!canUseBrowserStorage() || typeof indexedDB === "undefined") {
    return emergency;
  }

  try {
    const indexed = await runTransaction<WorkoutDraftEnvelope<TState> | undefined>(
      "readonly",
      (store) => store.get(draftKey),
    );
    const validIndexed = isWorkoutDraftEnvelope<TState>(indexed, draftKey) ? indexed : null;
    return chooseNewestDraft(emergency, validIndexed);
  } catch {
    return emergency;
  }
}

export async function writeLocalDraft<TState extends Record<string, unknown>>(
  draft: WorkoutDraftEnvelope<TState>,
): Promise<void> {
  if (!canUseBrowserStorage()) return;

  // This write happens synchronously before the first await. It is the
  // emergency snapshot used when iOS freezes or kills the PWA immediately.
  try {
    window.localStorage.setItem(emergencyKey(draft.draftKey), JSON.stringify(draft));
  } catch {
    // IndexedDB remains the second local persistence layer.
  }

  if (typeof indexedDB === "undefined") return;

  try {
    await runTransaction<IDBValidKey>("readwrite", (store) => store.put(draft));
  } catch {
    // The synchronous emergency snapshot has already been attempted.
  }
}

export async function deleteLocalDraft(draftKey: string): Promise<void> {
  if (!canUseBrowserStorage()) return;

  try {
    window.localStorage.removeItem(emergencyKey(draftKey));
  } catch {
    // Continue with IndexedDB cleanup.
  }

  if (typeof indexedDB === "undefined") return;

  try {
    await runTransaction<undefined>("readwrite", (store) => store.delete(draftKey));
  } catch {
    // A failed cleanup is safer than losing an active workout prematurely.
  }
}
