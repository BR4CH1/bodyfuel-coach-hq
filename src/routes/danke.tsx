import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, ArrowLeft, Mail, Instagram } from "lucide-react";
import { Logo } from "@/components/bodyfuel/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/danke")({
  head: () => ({
    meta: [
      { title: "Danke für deine Buchung — BODYFUEL" },
      {
        name: "description",
        content:
          "Vielen Dank für deine Buchung bei BODYFUEL Nutrition Coaching. Manu meldet sich schnellstmöglich bei dir.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ThankYouPage,
});

function ThankYouPage() {
  const [info, setInfo] = useState<{ name: string; package: string; price: number } | null>(
    null,
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("bodyfuel_last_booking");
      if (raw) setInfo(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <Logo />
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Zur Startseite
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-gold shadow-gold">
          <CheckCircle2 className="h-10 w-10 text-primary-foreground" />
        </div>

        <h1 className="mt-8 font-display text-3xl font-bold sm:text-5xl">
          Danke für deine <span className="text-gradient-gold">Buchung!</span>
        </h1>

        <p className="mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
          Ich melde mich schnellstmöglich bei dir, damit wir mit BodyFuel starten können.
        </p>

        {info && (
          <div className="mt-10 w-full rounded-3xl border border-border bg-card/50 p-6 text-left sm:p-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Deine Buchung
            </p>
            <div className="mt-3 flex items-baseline justify-between gap-4">
              <span className="font-display text-lg font-semibold">
                {info.package}
              </span>
              <span className="text-gradient-gold font-display text-2xl font-bold">
                {info.price} €
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Hi {info.name}, falls das PayPal-Fenster nicht geöffnet wurde, prüfe bitte
              deinen Popup-Blocker und klicke unten erneut.
            </p>
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-border/60 bg-background/60 p-5 text-sm text-muted-foreground">
          Alle Preise inkl. Kleinunternehmerregelung gemäß § 19 UStG. Es wird keine
          Umsatzsteuer ausgewiesen.
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/">
            <Button variant="outline" size="lg">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Zurück zur Startseite
            </Button>
          </Link>
          <a href="mailto:hi@bodyfuel-coaching.de">
            <Button
              size="lg"
              className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
            >
              <Mail className="mr-1 h-4 w-4" />
              Kontakt aufnehmen
            </Button>
          </a>
        </div>

        <a
          href="https://instagram.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Instagram className="h-4 w-4" />
          @bodyfuel auf Instagram
        </a>
      </main>
    </div>
  );
}
