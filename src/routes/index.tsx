import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Activity,
  Apple,
  Award,
  Check,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Instagram,
  LineChart,
  Mail,
  Moon,
  Phone,
  Salad,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  User as UserIcon,
  Users,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/bodyfuel/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BODYFUEL Nutrition Coaching — Ernährung, Training & System" },
      {
        name: "description",
        content:
          "Online-Coaching für nachhaltigen Fettabbau, Muskelaufbau und Struktur im Alltag. Persönlicher Plan, Check-ins, Level-System. Kostenloses Erstgespräch.",
      },
      { property: "og:title", content: "BODYFUEL Nutrition Coaching" },
      {
        property: "og:description",
        content:
          "Ernährung, Training & Fortschritt — endlich mit System. Buche dein kostenloses Erstgespräch.",
      },
    ],
  }),
  component: LandingPage,
});

/* ------------------------------------------------------------------ */

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <ForWhom />
      <WhatIs />
      <SystemSteps />
      <Gamification />
      <Results />
      <AboutCoach />
      <CTASection />
      <ContactForm />
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#fuer-wen" className="transition hover:text-foreground">Für wen</a>
          <a href="#system" className="transition hover:text-foreground">System</a>
          <a href="#level" className="transition hover:text-foreground">Level</a>
          <a href="#coach" className="transition hover:text-foreground">Coach</a>
          <a href="#kontakt" className="transition hover:text-foreground">Kontakt</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
            Login
          </Link>
          <a href="#kontakt">
            <Button size="sm" className="bg-gradient-gold text-primary-foreground hover:opacity-90">
              Erstgespräch
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background flair */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-[420px] w-[420px] rounded-full bg-gold/15 blur-3xl" />
        <div className="absolute right-0 top-40 h-[420px] w-[420px] rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-24">
        <div className="animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-gold">
            <Sparkles className="h-3 w-3" />
            Persönliches Online-Coaching
          </div>

          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            Ernährung, Training &{" "}
            <span className="text-gradient-gold">Fortschritt</span>
            <br />— endlich mit System.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            BodyFuel hilft dir dabei, Fett zu verlieren, Muskeln aufzubauen und wieder
            Struktur in deinen Alltag zu bringen — ohne Crash-Diät, ohne 0815-Plan und
            ohne alleine gelassen zu werden.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="#kontakt">
              <Button
                size="lg"
                className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90 sm:w-auto"
              >
                Kostenloses Erstgespräch buchen
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </a>
            <a href="#system">
              <Button
                size="lg"
                variant="outline"
                className="w-full border-border bg-card/40 hover:bg-card sm:w-auto"
              >
                Mehr erfahren
              </Button>
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gold" /> 1:1 Betreuung
            </div>
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-gold" /> Nachhaltig statt Diät
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" /> Level-System
            </div>
          </div>
        </div>

        {/* Mockup */}
        <HeroMockup />
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="relative animate-fade-in">
      <div className="absolute -inset-4 rounded-3xl bg-gradient-gold opacity-20 blur-2xl" />
      <div className="relative rounded-3xl border border-border bg-card p-5 shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Heute
            </div>
            <div className="font-display text-lg font-bold">Andreas</div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs text-gold">
            <Flame className="h-3.5 w-3.5" /> 12 Tage Streak
          </div>
        </div>

        {/* Level */}
        <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Level 4
              </div>
              <div className="font-display text-xl font-bold text-gold">Athlete</div>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-gold shadow-gold">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-[68%] rounded-full bg-gradient-gold" />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>820 XP</span>
              <span>1200 XP → Elite</span>
            </div>
          </div>
        </div>

        {/* Points today */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { v: "13/15", l: "Punkte heute" },
            { v: "94%", l: "Wochenziel" },
            { v: "47", l: "Trainings" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-border bg-background/40 px-3 py-3 text-center">
              <div className="font-display text-base text-gold">{s.v}</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                {s.l}
              </div>
            </div>
          ))}
        </div>

        {/* Mini chart */}
        <div className="mt-3 rounded-2xl border border-border bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">Fortschritt 30 Tage</div>
            <div className="flex items-center gap-1 text-[10px] text-gold">
              <TrendingUp className="h-3 w-3" /> +18%
            </div>
          </div>
          <MiniChart />
        </div>
      </div>
    </div>
  );
}

