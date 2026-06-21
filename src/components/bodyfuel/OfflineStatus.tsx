import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { onQueueChange } from "@/lib/offline/queue";

export function OfflineStatus() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const upOn = () => setOnline(true);
    const upOff = () => setOnline(false);
    window.addEventListener("online", upOn);
    window.addEventListener("offline", upOff);
    const off = onQueueChange(setPending);
    return () => {
      window.removeEventListener("online", upOn);
      window.removeEventListener("offline", upOff);
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
