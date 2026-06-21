import { useEffect } from "react";

/**
 * Bewahrt die Scroll-Position einer Seite, wenn der Nutzer wegnavigiert
 * (Tab-Switch, Routen-Wechsel) und stellt sie beim Re-Mount wieder her.
 *
 * Verwendet sessionStorage, damit die Position nur innerhalb der laufenden
 * Browser-Session erhalten bleibt. Wird mehrfach versucht, da Content
 * asynchron geladen wird und die Seitenhöhe erst nach dem Render steht.
 */
export function useScrollRestore(key: string, ready: boolean = true) {
  // Restore on mount / when ready flips true
  useEffect(() => {
    if (typeof window === "undefined" || !ready) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(`bf.scroll.${key}`);
    } catch {
      return;
    }
    if (!raw) return;
    const target = Number(raw);
    if (!Number.isFinite(target) || target <= 0) return;

    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const maxY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      window.scrollTo({ top: Math.min(target, maxY), behavior: "auto" });
      attempts++;
      // Content lädt nach – bis 1.5s nachjustieren
      if (attempts < 15 && Math.abs(window.scrollY - target) > 4 && maxY < target) {
        setTimeout(tryScroll, 100);
      }
    };
    // erst nach dem Paint
    requestAnimationFrame(tryScroll);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  // Save continuously + on unmount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const save = () => {
      try {
        sessionStorage.setItem(`bf.scroll.${key}`, String(window.scrollY));
      } catch {
        /* ignore */
      }
    };
    let t: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (t) clearTimeout(t);
      t = setTimeout(save, 120);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      if (t) clearTimeout(t);
      save();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, [key]);
}
