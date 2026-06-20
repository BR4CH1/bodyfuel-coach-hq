import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  Utensils,
  Dumbbell,
  ShoppingCart,
  LineChart,
  Trophy,
  CheckCircle2,
  ArrowRight,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/bodyfuel/Logo";

export const Route = createFileRoute("/smart")({
  head: () => ({
    meta: [
      { title: "BodyFuel Smart — Dein persönlicher Autopilot für nur 14,99 €" },
      {
        name: "description",
        content:
          "BodyFuel Smart: Vollautomatischer Ernährungs- und Trainingsplan, smarte Einkaufsliste, Tracking & Fortschritt — für 14,99 € im Monat. Jetzt starten.",
      },
      { property: "og:title", content: "BodyFuel Smart — 14,99 €/Monat" },
      {
        property: "og:description",
        content:
          "Dein persönlicher Autopilot für Ernährung, Training und Fortschritt. Kein Coach nötig, voll automatisiert.",
      },
    ],
  }),
  component: SmartLandingPage,
});

function SmartLandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/">
            <Logo />
          </Link>
          <Link
            to="/auth"
            search={{ intent: "smart-signup" } as any}
            className="rounded-lg bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Jetzt starten
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3.5 w-3.5" /> BodyFuel Autopilot
          </div>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-6xl">
            Dein persönlicher Autopilot.<br />
            <span className="text-gold">Für nur 14,99 € im Monat.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            BodyFuel Smart erstellt vollautomatisch deinen Ernährungs- und Trainingsplan,
            packt deine Einkaufsliste und zeigt dir jeden Tag, wie du näher an dein Ziel kommst.
            Kein Coach nötig — alles läuft für dich.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              search={{ intent: "smart-signup" } as any}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
            >
              Jetzt für 14,99 € starten
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/#pakete"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Lieber 1:1-Coaching? →
            </Link>
          </div>
        </div>
      </section>

      {/* Was ist Autopilot */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Was macht der Autopilot für dich?
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Du gibst einmal dein Ziel, deine Lieblings-Lebensmittel und deinen Trainingsalltag ein —
            den Rest übernimmt BodyFuel.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={<Utensils className="h-5 w-5" />}
              title="Ernährungsplan"
              text="Automatisch passend zu deinem Ziel, Kalorien & Makros — mit Rezepten, die dir schmecken."
            />
            <Feature
              icon={<Dumbbell className="h-5 w-5" />}
              title="Trainingsplan"
              text="Auf dein Equipment, deine Erfahrung und deine Tage zugeschnitten."
            />
            <Feature
              icon={<ShoppingCart className="h-5 w-5" />}
              title="Einkaufsliste"
              text="Smart sortiert, auf deine Einkaufstage abgestimmt, in deinem Budget."
            />
            <Feature
              icon={<LineChart className="h-5 w-5" />}
              title="Tracking & Prognose"
              text="Sieh jeden Tag, wo du stehst und wann du dein Ziel erreichst."
            />
            <Feature
              icon={<Zap className="h-5 w-5" />}
              title="Strength Check"
              text="Miss deine Kraft viertel­jährlich und sieh deinen echten Fortschritt."
            />
            <Feature
              icon={<Trophy className="h-5 w-5" />}
              title="Ranking & Level"
              text="Punkte, Streaks und Achievements halten dich am Ball."
            />
          </div>
        </div>
      </section>

      {/* Smart vs Coaching */}
      <section id="vergleich" className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Smart vs. Coaching</h2>
          <p className="mt-3 text-muted-foreground">
            Beide Wege führen zum Ziel. Wähle, was zu dir passt.
          </p>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <PlanCard
              name="BodyFuel Smart"
              price="14,99 €"
              tagline="Voll automatisiert. Du startest sofort."
              items={[
                "Automatischer Ernährungsplan",
                "Automatischer Trainingsplan",
                "Smarte Einkaufsliste",
                "Tracking, Fortschritt & Prognose",
                "Strength Check",
                "Ranking, Level & Achievements",
              ]}
              cta={{ to: "/auth", label: "Smart starten" }}
              highlight
            />
            <PlanCard
              name="BodyFuel Coaching"
              price="69 €"
              tagline="1:1-Betreuung mit Manu als Coach."
              items={[
                "Alles aus BodyFuel Smart",
                "Persönliche Betreuung durch Manu",
                "Wöchentliche Check-ins",
                "Individuelle Anpassungen",
                "Plananpassungen jederzeit",
                "WhatsApp Support",
              ]}
              cta={{ to: "/#pakete", label: "Coaching ansehen" }}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-bold">FAQ</h2>
          <div className="mt-6 space-y-4">
            <Faq q="Brauche ich Vorkenntnisse?">
              Nein. Das Onboarding fragt alles ab, was Autopilot braucht — danach läuft alles automatisch.
            </Faq>
            <Faq q="Kann ich jederzeit kündigen?">
              Ja. Smart läuft Monat für Monat. Du kannst jederzeit beenden oder auf Coaching wechseln.
            </Faq>
            <Faq q="Was kostet Smart?">
              14,99 € pro Monat. Alle Funktionen sind inklusive.
            </Faq>
            <Faq q="Ist ein Coach beteiligt?">
              Nicht aktiv. Bei Smart läuft alles automatisch. Wenn du persönlichen Support möchtest,
              upgrade jederzeit auf BodyFuel Coaching.
            </Faq>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Bereit für Autopilot?</h2>
          <p className="mt-3 text-muted-foreground">
            Registrieren. Onboarding. Plan steht. So einfach ist es.
          </p>
          <Link
            to="/auth"
            search={{ intent: "smart-signup" } as any}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
          >
            Jetzt für 14,99 € starten <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BodyFuel Coaching ·{" "}
        <Link to="/impressum" className="hover:text-foreground">Impressum</Link> ·{" "}
        <Link to="/datenschutz" className="hover:text-foreground">Datenschutz</Link>
      </footer>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold">{icon}</div>
      <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function PlanCard({
  name,
  price,
  tagline,
  items,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  tagline: string;
  items: string[];
  cta: { to: string; label: string };
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        highlight ? "border-gold/60 bg-gradient-to-br from-card to-gold/5" : "border-border bg-card"
      }`}
    >
      <div className="text-xs uppercase tracking-[0.2em] text-gold">{name}</div>
      <div className="mt-2 font-display text-4xl font-bold">
        {price} <span className="text-base font-normal text-muted-foreground">/ Monat</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{tagline}</p>
      <ul className="mt-5 space-y-2">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
      <Link
        to={cta.to}
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
          highlight
            ? "bg-gradient-gold text-primary-foreground hover:opacity-90"
            : "border border-border hover:bg-secondary"
        }`}
      >
        {cta.label} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer list-none font-semibold">
        <span className="mr-2 text-gold group-open:rotate-90 inline-block transition-transform">›</span>
        {q}
      </summary>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </details>
  );
}
