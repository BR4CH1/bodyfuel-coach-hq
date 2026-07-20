import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Apple, Droplet, Scale, Trophy, Activity, ArrowRight, Check } from "lucide-react";
import { Logo } from "@/components/bodyfuel/Logo";

export const Route = createFileRoute("/tracker/")({
  head: () => ({
    meta: [
      { title: "BodyFuel Tracker — Kostenlos täglich tracken" },
      {
        name: "description",
        content:
          "Tracke Kalorien, Eiweiß, Wasser, Gewicht und Schritte. Sammle Punkte, steige Level auf und verfolge deinen Fortschritt — kostenlos mit BodyFuel.",
      },
      { property: "og:title", content: "BodyFuel Tracker — Kostenlos" },
      {
        property: "og:description",
        content: "Dein kostenloser Fitness-Tracker. Kalorien, Wasser, Gewicht, Schritte, Punkte & Level.",
      },
    ],
  }),
  component: TrackerLanding,
});

const features = [
  { icon: Apple, title: "Ernährung", desc: "Kalorien, Eiweiß, Kohlenhydrate, Fett" },
  { icon: Droplet, title: "Wasser", desc: "Tagesziel, Streak und Erinnerungen" },
  { icon: Scale, title: "Gewicht", desc: "Verlauf mit Diagramm, Fortschritt sichtbar" },
  { icon: Activity, title: "Aktivität", desc: "Schritte und Trainings tracken" },
  { icon: Trophy, title: "Punkte & Level", desc: "XP sammeln, Level aufsteigen" },
  { icon: Flame, title: "Streaks", desc: "Tägliche Konsistenz belohnt" },
];

const benefits = [
  "Kostenlos – kein Abo",
  "Tägliche Übersicht und Wochenanalyse",
  "Punkte- & Level-System mit Achievements",
  "Funktioniert auf Handy & Desktop",
];

function TrackerLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/tracker"><Logo /></Link>
          <div className="flex items-center gap-2">
            <Link to="/tracker/login" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
              Login
            </Link>
            <Link
              to="/tracker/signup"
              className="rounded-full bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Kostenlos starten
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">BodyFuel Tracker</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-6xl">
            Kostenlos tracken.<br />
            <span className="text-gradient-gold">Wie ein Profi.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Kalorien, Eiweiß, Kohlenhydrate, Fett, Wasser, Gewicht und Aktivität – alles an einem Ort.
            Sammle Punkte, steigere dein Level und verfolge deinen Fortschritt jeden Tag.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/tracker/signup"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-6 py-3 font-bold text-primary-foreground shadow-gold"
            >
              Jetzt kostenlos starten <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/tracker/login"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 font-semibold hover:border-primary/50"
            >
              Ich habe bereits einen Account
            </Link>
          </div>
          <ul className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" /> {b}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Alles fürs tägliche Tracking</h2>
        <p className="mt-2 text-muted-foreground">Eine schlanke App, gemacht für maximale Konsistenz.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="mt-3 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Upsell to coaching */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="rounded-3xl border border-primary/40 bg-gradient-to-br from-card via-card to-primary/5 p-8 sm:p-12">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Du willst mehr?</p>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            BodyFuel Coaching – individuell, persönlich, mit Plan.
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Individueller Ernährungsplan, Trainingstag-/Restday-Steuerung, automatische Einkaufslisten,
            Trainingspläne, Kraftanalyse und direkter Coach-Support.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary px-5 py-2.5 font-semibold text-primary hover:bg-primary/10"
          >
            Coaching ansehen <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BodyFuel · <Link to="/impressum" className="hover:text-foreground">Impressum</Link> · <Link to="/datenschutz" className="hover:text-foreground">Datenschutz</Link>
      </footer>
    </div>
  );
}
