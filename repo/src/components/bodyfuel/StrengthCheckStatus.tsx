import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Dumbbell, ShieldAlert, TimerReset, Trophy } from "lucide-react";
import { getMyStrengthStatus, type StrengthStatus } from "@/lib/strength-check.functions";

type Variant = "block" | "card";

/**
 * Reusable banner for the BodyFuel Strength Check.
 *
 * - "block" variant: large prominent CTA used on the Training page when the
 *   user has not completed the first check yet. Returns null when completed.
 * - "card" variant: dashboard summary — shows the latest score with a hint
 *   when the next check is due / overdue, or a CTA when no check exists yet.
 */
export function StrengthCheckStatus({ variant = "card" }: { variant?: Variant }) {
  const statusFn = useServerFn(getMyStrengthStatus);
  const [status, setStatus] = useState<StrengthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    statusFn().then((s) => { if (!cancelled) setStatus(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [statusFn]);

  if (!status) return null;

  const neverDone = !status.has_ever_completed;
  const overdue = status.is_overdue;
  const dueSoon = !overdue && status.days_until_due != null && status.days_until_due <= 12;

  if (variant === "block") {
    if (!neverDone && !overdue) return null;
    return (
      <Link
        to="/strength-check"
        className="group flex items-center justify-between gap-3 rounded-2xl border border-red-500/40 bg-red-500/5 p-5 transition hover:border-red-500/70"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-300">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-red-300">
              {neverDone ? "Pflichttest fehlt" : "Strength Check fällig"}
            </div>
            <div className="font-display text-base font-bold">
              {neverDone ? "Starte deinen BodyFuel Strength Check" : "Dein 6-Wochen-Check ist wieder fällig"}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              7 kurze Tests, danach individuelle Startgewichte &amp; Auswertung.
            </div>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200">
          Jetzt starten <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </Link>
    );
  }

  // card variant
  if (neverDone) {
    return (
      <Link
        to="/strength-check"
        className="group flex items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 to-transparent p-5 transition hover:border-gold/70"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-gold">Strength Check</div>
            <div className="font-display text-base font-bold">Bestimme dein Leistungsniveau</div>
            <div className="truncate text-xs text-muted-foreground">
              7 Übungen, dauert ~20 Min. Verdient +25 Punkte.
            </div>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gradient-gold px-3 py-2 text-xs font-semibold text-primary-foreground">
          Starten <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </Link>
    );
  }

  const last = status.last!;
  const borderColor = overdue ? "border-amber-500/50" : dueSoon ? "border-gold/30" : "border-border";

  return (
    <Link
      to="/strength-check"
      className={`flex items-center justify-between gap-3 rounded-2xl border bg-card p-5 transition hover:border-gold/60 ${borderColor}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-gold">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">BodyFuel Strength Score</div>
          <div className="font-display text-base font-bold">
            {last.score_total ?? "—"}<span className="ml-1 text-xs text-muted-foreground">/100</span>
            {overdue && <span className="ml-2 text-[11px] font-semibold text-amber-300">fällig</span>}
            {!overdue && dueSoon && (
              <span className="ml-2 text-[11px] font-semibold text-gold">
                in {status.days_until_due}d
              </span>
            )}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            <TimerReset className="mr-1 inline h-3 w-3" />
            zuletzt {new Date(last.performed_at).toLocaleDateString("de-DE")}
          </div>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">→</span>
    </Link>
  );
}
