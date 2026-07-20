import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { getPublishedCheckinForClient } from "@/lib/checkin-ai.functions";

const STORAGE_KEY = "bf.checkin-result.seen";

/**
 * Zeigt einmalig einen Popup-Hinweis, sobald der Coach das Check-in-Ergebnis
 * für den Kunden freigegeben hat. Die publizierte Draft-ID wird in
 * localStorage vermerkt, damit der Popup nach dem Wegklicken nicht wieder
 * auftaucht.
 */
export function CheckinResultNotifier() {
  const fn = useServerFn(getPublishedCheckinForClient);
  const { data } = useQuery({
    queryKey: ["published-checkin-notifier"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  const published = data?.item ?? null;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!published) return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (seen !== published.id) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [published]);

  if (!open || !published) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, published.id);
    } catch {
      /* noop */
    }
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-gold/40 bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold">
            <Sparkles className="h-4 w-4" />
            Neues Coach-Feedback
          </div>
          <button
            type="button"
            aria-label="Schließen"
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-2 font-display text-lg font-bold">
          Dein Coach hat deinen Check-in bearbeitet.
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Schau dir jetzt dein persönliches Ergebnis und die nächsten Schritte an.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          <Link
            to="/check-in"
            onClick={dismiss}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-gold px-4 py-2 text-sm font-bold text-background hover:bg-gold/90"
          >
            Zum Ergebnis →
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-border bg-background/40 px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Später
          </button>
        </div>
      </div>
    </div>
  );
}
