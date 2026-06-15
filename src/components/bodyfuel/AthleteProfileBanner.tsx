import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { getMyAthleteProfile } from "@/lib/athlete-profile.functions";

/**
 * Shows a soft banner that nudges the user to fill out the extended
 * athlete profile (team sport, classes, mobility, …).
 *
 * If `force` is true we render the banner even when the profile is already
 * "complete enough" — used right after the strength-check completion screen
 * to make sure athletes review the new fields.
 */
export function AthleteProfileBanner({
  force = false,
  variant = "card",
}: {
  force?: boolean;
  variant?: "card" | "inline";
}) {
  const getFn = useServerFn(getMyAthleteProfile);
  const { data } = useQuery({
    queryKey: ["my-athlete-profile"],
    queryFn: () => getFn(),
  });
  const [dismissed, setDismissed] = useState(false);

  if (!data) return null;
  const filledCore =
    Boolean(data.sport_level) &&
    Boolean(data.mobility_frequency) &&
    Boolean(data.training_experience);
  const stale =
    !data.athlete_profile_updated_at ||
    Date.now() - new Date(data.athlete_profile_updated_at).getTime() > 1000 * 60 * 60 * 24 * 90;

  // Hide if everything filled, not forced, and not stale
  if (filledCore && !force && !stale) return null;
  if (dismissed) return null;

  const msg = force
    ? "Bevor wir weiter optimieren — beantworte bitte ein paar neue Fragen zu Sport, Kursen und Mobility."
    : !filledCore
      ? "Vervollständige dein Sport-Profil (Mannschaft / Kurse / Mobility), damit Pläne besser zu dir passen."
      : "Dein Sport-Profil ist älter als 3 Monate — kurz aktualisieren?";

  return (
    <div
      className={
        variant === "card"
          ? "rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/10 to-transparent p-4"
          : "rounded-xl border border-gold/30 bg-gold/5 p-3"
      }
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-gold/15 p-2 text-gold">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-gold">
            {force ? "Neue Fragen" : "Sport-Profil"}
          </div>
          <p className="mt-1 text-sm">{msg}</p>
          <div className="mt-2 flex items-center gap-2">
            <Link
              to="/profile"
              hash="athlete-profile"
              className="inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold/90"
            >
              Jetzt ausfüllen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            {!force && (
              <button
                onClick={() => setDismissed(true)}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Schließen"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
