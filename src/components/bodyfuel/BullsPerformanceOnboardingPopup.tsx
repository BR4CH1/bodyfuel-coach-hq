/**
 * BullsPerformanceOnboardingPopup — Blocking modal that appears immediately
 * for existing Bulls athletes whose Performance/Nutrition profile is
 * incomplete. The Auto-Plan Pipeline cannot generate a plan without this
 * data, so we force the user to complete it before continuing in the hub.
 *
 * Mounted inside BullsGate so it shows on every /bulls/* page.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, X } from "lucide-react";
import { getBullsDailyNutritionTargets } from "@/lib/performance-nutrition/bulls-nutrition.functions";
import { useSession } from "@/lib/bodyfuel/session";

const todayIso = () => new Date().toISOString().slice(0, 10);
// Wird täglich einmal beim ersten Login gezeigt, solange Onboarding nicht komplett ist.
const DISMISS_KEY = "bf:bulls-onboarding-popup:dismissed-date";

export function BullsPerformanceOnboardingPopup() {
  const { supabaseUser } = useSession();
  // Initial true, damit vor Hydration nichts blitzt; nach Mount neu bewerten.
  const [dismissedToday, setDismissedToday] = useState(true);
  const getTargets = useServerFn(getBullsDailyNutritionTargets);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_KEY);
      setDismissedToday(stored === todayIso());
    } catch {
      setDismissedToday(false);
    }
  }, []);

  const { data } = useQuery({
    queryKey: ["bulls-perf-onboarding-check", supabaseUser?.id],
    queryFn: () => getTargets({ data: { date: todayIso() } }),
    enabled: !!supabaseUser?.id,
    staleTime: 60_000,
    retry: false,
  });

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, todayIso());
    } catch {}
    setDismissedToday(true);
  };

  if (!data?.needsProfile || dismissedToday) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-bulls-red/50 bg-card p-6 shadow-2xl">
        <button
          type="button"
          aria-label="Später"
          onClick={() => dismiss()}
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-bulls-red" />
          <div className="text-xs uppercase tracking-[0.2em] text-bulls-red">
            Performance-Profil fehlt
          </div>
        </div>

        <h2 className="mt-3 font-display text-xl font-bold">
          Vervollständige dein Bulls-Profil
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Damit dein individueller Ernährungsplan automatisch erstellt und
          wöchentlich angepasst werden kann, brauchen wir noch ein paar
          Angaben: Biometrie, Ziel, Lieblingsfoods, No-Gos, Allergien und
          Meal-Prep-Vorlieben.
        </p>

        <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          <li>• Dauert ca. 2 Minuten</li>
          <li>• Coach plant Training – BodyFuel plant deine Ernährung</li>
          <li>• Kein manuelles „Plan erstellen“ mehr nötig</li>
        </ul>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <Link
            to="/$orgSlug/onboarding"
            params={{ orgSlug: "bulls" }}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-bulls-red px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-bulls-red/90"
          >
            Jetzt vervollständigen
          </Link>
          <button
            type="button"
            onClick={() => dismiss()}
            className="rounded-xl border border-border px-4 py-3 text-xs text-muted-foreground hover:text-foreground"
          >
            Später
          </button>
        </div>
      </div>
    </div>
  );
}
