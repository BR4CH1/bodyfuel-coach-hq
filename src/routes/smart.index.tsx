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
  Mail,
  Instagram,
  MessageCircle,
} from "lucide-react";
import { Logo } from "@/components/bodyfuel/Logo";

export const Route = createFileRoute("/smart/")({
  head: () => ({
    meta: [
      { title: "BodyFuel Smart — 7 Tage gratis testen" },
      {
        name: "description",
        content:
          "BodyFuel Smart: Training & Ernährung digital planen. 7 Tage gratis testen — ohne Zahlungsdaten. Danach optional für 14,99 €/Monat weiterführen.",
      },
      { property: "og:title", content: "BodyFuel Smart — 7 Tage gratis testen" },
      {
        property: "og:description",
        content:
          "Dein smarter Einstieg in Training & Ernährung. 7 Tage gratis, ohne Zahlungsdaten.",
      },
      { property: "og:url", content: "https://bodyfuel-coaching.com/smart" },
    ],
    links: [{ rel: "canonical", href: "https://bodyfuel-coaching.com/smart" }],
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
            to="/trial"
            className="rounded-lg bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            7 Tage gratis testen
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3.5 w-3.5" /> BodyFuel Smart
          </div>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-6xl">
            Dein smarter Einstieg in<br />
            <span className="text-gold">Training & Ernährung.</span>
          </h1>
          <p className="mt-4 text-lg font-medium text-foreground/90">
            Training & Ernährung digital planen.
          </p>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            BodyFuel Smart erstellt automatisch deinen Ernährungs- und Trainingsplan,
            packt deine Einkaufsliste und zeigt dir jeden Tag, wie du näher an dein Ziel kommst.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/trial"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 font-semibold text-primary-foreground shadow-gold hover:opacity-90"
            >
              BodyFuel Smart 7 Tage gratis testen
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-xs text-muted-foreground">
              Ohne Zahlungsdaten · endet automatisch
            </span>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Nach dem Test kannst du Smart für 14,99 €/Monat weiterführen — komplett freiwillig.
          </p>
        </div>
      </section>

      {/* Was ist Smart */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Was macht BodyFuel Smart für dich?
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
              text="Miss deine Kraft regelmäßig und sieh deinen echten Fortschritt."
            />
            <Feature
              icon={<Trophy className="h-5 w-5" />}
              title="Ranking & Level"
              text="Punkte, Streaks und Achievements halten dich am Ball."
            />
          </div>

          <div className="mt-10">
            <Link
              to="/trial"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
            >
              Smart kostenlos testen <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* So läuft der 7-Tage-Test */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            So läuft dein 7-Tage-Test
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Step n={1} title="Kostenlos starten">
              Klicke auf „7 Tage gratis testen", erstelle einen Account oder logge dich ein.
            </Step>
            <Step n={2} title="Sofort loslegen">
              Du bekommst 7 Tage vollen Zugriff auf BodyFuel Smart — ohne Zahlungsdaten.
            </Step>
            <Step n={3} title="Frei entscheiden">
              Nach 7 Tagen endet der Test automatisch. Wenn du magst, führst du Smart für 14,99 €/Monat weiter.
            </Step>
          </div>
        </div>
      </section>

      {/* Smart vs Coaching */}
      <section id="vergleich" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Smart vs. Coaching</h2>
          <p className="mt-3 text-muted-foreground">
            Beide Wege führen zum Ziel. Wähle, was zu dir passt.
          </p>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <PlanCard
              name="BodyFuel Smart"
              price="14,99 €"
              tagline="Training & Ernährung digital planen — auf Autopilot."
              items={[
                "Individueller Ernährungs- & Trainingsplan",
                "Automatische Anpassungen & Verlängerung",
                "Tracker, Tagespunkte & Community inklusive",
                "Selbstständig mit intelligenter Unterstützung",
              ]}
              cta={{ to: "/trial", label: "7 Tage gratis testen" }}
              highlight
            />
            <PlanCard
              name="BodyFuel Coaching"
              price="69 €"
              tagline="Persönliche 1:1 Betreuung durch deinen Coach."
              items={[
                "Individueller Ernährungs- & Trainingsplan",
                "Persönliche Anpassungen statt Automatiken",
                "Direkter Chat-Support bei Fragen",
                "Wöchentliche Check-Ins & Feedback",
              ]}
              cta={{ to: "/", hash: "pakete", label: "Coaching ansehen" }}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-bold">FAQ</h2>
          <div className="mt-6 space-y-4">
            <Faq q="Ist der 7-Tage-Test wirklich kostenlos?">
              Ja. Du gibst keine Zahlungsdaten an, und der Test endet nach 7 Tagen automatisch.
              Danach kannst du Smart freiwillig für 14,99 €/Monat weiterführen.
            </Faq>
            <Faq q="Brauche ich Vorkenntnisse?">
              Nein. Das Onboarding fragt alles ab, was Smart braucht — danach läuft alles automatisch.
            </Faq>
            <Faq q="Kann ich jederzeit kündigen?">
              Ja. Smart läuft nach dem Test Monat für Monat. Du kannst jederzeit beenden
              oder auf Coaching wechseln.
            </Faq>
            <Faq q="Was kostet Smart nach dem Test?">
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
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Bereit für deinen digitalen Trainings- und Ernährungsbegleiter?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Registrieren. Onboarding. Plan steht. So einfach ist es.
          </p>
          <Link
            to="/trial"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 font-semibold text-primary-foreground shadow-gold hover:opacity-90"
          >
            BodyFuel Smart 7 Tage gratis testen <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            Ohne Zahlungsdaten. Endet automatisch nach 7 Tagen.
          </p>
        </div>
      </section>

      {/* Kontakt */}
      <section className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
          <h2 className="font-display text-2xl font-bold">Kontakt</h2>
          <p className="mt-2 text-sm text-muted-foreground">BodyFuel Coaching</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm">
            <a
              href="mailto:info@bodyfuel-coaching.com"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 hover:border-gold/40"
            >
              <Mail className="h-4 w-4 text-gold" /> info@bodyfuel-coaching.com
            </a>
            <a
              href="https://instagram.com/bodyfuel_coaching"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 hover:border-gold/40"
            >
              <Instagram className="h-4 w-4 text-gold" /> @bodyfuel_coaching
            </a>
            <a
              href="https://wa.me/4915205696462"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 hover:border-gold/40"
            >
              <MessageCircle className="h-4 w-4 text-gold" /> WhatsApp
            </a>
          </div>
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

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-gold font-display text-sm font-bold text-primary-foreground">
        {n}
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
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
  cta: { to: "/" | "/trial"; hash?: string; label: string };
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
        hash={cta.hash}
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
