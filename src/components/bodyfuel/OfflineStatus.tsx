import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { onQueueChange, flushQueue } from "@/lib/offline/queue";

// Verify real connectivity (navigator.onLine lies on iOS/Safari/PWA).
async function ping(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch("/favicon.ico?_=" + Date.now(), {
      method: "HEAD",
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.ok || res.status === 0 || res.type === "opaque";
  } catch {
    return false;
  }
}

export function OfflineStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const recheck = async () => {
      const ok = await ping();
      if (cancelled) return;
      setOnline(ok);
      if (ok) void flushQueue();
    };

    void recheck();
    const iv = setInterval(recheck, 15000);
    const onChange = () => void recheck();
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    document.addEventListener("visibilitychange", onChange);

    const off = onQueueChange(setPending);
    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
      document.removeEventListener("visibilitychange", onChange);
      off();
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div
      className={
        "pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider shadow-lg backdrop-blur " +
        (online
          ? "bg-gold/15 text-gold border border-gold/40"
          : "bg-destructive/15 text-destructive border border-destructive/40")
      }
    >
      {online ? (
        <span className="inline-flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3 animate-spin" />
          {pending} sync
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <CloudOff className="h-3 w-3" />
          Offline {pending > 0 ? `· ${pending} gespeichert` : ""}
        </span>
      )}
    </div>
  );
}
