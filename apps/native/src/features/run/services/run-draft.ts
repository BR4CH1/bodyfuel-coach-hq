import AsyncStorage from '@react-native-async-storage/async-storage';

import { recoverRunSession, type RunSession } from '../domain/run-session';

const RUN_DRAFT_KEY = 'bodyfuel.native.run-draft.v1';
const RUN_HISTORY_KEY = 'bodyfuel.native.run-history.v1';
const MAX_LOCAL_RUNS = 30;
const historyListeners = new Set<() => void>();

type StoredRunDraft = {
  schemaVersion: 1;
  savedAtMs: number;
  session: RunSession;
};

type StoredRunHistory = {
  schemaVersion: 1;
  sessions: RunSession[];
};

function isCompletedRun(candidate: unknown): candidate is RunSession {
  if (!candidate || typeof candidate !== 'object') return false;
  const session = candidate as Partial<RunSession>;
  return (
    session.status === 'completed' &&
    typeof session.id === 'string' &&
    typeof session.startedAtMs === 'number' &&
    typeof session.endedAtMs === 'number' &&
    Array.isArray(session.points)
  );
}

function parseHistory(raw: string | null): RunSession[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<StoredRunHistory>;
    return parsed.schemaVersion === 1 && Array.isArray(parsed.sessions)
      ? parsed.sessions.filter(isCompletedRun)
      : [];
  } catch {
    return [];
  }
}

function isStoredRunDraft(value: unknown): value is StoredRunDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<StoredRunDraft>;
  return (
    draft.schemaVersion === 1 &&
    typeof draft.savedAtMs === 'number' &&
    Boolean(draft.session) &&
    typeof draft.session?.status === 'string' &&
    Array.isArray(draft.session?.points)
  );
}

export async function saveRunDraft(session: RunSession, savedAtMs: number): Promise<void> {
  const draft: StoredRunDraft = { schemaVersion: 1, savedAtMs, session };
  await AsyncStorage.setItem(RUN_DRAFT_KEY, JSON.stringify(draft));
}

export async function loadRunDraft(): Promise<RunSession | null> {
  const raw = await AsyncStorage.getItem(RUN_DRAFT_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredRunDraft(parsed)) {
      await clearRunDraft();
      return null;
    }
    return recoverRunSession(parsed.session);
  } catch {
    await clearRunDraft();
    return null;
  }
}

export async function clearRunDraft(): Promise<void> {
  await AsyncStorage.removeItem(RUN_DRAFT_KEY);
}

export async function saveCompletedRun(session: RunSession): Promise<void> {
  if (session.status !== 'completed' || !session.id) {
    throw new Error('Nur abgeschlossene Läufe können im Verlauf gespeichert werden.');
  }

  const sessions = parseHistory(await AsyncStorage.getItem(RUN_HISTORY_KEY));

  const next: StoredRunHistory = {
    schemaVersion: 1,
    sessions: [session, ...sessions.filter((candidate) => candidate.id !== session.id)].slice(
      0,
      MAX_LOCAL_RUNS,
    ),
  };
  await AsyncStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(next));
  historyListeners.forEach((listener) => listener());
}

export async function loadCompletedRuns(): Promise<RunSession[]> {
  return parseHistory(await AsyncStorage.getItem(RUN_HISTORY_KEY));
}

export function subscribeToRunHistory(listener: () => void): () => void {
  historyListeners.add(listener);
  return () => historyListeners.delete(listener);
}