function MiniChart() {
  const pts = [40, 52, 48, 60, 55, 70, 65, 78, 72, 84, 80, 92];
  const w = 280;
  const h = 80;
  const max = 100;
  const step = w / (pts.length - 1);
  const path = pts
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (v / max) * h}`)
    .join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-20 w-full">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.78 0.17 150)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="oklch(0.58 0.18 148)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#g)" />
      <path d={path} fill="none" stroke="oklch(0.78 0.17 150)" strokeWidth="2" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

function ForWhom() {
  const items = [
    { icon: Target, text: "Du willst abnehmen, weißt aber nicht, wo du anfangen sollst." },
    { icon: Dumbbell, text: "Du trainierst, aber siehst kaum Fortschritt." },
    { icon: ClipboardList, text: "Du brauchst klare Struktur bei Ernährung und Alltag." },
    { icon: TrendingUp, text: "Du willst Muskeln aufbauen, ohne unnötig Fett zuzulegen." },
    { icon: Users, text: "Du brauchst jemanden, der dich ehrlich begleitet." },
  ];
  return (
    <section id="fuer-wen" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionLabel>Für wen</SectionLabel>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold sm:text-4xl">
          Für wen ist <span className="text-gradient-gold">BodyFuel</span>?
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Egal ob Einstieg oder nächstes Level — wenn du dich in einem dieser Punkte
          wiedererkennst, ist BodyFuel für dich.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition hover:border-gold/40 hover:shadow-gold"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold shadow-gold">
                <it.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground/90">{it.text}</p>
              <ChevronRight className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gold/0 transition group-hover:text-gold" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function WhatIs() {
  const features = [
    { icon: Salad, title: "Individueller Ernährungsplan", text: "Auf dich, dein Leben und dein Ziel zugeschnitten — kein Copy-Paste-Plan." },
    { icon: Users, title: "Persönliche Check-ins", text: "Regelmäßiger Austausch mit deinem Coach. Du wirst nicht alleine gelassen." },
    { icon: Trophy, title: "Punkte- & Level-System", text: "Aus täglichen Habits werden Punkte. Aus Punkten werden Level — und Ergebnisse." },
    { icon: LineChart, title: "Fortschrittstracking", text: "Gewicht, Maße, Bilder, Streaks — alles an einem Ort, transparent dokumentiert." },
  ];
  return (
    <section className="relative border-y border-border/60 bg-card/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div>
            <SectionLabel>Was ist BodyFuel?</SectionLabel>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              Kein Plan. Ein <span className="text-gradient-gold">System.</span>
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              BodyFuel ist kein klassischer Ernährungsplan, den du einmal bekommst und
              dann alleine umsetzen musst. Du bekommst ein System aus Ernährung, Training,
              Check-ins, Punkten, Leveln und persönlichem Coaching.
            </p>
            <a href="#kontakt" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline">
              Jetzt unverbindlich starten <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((f, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-background/60 p-6 transition hover:border-gold/40"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-gold">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function SystemSteps() {
  const steps = [
    { n: "01", title: "Analyse & Zielsetzung", text: "Wir schauen uns deinen Alltag, dein Training, deine Ernährung und dein Ziel an.", icon: ClipboardList },
    { n: "02", title: "Dein persönlicher Plan", text: "Du bekommst einen Plan, der zu deinem Leben passt — nicht andersrum.", icon: Target },
    { n: "03", title: "Dranbleiben mit System", text: "Über Punkte, Level, Streaks und Check-ins bleibst du motiviert und siehst deinen Fortschritt.", icon: Flame },
  ];
  return (
    <section id="system" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionLabel>Das System</SectionLabel>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold sm:text-4xl">
          In <span className="text-gradient-gold">3 Schritten</span> zum Ergebnis.
        </h2>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={i} className="relative">
              <div className="relative h-full rounded-2xl border border-border bg-card p-7 transition hover:border-gold/40">
                <div className="absolute -top-4 left-6 rounded-lg bg-gradient-gold px-3 py-1 font-display text-sm font-bold text-primary-foreground shadow-gold">
                  {s.n}
                </div>
                <div className="mt-4 grid h-12 w-12 place-items-center rounded-xl bg-secondary text-gold">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-gold/40 md:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Gamification() {
  const levels = [
    { name: "Rookie", xp: "0", pct: 8 },
    { name: "Grinder", xp: "200", pct: 22 },
    { name: "Athlete", xp: "500", pct: 42 },
    { name: "Elite", xp: "800", pct: 62 },
    { name: "Beast", xp: "1000", pct: 82 },
    { name: "Legend", xp: "1200", pct: 100 },
  ];
  const tasks = [
    { icon: Apple, label: "Eiweißziel erreicht", pts: 3 },
    { icon: Activity, label: "Trinkziel erreicht", pts: 2 },
    { icon: Footprints, label: "Schritte geschafft", pts: 2 },
    { icon: Dumbbell, label: "Training absolviert", pts: 3 },
    { icon: Moon, label: "Schlafziel erreicht", pts: 2 },
    { icon: Heart, label: "Recovery gemacht", pts: 1 },
  ];

  return (
    <section id="level" className="relative overflow-hidden border-y border-border/60 bg-card/30 py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionLabel>Gamification</SectionLabel>
        <h2 className="mt-3 max-w-3xl font-display text-3xl font-bold sm:text-4xl">
          Mach Fortschritt <span className="text-gradient-gold">sichtbar.</span>
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Mit dem BodyFuel Level-System sammelst du Punkte für die Dinge, die wirklich
          zählen: Eiweiß, Wasser, Schritte, Training, Schlaf und Recovery.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {/* Levels */}
          <div className="rounded-3xl border border-border bg-background/60 p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold">
              <Trophy className="h-4 w-4 text-gold" /> Level-System
            </div>
            <div className="space-y-4">
              {levels.map((l, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-gold font-display text-xs font-bold text-primary-foreground">
                        {i + 1}
                      </div>
                      <span className="font-display text-sm font-bold tracking-wide">{l.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{l.xp} XP</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-gold"
                      style={{ width: `${l.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tasks */}
          <div className="rounded-3xl border border-border bg-background/60 p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-gold" /> Tagesaufgaben
            </div>
            <div className="space-y-3">
              {tasks.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-gold">
                    <t.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-sm font-medium">{t.label}</div>
                  <div className="flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold">
                    +{t.pts}
                  </div>
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-gold">
                    <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />
                  </div>
                </div>
              ))}
              <div className="mt-4 flex items-center justify-between rounded-xl border border-gold/30 bg-gold/5 p-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Heute gesammelt
                  </div>
                  <div className="font-display text-2xl font-bold text-gold">13 / 15 Punkte</div>
                </div>
                <Flame className="h-8 w-8 text-gold" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Results() {
  const testimonials = [
    { quote: "Ich hatte endlich einen Plan, den ich wirklich durchziehen konnte.", name: "Andreas", role: "−12 kg in 5 Monaten" },
    { quote: "Die Punkte haben mir geholfen, täglich dranzubleiben.", name: "Patrick", role: "Muskelaufbau + Struktur" },
    { quote: "Es fühlt sich nicht wie Diät an, sondern wie ein System.", name: "Luisa", role: "−8 cm Bauchumfang" },
  ];

  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionLabel>Ergebnisse</SectionLabel>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold sm:text-4xl">
          Echte <span className="text-gradient-gold">Transformationen.</span>
        </h2>

        {/* Before / After + stats */}
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {/* Before / After placeholder */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card lg:col-span-2">
            <div className="grid grid-cols-2">
              <PhotoPlaceholder label="Vorher" />
              <PhotoPlaceholder label="Nachher" highlight />
            </div>
            <div className="grid grid-cols-2 gap-px bg-border">
              <StatTile label="Gewicht" value="−11,8 kg" sub="von 96 kg → 84,2 kg" />
              <StatTile label="Bauchumfang" value="−9 cm" sub="von 104 cm → 95 cm" />
            </div>
          </div>

          {/* Progress chart card */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Gewichtsverlauf · 20 Wochen
            </div>
            <div className="mt-1 flex items-end gap-2">
              <div className="font-display text-3xl font-bold text-gold">84,2 kg</div>
              <div className="mb-1 text-xs text-gold">−11,8</div>
            </div>
            <WeightChart />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
              <div><div className="font-display text-base text-foreground">96</div>Start</div>
              <div><div className="font-display text-base text-foreground">90</div>Woche 10</div>
              <div><div className="font-display text-base text-gold">84,2</div>Jetzt</div>
            </div>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-6 transition hover:border-gold/40"
            >
              <div className="flex gap-0.5 text-gold">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 text-sm italic leading-relaxed text-foreground/90">
                „{t.quote}"
              </p>
              <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-gold font-display text-xs font-bold text-primary-foreground">
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PhotoPlaceholder({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <div className="relative aspect-[4/5] bg-gradient-to-br from-secondary to-background">
      <div className="absolute inset-0 grid place-items-center">
        <UserIcon className="h-20 w-20 text-border" strokeWidth={1.2} />
      </div>
      <div
        className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
          highlight
            ? "bg-gradient-gold text-primary-foreground shadow-gold"
            : "bg-background/80 text-muted-foreground"
        }`}
      >
        {label}
      </div>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-card p-5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-gold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function WeightChart() {
  const pts = [96, 95.2, 94.5, 93.8, 92.6, 91.9, 91, 90.4, 89.5, 88.7, 88, 87.4, 86.8, 86.2, 85.8, 85.3, 84.9, 84.6, 84.3, 84.2];
  const w = 280;
  const h = 90;
  const min = 83;
  const max = 96.5;
  const step = w / (pts.length - 1);
  const norm = (v: number) => h - ((v - min) / (max - min)) * h;
  const path = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${norm(v)}`).join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 h-24 w-full">
      <defs>
        <linearGradient id="wg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.78 0.17 150)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="oklch(0.58 0.18 148)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#wg)" />
      <path d={path} fill="none" stroke="oklch(0.78 0.17 150)" strokeWidth="2" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

function AboutCoach() {
  return (
    <section id="coach" className="relative border-y border-border/60 bg-card/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* Coach photo placeholder */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-gold opacity-20 blur-2xl" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-secondary to-background">
              <div className="absolute inset-0 grid place-items-center">
                <UserIcon className="h-24 w-24 text-border" strokeWidth={1.2} />
              </div>
              <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-gold/30 bg-background/70 p-3 backdrop-blur">
                <div className="font-display text-base font-bold">Manu</div>
                <div className="text-[11px] uppercase tracking-wider text-gold">Head Coach</div>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Über deinen Coach</SectionLabel>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              Dein Coach: <span className="text-gradient-gold">Manu</span>
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Ich begleite Menschen dabei, Ernährung, Training und Alltag endlich in den
              Griff zu bekommen. Mein Ziel ist nicht, dir irgendeinen perfekten Plan
              hinzulegen, sondern ein System zu bauen, das du wirklich umsetzen kannst.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { v: "100+", l: "Kunden" },
                { v: "5★", l: "Bewertungen" },
                { v: "1:1", l: "Betreuung" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl border border-border bg-background/60 px-4 py-3 text-center">
                  <div className="font-display text-xl text-gold">{s.v}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>

            <ul className="mt-6 space-y-2 text-sm">
              {[
                "Persönliches Coaching — kein Bot, kein Standardplan",
                "Fokus auf Nachhaltigkeit statt schnelle Crash-Ergebnisse",
                "Ehrliches Feedback, klare Struktur, echte Begleitung",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-gold">
                    <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                  </div>
                  <span className="text-foreground/90">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function CTASection() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-card p-8 text-center shadow-gold sm:p-14">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-gold/15 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
          </div>
          <div className="relative">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-gold">
              <Award className="h-3 w-3" /> Kostenlos & unverbindlich
            </div>
            <h2 className="mt-5 font-display text-3xl font-bold leading-tight sm:text-5xl">
              Bereit für deinen <span className="text-gradient-gold">nächsten Schritt?</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Im kostenlosen Erstgespräch schauen wir gemeinsam, wo du gerade stehst,
              was dein Ziel ist und ob BodyFuel zu dir passt.
            </p>
            <a href="#kontakt" className="mt-7 inline-block">
              <Button
                size="lg"
                className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
              >
                Kostenloses Erstgespräch buchen
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    goal: "",
    message: "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.goal) {
      toast.error("Bitte fülle Name, E-Mail und Ziel aus.");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Anfrage gesendet! Manu meldet sich innerhalb von 24 h.");
      setForm({ name: "", email: "", phone: "", goal: "", message: "" });
    }, 800);
  };

  return (
    <section id="kontakt" className="relative border-t border-border/60 bg-card/30 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <SectionLabel center>Kontakt</SectionLabel>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
            Sag <span className="text-gradient-gold">Hi.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Fülle das Formular aus — Manu meldet sich persönlich bei dir, um dein
            kostenloses Erstgespräch zu vereinbaren.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="mt-10 space-y-5 rounded-3xl border border-border bg-background/60 p-6 sm:p-10"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Max Mustermann"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="max@beispiel.de"
                required
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefonnummer (optional)</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+49 …"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal">Dein Ziel *</Label>
              <Select
                value={form.goal}
                onValueChange={(v) => setForm({ ...form, goal: v })}
              >
                <SelectTrigger id="goal">
                  <SelectValue placeholder="Wähle dein Ziel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abnehmen">Abnehmen</SelectItem>
                  <SelectItem value="muskelaufbau">Muskelaufbau</SelectItem>
                  <SelectItem value="koerperform">Körperform verbessern</SelectItem>
                  <SelectItem value="ernaehrung">Ernährung strukturieren</SelectItem>
                  <SelectItem value="sonstiges">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Nachricht</Label>
            <Textarea
              id="message"
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Erzähl kurz, wo du gerade stehst …"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            size="lg"
            className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
          >
            {submitting ? "Wird gesendet …" : "Anfrage senden"}
            {!submitting && <ArrowRight className="ml-1 h-4 w-4" />}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            100 % unverbindlich · keine Vertragsbindung · Antwort innerhalb von 24 h
          </p>
        </form>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              BODYFUEL Nutrition Coaching — Ernährung, Training & System für deinen
              nachhaltigen Fortschritt.
            </p>
          </div>
          <FooterCol title="Coaching">
            <a href="#fuer-wen" className="hover:text-foreground">Für wen</a>
            <a href="#system" className="hover:text-foreground">System</a>
            <a href="#level" className="hover:text-foreground">Level</a>
          </FooterCol>
          <FooterCol title="Rechtliches">
            <a href="#" className="hover:text-foreground">Impressum</a>
            <a href="#" className="hover:text-foreground">Datenschutz</a>
          </FooterCol>
          <FooterCol title="Kontakt">
            <a href="#kontakt" className="inline-flex items-center gap-2 hover:text-foreground">
              <Mail className="h-3.5 w-3.5" /> Anfrage senden
            </a>
            <a href="#" className="inline-flex items-center gap-2 hover:text-foreground">
              <Instagram className="h-3.5 w-3.5" /> Instagram
            </a>
            <a href="#" className="inline-flex items-center gap-2 hover:text-foreground">
              <Phone className="h-3.5 w-3.5" /> Telefon
            </a>
          </FooterCol>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <div>© {new Date().getFullYear()} BODYFUEL Nutrition Coaching. Alle Rechte vorbehalten.</div>
          <Link to="/login" className="hover:text-foreground">Kunden-Login →</Link>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-display text-sm font-bold tracking-wider">{title}</div>
      <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SectionLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-gold ${
        center ? "mx-auto" : ""
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gold" />
      {children}
    </div>
  );
}
