export type CachedTrainingPlan = {
  id: string;
  client_id: string;
  title: string;
  weeks_count?: number | null;
  scheduled_start_date?: string | null;
};

export type CachedTrainingDay = {
  id: string;
  name: string;
  sort_order: number;
  week_number?: number | null;
  day_date?: string | null;
};

export type CachedTrainingExercise = {
  id: string;
  day_id: string;
  name: string;
  category?: string | null;
  target_sets: number | null;
  target_reps: string | null;
  target_weights?: string | null;
  target_rir?: number | null;
  rest_seconds?: number | null;
  notes: string | null;
  sort_order: number;
  added_by_user?: string | null;
};

export type CachedTrainingSetLog = {
  id: string;
  exercise_id: string;
  client_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  performed_at: string;
};

export type TrainingTrackerSnapshot = {
  version: 1;
  clientId: string;
  updatedAt: string;
  plan: CachedTrainingPlan;
  days: CachedTrainingDay[];
  exercises: CachedTrainingExercise[];
  logs: CachedTrainingSetLog[];
  activeWeek: number;
  weeksCount: number;
};

const VERSION = 1 as const;
const KEY_PREFIX = "bf.tt.snapshot.v1.";
const INDEX_KEY = "bf.tt.snapshot-index.v1";
const MAX_CLIENT_SNAPSHOTS = 4;
const MAX_CACHED_LOGS = 400;

type SnapshotIndexEntry = { clientId: string; updatedAt: string };

function snapshotKey(clientId: string) {
  return `${KEY_PREFIX}${clientId}`;
}

function readIndex(): SnapshotIndexEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as SnapshotIndexEntry[]) : [];
  } catch {
    return [];
  }
}

function touchIndex(clientId: string, updatedAt: string) {
  const next = [
    { clientId, updatedAt },
    ...readIndex().filter((entry) => entry.clientId !== clientId),
  ].slice(0, MAX_CLIENT_SNAPSHOTS);

  const keep = new Set(next.map((entry) => entry.clientId));
  for (const entry of readIndex()) {
    if (!keep.has(entry.clientId)) localStorage.removeItem(snapshotKey(entry.clientId));
  }
  localStorage.setItem(INDEX_KEY, JSON.stringify(next));
}

export function readTrainingTrackerSnapshot(clientId: string): TrainingTrackerSnapshot | null {
  if (typeof window === "undefined" || !clientId) return null;
  try {
    const raw = localStorage.getItem(snapshotKey(clientId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TrainingTrackerSnapshot>;
    if (
      parsed.version !== VERSION ||
      parsed.clientId !== clientId ||
      !parsed.plan?.id ||
      !Array.isArray(parsed.days) ||
      !Array.isArray(parsed.exercises) ||
      !Array.isArray(parsed.logs)
    ) {
      localStorage.removeItem(snapshotKey(clientId));
      return null;
    }
    return parsed as TrainingTrackerSnapshot;
  } catch {
    return null;
  }
}

export function writeTrainingTrackerSnapshot(
  snapshot: Omit<TrainingTrackerSnapshot, "version" | "updatedAt">,
) {
  if (typeof window === "undefined" || !snapshot.clientId || !snapshot.plan?.id) return;
  const updatedAt = new Date().toISOString();
  const compact: TrainingTrackerSnapshot = {
    ...snapshot,
    version: VERSION,
    updatedAt,
    logs: [...snapshot.logs]
      .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())
      .slice(0, MAX_CACHED_LOGS),
  };

  try {
    localStorage.setItem(snapshotKey(snapshot.clientId), JSON.stringify(compact));
    touchIndex(snapshot.clientId, updatedAt);
  } catch {
    // Storage can be unavailable or full in private browsing. The live tracker
    // keeps working; server data remains the source of truth.
  }
}

export function clearTrainingTrackerSnapshot(clientId: string) {
  if (typeof window === "undefined" || !clientId) return;
  try {
    localStorage.removeItem(snapshotKey(clientId));
    localStorage.setItem(
      INDEX_KEY,
      JSON.stringify(readIndex().filter((entry) => entry.clientId !== clientId)),
    );
  } catch {
    /* optional browser cache */
  }
}
