import { useEffect, useRef } from "react";

/**
 * Persistiert eine Form-/Tracker-State-Map in localStorage und stellt sie beim
 * nächsten Mount wieder her. So bleiben Eingaben erhalten, wenn das Handy
 * tastengesperrt wird, der Tab in den Hintergrund geht oder die PWA neu lädt.
 *
 * Verwendung:
 *   const [name, setName] = useState("");
 *   const [note, setNote] = useState("");
 *   useFormDraft("bf.coach.newCustomer.v1", { name, note }, (d) => {
 *     if (d.name != null) setName(d.name);
 *     if (d.note != null) setNote(d.note);
 *   });
 *
 * Aufruf von `clearFormDraft(key)` nach erfolgreichem Speichern, damit
 * gespeicherte Werte nicht zurückkommen.
 */
export function useFormDraft<T extends Record<string, unknown>>(
  key: string | null | undefined,
  values: T,
  restore: (draft: Partial<T>) => void,
  options: { enabled?: boolean; debounceMs?: number } = {},
) {
  const { enabled = true, debounceMs = 250 } = options;
  const restored = useRef(false);
  const restoredKey = useRef<string | null>(null);
  const skipInitialPersist = useRef(false);
  const restoreRef = useRef(restore);
  const latestSerialized = useRef<string | null>(null);
  restoreRef.current = restore;

  // Restore once on mount.
  useEffect(() => {
    if (!enabled || !key || restoredKey.current === key) return;
    restoredKey.current = key;
    restored.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<T>;
      skipInitialPersist.current = true;
      restoreRef.current(parsed);
    } catch {
      // ignore corrupt drafts
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  // Persist on change (debounced).
  useEffect(() => {
    if (!enabled || !key || !restored.current) return;
    if (skipInitialPersist.current) {
      skipInitialPersist.current = false;
      return;
    }
    const serialized = JSON.stringify(values);
    latestSerialized.current = serialized;
    const write = () => {
      try {
        localStorage.setItem(key, latestSerialized.current ?? serialized);
      } catch {
        // quota / private mode — ignore
      }
    };
    const t = setTimeout(() => {
      write();
    }, debounceMs);
    const flushOnHide = () => {
      if (document.visibilityState === "hidden") write();
    };
    window.addEventListener("pagehide", write);
    window.addEventListener("beforeunload", write);
    document.addEventListener("visibilitychange", flushOnHide);
    return () => {
      clearTimeout(t);
      write();
      window.removeEventListener("pagehide", write);
      window.removeEventListener("beforeunload", write);
      document.removeEventListener("visibilitychange", flushOnHide);
    };
  }, [key, enabled, debounceMs, JSON.stringify(values)]);
}

export function clearFormDraft(key: string | null | undefined) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}
