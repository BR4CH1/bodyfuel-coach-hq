// Offline write queue for training set logs + exercise notes.
// Persists pending writes in IndexedDB and drains them when back online.

import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";
import {
  TRAINING_SET_LOG_UPSERT_CONFLICT,
  buildTrainingSetLogUpsert,
} from "@/lib/training/training-set-log.logic";

type PendingSetLog = {
  kind: "set_log";
  client_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  logged_at: string;
  training_date?: string | null;
};

type PendingNote = {
  kind: "exercise_note";
  client_id: string;
  exercise_id: string;
  note_date: string; // YYYY-MM-DD
  note: string;
};

export type PendingItem = (PendingSetLog | PendingNote) & {
  id?: number;
  created_at: string;
  attempts?: number;
};

const DB_NAME = "bf-offline";
const STORE = "queue";
const VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDB() {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

export function onQueueChange(fn: Listener): () => void {
  listeners.add(fn);
  void pendingCount().then(fn);
  return () => listeners.delete(fn);
}

async function notify() {
  const c = await pendingCount();
  listeners.forEach((l) => l(c));
}

export async function pendingCount(): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  return db.count(STORE);
}

export type EnqueueInput =
  | Omit<PendingSetLog, never>
  | Omit<PendingNote, never>;

export async function enqueue(item: EnqueueInput) {
  const db = await getDB();
  if (!db) throw new Error("IndexedDB nicht verfügbar");
  const payload = {
    ...item,
    created_at: new Date().toISOString(),
    attempts: 0,
  } as PendingItem;
  const id = await db.add(STORE, payload);
  await notify();
  return id as number;
}

export async function listPending(): Promise<PendingItem[]> {
  const db = await getDB();
  if (!db) return [];
  return (await db.getAll(STORE)) as PendingItem[];
}

async function removeItem(id: number) {
  const db = await getDB();
  if (!db) return;
  await db.delete(STORE, id);
}

async function bumpAttempt(item: PendingItem) {
  const db = await getDB();
  if (!db || item.id == null) return;
  await db.put(STORE, { ...item, attempts: (item.attempts ?? 0) + 1 });
}

async function applyItem(item: PendingItem): Promise<{ ok: boolean; fatal?: boolean }> {
  try {
    if (item.kind === "set_log") {
      const { error } = await supabase.from("training_set_logs").upsert(
        buildTrainingSetLogUpsert(
          {
            exercise_id: item.exercise_id,
            set_number: item.set_number,
            weight_kg: item.weight_kg,
            reps: item.reps,
            training_date: item.training_date,
            performed_at: item.logged_at,
          },
          item.client_id,
          item.logged_at,
        ),
        { onConflict: TRAINING_SET_LOG_UPSERT_CONFLICT },
      );
      if (error) return { ok: false };
      return { ok: true };
    }
    if (item.kind === "exercise_note") {
      const { error } = await supabase
        .from("training_exercise_notes")
        .upsert(
          {
            exercise_id: item.exercise_id,
            client_id: item.client_id,
            note_date: item.note_date,
            note: item.note,
          },
          { onConflict: "exercise_id,client_id,note_date" },
        );
      if (error) return { ok: false };
      return { ok: true };
    }
    return { ok: false, fatal: true };
  } catch {
    return { ok: false };
  }
}

let syncing = false;

export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const items = await listPending();
    // Coalesce notes: keep only the latest note per (exercise,date).
    const noteKey = (i: PendingItem) =>
      i.kind === "exercise_note" ? `${i.exercise_id}|${i.note_date}` : null;
    const latestNoteId = new Map<string, number>();
    for (const i of items) {
      const k = noteKey(i);
      if (k && i.id != null) latestNoteId.set(k, i.id);
    }
    for (const item of items) {
      if (item.id == null) continue;
      const k = noteKey(item);
      if (k && latestNoteId.get(k) !== item.id) {
        // outdated duplicate
        await removeItem(item.id);
        continue;
      }
      const r = await applyItem(item);
      if (r.ok) {
        await removeItem(item.id);
        synced++;
      } else if (r.fatal || (item.attempts ?? 0) > 8) {
        await removeItem(item.id);
        failed++;
      } else {
        await bumpAttempt(item);
        failed++;
      }
    }
  } finally {
    syncing = false;
    await notify();
  }
  return { synced, failed };
}

let attached = false;
export function attachOfflineSync() {
  if (typeof window === "undefined" || attached) return;
  attached = true;
  window.addEventListener("online", () => {
    void flushQueue();
  });
  // Also try when the page becomes visible again (mobile lock screens).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) void flushQueue();
  });
  // First-pass drain on boot.
  if (navigator.onLine) void flushQueue();
}
