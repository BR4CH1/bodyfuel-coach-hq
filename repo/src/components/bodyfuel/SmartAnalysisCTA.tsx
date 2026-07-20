import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getMySmartProfile } from "@/lib/smart-profile.functions";

/**
 * Shown on the dashboard while the user has NOT completed the smart-nutrition
 * analysis. Once completed_at is set, this component renders nothing — the
 * day-type question already appears in the nutrition/training flow.
 */
export function SmartAnalysisCTA() {
  const getFn = useServerFn(getMySmartProfile);
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getFn();
        if (!cancelled) setDone(!!p?.completed_at);
      } catch {
        if (!cancelled) setDone(true); // fail-closed: don't nag on error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getFn]);

  if (done !== false) return null;

  return (
    <Link
      to="/onboarding/smart-nutrition"
      className="group flex items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 to-transparent p-5 transition hover:border-gold/70"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-gold">Analyse offen</div>
          <div className="font-display text-base font-bold">
            Beantworte deine Ernährungs-Analyse
          </div>
          <div className="truncate text-xs text-muted-foreground">
            Damit wir Trainings- &amp; Restdays automatisch erkennen.
          </div>
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gradient-gold px-3 py-2 text-xs font-semibold text-primary-foreground">
        Jetzt starten
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
