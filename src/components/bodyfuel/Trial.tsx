import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flame, Check, Sparkles, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTrial } from "@/hooks/use-trial";

const KEY = "bodyfuel.trial.welcome";

/** Wird einmal nach Trial-Signup angezeigt. */
export function TrialWelcomeDialog() {
  const { isTrial, daysLeft } = useTrial();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isTrial) return;
    if (sessionStorage.getItem(KEY) === "1") {
      setOpen(true);
      sessionStorage.removeItem(KEY);
    }
  }, [isTrial]);

  const features = [
    "Starter Ernährungsplan",
    "Starter Trainingsplan",
    "Gewicht- & Wassertracking",
    "Schlaf- & Schrittetracking",
    "Dashboard & Ranking",
    "Fortschritts-Graphen",
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-gold/40 bg-gradient-to-b from-card via-card to-gold/5 sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3 w-3" /> Trial aktiviert
          </div>
          <DialogTitle className="text-center font-display text-2xl">
            🔥 Willkommen bei BODYFUEL
          </DialogTitle>
          <DialogDescription className="text-center">
            Dein kostenloser 7-Tage-Testzugang wurde erfolgreich aktiviert.
          </DialogDescription>
        </DialogHeader>

        <ul className="my-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 rounded-lg border border-border bg-background/40 p-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-center">
          <div className="font-display text-3xl font-bold text-gold">
            Noch {daysLeft ?? 7} Tage
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            kostenlos testen
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            asChild
            className="h-11 w-full bg-gradient-gold font-bold text-primary-foreground"
            onClick={() => setOpen(false)}
          >
            <Link to="/dashboard">🚀 Jetzt starten</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            <Link to="/nutrition">📖 Starterplan ansehen</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Banner oben auf dem Dashboard – Countdown oder Ablauf-Hinweis. */
export function TrialStatusBanner() {
  const { isTrial, isExpired, daysLeft } = useTrial();

  if (isExpired) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-destructive">
              Test abgelaufen
            </p>
            <p className="mt-1 font-display text-lg font-bold">
              Dein kostenloser Testzeitraum ist abgelaufen.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Aktiviere deine Mitgliedschaft, um mit deinem individuellen Plan weiterzumachen.
            </p>
            <Button
              asChild
              className="mt-3 bg-gradient-gold text-primary-foreground"
            >
              <Link to="/profile">Mitgliedschaft aktivieren</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isTrial) return null;

  return (
    <div className="rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/15 via-gold/5 to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/20">
            <Flame className="h-6 w-6 text-gold" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
              Kostenloser Test
            </p>
            <p className="font-display text-xl font-bold">
              Noch {daysLeft ?? 7} {daysLeft === 1 ? "Tag" : "Tage"} kostenlos testen
            </p>
            <p className="text-xs text-muted-foreground">
              Individuelle Pläne & Coaching werden nach Aktivierung freigeschaltet.
            </p>
          </div>
        </div>
        <Button asChild className="bg-gradient-gold text-primary-foreground">
          <Link to="/profile">Mitgliedschaft aktivieren</Link>
        </Button>
      </div>
    </div>
  );
}

/** Kleine Sperr-Karte für Premium-Features im Trial. */
export function TrialLockCard({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gold/40 bg-card/60 p-6 text-center">
      <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gold/15">
        <Lock className="h-5 w-5 text-gold" />
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {description ??
          "Diese Funktion wird nach Aktivierung deiner Mitgliedschaft freigeschaltet."}
      </p>
      <Button
        asChild
        className="mt-4 bg-gradient-gold text-primary-foreground"
      >
        <Link to="/profile">Mitgliedschaft aktivieren</Link>
      </Button>
    </div>
  );
}
