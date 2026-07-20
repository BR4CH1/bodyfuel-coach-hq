import { useEffect, useRef } from "react";

/**
 * Bewahrt die Scroll-Position einer Seite und stellt sie beim Re-Mount /
 * Tab- oder App-Wechsel wieder her.
 *
 * Robust gegen iOS PWAs: speichert den letzten bekannten scrollY in einem Ref
 * (statt window.scrollY beim pagehide auszulesen, das kann dann schon 0 sein),
 * und versucht beim Restore mehrfach zu scrollen, bis Content geladen ist.
 */
export function useScrollRestore(key: string, ready: boolean = true) {
  const lastYRef = useRef<number>(0);
  const storageKey = `bf.scroll.${key}`;

  // Restore beim Mount und immer wenn `ready` true wird oder die Seite wieder sichtbar wird.
  useEffect(() => {
    if (typeof window === "undefined" || !ready) return;

    let cancelled = false;
    const doRestore = () => {
      let raw: string | null = null;
      try {
        raw = sessionStorage.getItem(storageKey);
      } catch {
        return;
      }
      if (!raw) return;
      const target = Number(raw);
      if (!Number.isFinite(target) || target <= 0) return;

      let attempts = 0;
      const tryScroll = () => {
        if (cancelled) return;
        const maxY = Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight,
        );
        const goal = Math.min(target, maxY);
        window.scrollTo({ top: goal, behavior: "auto" });
        lastYRef.current = goal;
        attempts++;
        // Bis ~3s nachjustieren, falls Content asynchron lädt.
        if (attempts < 30 && (maxY < target || Math.abs(window.scrollY - target) > 4)) {
          setTimeout(tryScroll, 100);
        }
      };
      requestAnimationFrame(tryScroll);
    };

    doRestore();

    const onVis = () => {
      if (document.visibilityState === "visible") doRestore();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", doRestore);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", doRestore);
    };
  }, [storageKey, ready]);

  // Save: letzten bekannten scrollY tracken und speichern.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const writeStorage = (y: number) => {
      try {
        sessionStorage.setItem(storageKey, String(y));
      } catch {
        /* ignore */
      }
    };

    let t: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      const y = window.scrollY;
      // 0 nur akzeptieren, wenn der User wirklich oben ist (nicht durch
      // iOS-Browser-Reset bei App-Wechsel).
      if (y > 0) lastYRef.current = y;
      if (t) clearTimeout(t);
      t = setTimeout(() => writeStorage(y > 0 ? y : lastYRef.current), 120);
    };

    const flush = () => writeStorage(lastYRef.current);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });

    return () => {
      if (t) clearTimeout(t);
      flush();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [storageKey]);
}
