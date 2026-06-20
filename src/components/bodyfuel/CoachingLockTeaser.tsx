import { useState } from "react";
import { Lock, X } from "lucide-react";
import { UpgradeCard } from "./UpgradeCard";

type Props = {
  title?: string;
  features: string[];
  className?: string;
};

/**
 * Dezenter Upsell für Coaching-Features. Beim Klick öffnet sich ein Dialog
 * mit Upgrade-Optionen auf Smart oder Coaching.
 */
export function CoachingLockTeaser({
  title = "Mit Coaching freischalten",
  features,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group block w-full text-left rounded-2xl border border-dashed border-border bg-card/40 p-4 transition hover:border-primary/40 hover:bg-card/60 ${className ?? ""}`}
      >
        <div className="flex items-start gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted/60">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
              </p>
              <span className="text-[10px] uppercase tracking-wider text-primary opacity-0 transition group-hover:opacity-100">
                Upgraden →
              </span>
            </div>
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {features.map((f) => (
                <li key={f} className="before:mr-1 before:content-['•']">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative my-8 w-full max-w-xl rounded-2xl bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Schließen"
              className="absolute right-3 top-3 z-10 rounded-full bg-background p-2 shadow hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="p-4 pt-12">
              <UpgradeCard currentTier="free" source="lock_teaser" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
