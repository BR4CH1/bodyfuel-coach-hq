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
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  // Restore once on mount.
  useEffect(() => {
    if (!enabled || !key || restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<T>;
      restoreRef.current(parsed);
    } catch {
      // ignore corrupt drafts
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  // Persist on change (debounced).
  useEffect(() => {
    if (!enabled || !key || !restored.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(values));
      } catch {
        // quota / private mode — ignore
      }
    }, debounceMs);
    return () => clearTimeout(t);
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
