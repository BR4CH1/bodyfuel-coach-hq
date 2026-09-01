import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  Flame,
  Loader2,
  Medal,
  ShieldCheck,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import bodyfuelLogoAsset from "@/assets/bodyfuel-coaching-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GOAL_TYPE_OPTIONS,
  submitContinentalApplication,
} from "@/lib/continental-challenge.functions";

const PAGE_TITLE = "Continental × BodyFuel – 30 Tage Challenge | Jetzt bewerben";
const PAGE_DESCRIPTION =
  "Die exklusive Continental × BodyFuel Challenge für 25 ausgewählte Teilnehmer. 30 Tage mit BodyFuel Smart trainieren, tracken und im Ranking antreten. Jetzt für einen Platz bewerben.";

export const Route = createFileRoute("/continental-challenge")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: "Continental × BodyFuel – 30 Tage Challenge" },
      { property: "og:description", content: PAGE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bodyfuel-coaching.com/continental-challenge" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bodyfuel-coaching.com/continental-challenge" }],
  }),
  component: ContinentalChallengePage,
});

const steps = [
  {
    n: "01",
    icon: ClipboardCheck,
    title: "Für einen Platz bewerben",
    text: "Formular ausfüllen und abschicken. Deine Bewerbung wird persönlich geprüft — kein automatischer Zugang.",
  },
  {
    n: "02",
    icon: ShieldCheck,
    title: "Freigabe erhalten",
    text: "Wenn du einen der 25 Plätze bekommst, melden wir uns bei dir mit allen nächsten Schritten.",
  },
  {
    n: "03",
    icon: Flame,
    title: "30 Tage mit BodyFuel Smart starten",
    text: "Du trainierst und trackst 30 Tage mit BodyFuel Smart — mit klarem Tagesfokus statt Rätselraten.",
  },
  {
    n: "04",
    icon: Trophy,
    title: "Punkte sammeln & im Ranking antreten",
    text: "Jeder Tag zählt. Du sammelst Punkte und kämpfst dich im Challenge-Ranking an die Spitze.",
  },
];

const includedItems = [
  "BodyFuel Smart für die Challenge",
  "30-Tage-Challenge im Performance-System",
  "Persönliches Punkte- und Ranking-System",
  "Klarer Tagesfokus und sichtbarer Fortschritt",
  "Wettbewerb mit maximal 25 Teilnehmern",
];

function ContinentalChallengePage() {
  return (
    <div className="min-h-screen bg-[#050806] text-white">
      <ChallengeHeader />
      <main>
        <ChallengeHero />
        <HowItWorksSection />
        <PrizesSection />
        <IncludedSection />
        <ApplicationSection />
      </main>
      <ChallengeFooter />
    </div>
  );
}

function ChallengeHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050806]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0">
          <img
            src={bodyfuelLogoAsset.url}
            alt="BodyFuel Coaching"
            className="h-10 w-auto max-w-[170px] object-contain sm:h-11"
          />
        </Link>
        <a href="#bewerbung">
          <Button size="sm" className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
            Jetzt bewerben
          </Button>
        </a>
      </div>
    </header>
  );
}

function ChallengeHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/10">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_75%_25%,rgba(45,185,91,0.16),transparent_35%),radial-gradient(circle_at_12%_18%,rgba(45,185,91,0.07),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Exklusiv · 25 Plätze
          </div>

          <h1 className="mt-6 font-display text-[clamp(2.9rem,7vw,5.6rem)] font-bold leading-[0.92] tracking-[-0.03em]">
            30 Tage. Ein Ziel.
            <br />
            <span className="text-gradient-gold">Deine Challenge.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            Die exklusive Continental × BodyFuel Challenge für 25 ausgewählte Teilnehmer.
            Trainiere und tracke 30 Tage mit BodyFuel Smart, sammle Punkte und kämpfe dich
            an die Spitze des Rankings.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#bewerbung" className="sm:inline-flex">
              <Button size="lg" className="w-full bg-gradient-gold px-7 text-primary-foreground shadow-gold hover:opacity-90 sm:w-auto">
                Für einen Platz bewerben <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Button>
            </a>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> Nur 25 Plätze
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> Teilnahme nur nach Freigabe
            </span>
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Eine Kooperation von Continental und BodyFuel
          </p>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="py-20 sm:py-24" aria-labelledby="ablauf-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">So läuft es ab</div>
          <h2 id="ablauf-heading" className="mt-4 font-display text-4xl font-bold leading-[0.98] sm:text-5xl">
            Vier Schritte bis zur <span className="text-gradient-gold">Startlinie.</span>
          </h2>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <article key={step.n} className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d1210] p-6">
              <div className="absolute right-4 top-2 font-display text-6xl font-bold text-white/[0.06]" aria-hidden="true">
                {step.n}
              </div>
              <div className="relative grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="relative mt-6 font-display text-xl font-bold uppercase leading-tight">{step.title}</h3>
              <p className="relative mt-3 text-sm leading-6 text-white/50">{step.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrizesSection() {
  return (
    <section className="border-y border-white/10 bg-[#0a0f0c] py-20 sm:py-24" aria-labelledby="gewinne-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Gewinne</div>
          <h2 id="gewinne-heading" className="mt-4 font-display text-4xl font-bold leading-[0.98] sm:text-5xl">
            Es geht um <span className="text-gradient-gold">mehr als Punkte.</span>
          </h2>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_.9fr_.9fr]">
          <article className="relative overflow-hidden rounded-[2rem] border border-gold/45 bg-[linear-gradient(180deg,rgba(45,185,91,.10),rgba(13,18,16,.92))] p-7 shadow-gold sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-gold text-primary-foreground">
                <Trophy className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">1. Platz</span>
            </div>
            <h3 className="mt-6 font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">
              6 Monate 1:1 BodyFuel Coaching mit Manuel
            </h3>
            <p className="mt-4 text-sm leading-6 text-white/55">
              Persönliche Betreuung, individuelle Planung und direkte Check-ins — ein halbes Jahr lang.
            </p>
          </article>

          {[2, 3].map((place) => (
            <article key={place} className="rounded-[2rem] border border-white/10 bg-[#0d1210] p-7 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06] text-white/70">
                  <Medal className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">{place}. Platz</span>
              </div>
              <h3 className="mt-6 font-display text-2xl font-bold uppercase leading-tight text-white/85">
                Gewinn wird noch bekannt gegeben
              </h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function IncludedSection() {
  return (
    <section className="py-20 sm:py-24" aria-labelledby="leistungen-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Was Teilnehmer bekommen</div>
            <h2 id="leistungen-heading" className="mt-4 font-display text-4xl font-bold leading-[0.98] sm:text-5xl">
              Alles, was du für <span className="text-gradient-gold">30 starke Tage</span> brauchst.
            </h2>
            <p className="mt-5 max-w-xl leading-7 text-white/55">
              Die Challenge läuft komplett im BodyFuel-System: Training, Tracking, Punkte und Ranking
              an einem Ort — ohne Zettelwirtschaft und ohne Rätselraten.
            </p>
          </div>

          <ul className="space-y-3">
            {includedItems.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0d1210] p-4 text-sm font-medium">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold">
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Bewerbungsformular ---------------- */

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  age: string;
  goal_type: string;
  goal_text: string;
  motivation: string;
  privacy_consent: boolean;
};

const EMPTY_FORM: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  age: "",
  goal_type: "",
  goal_text: "",
  motivation: "",
  privacy_consent: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+0-9 ()\/.-]{4,40}$/;

function validateForm(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (form.first_name.trim().length < 2) errors.first_name = "Bitte gib deinen Vornamen an.";
  if (form.last_name.trim().length < 2) errors.last_name = "Bitte gib deinen Nachnamen an.";
  if (!EMAIL_RE.test(form.email.trim().toLowerCase())) {
    errors.email = "Bitte gib eine gültige E-Mail-Adresse an.";
  }
  if (!PHONE_RE.test(form.phone.trim())) {
    errors.phone = "Bitte gib eine gültige Mobilnummer an.";
  }
  if (form.age.trim()) {
    const parsed = Number(form.age);
    if (!Number.isFinite(parsed) || parsed < 14 || parsed > 99) {
      errors.age = "Bitte gib ein Alter zwischen 14 und 99 an.";
    }
  }
  if (form.goal_text.trim().length < 5) {
    errors.goal_text = "Bitte beschreibe kurz, was du erreichen möchtest.";
  }
  if (form.motivation.trim().length < 5) {
    errors.motivation = "Bitte beschreibe kurz, warum du dabei sein möchtest.";
  }
  if (!form.privacy_consent) {
    errors.privacy_consent = "Bitte bestätige die Einwilligung, damit wir deine Bewerbung bearbeiten dürfen.";
  }
  return errors;
}

const fieldClasses =
  "border-white/15 bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:border-gold/50 focus-visible:ring-gold/40";

function ApplicationSection() {
  const submitFn = useServerFn(submitContinentalApplication);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [banner, setBanner] = useState<{ kind: "duplicate" | "error"; message: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const mutation = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          age: form.age.trim() ? Number(form.age) : null,
          goal_type: form.goal_type || null,
          goal_text: form.goal_text.trim(),
          motivation: form.motivation.trim(),
          privacy_consent: form.privacy_consent,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        setSubmitted(true);
        setBanner(null);
        return;
      }
      if (res.code === "duplicate") {
        setBanner({ kind: "duplicate", message: res.message });
      } else {
        setBanner({ kind: "error", message: res.message });
      }
    },
    onError: () => {
      setBanner({
        kind: "error",
        message:
          "Deine Bewerbung konnte gerade nicht übertragen werden. Bitte prüfe deine Internetverbindung und versuche es erneut.",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setBanner(null);
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    mutation.mutate();
  };

  return (
    <section
      id="bewerbung"
      className="scroll-mt-20 border-t border-white/10 bg-[#0a0f0c] py-20 sm:py-24"
      aria-labelledby="bewerbung-heading"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Bewerbung</div>
          <h2 id="bewerbung-heading" className="mt-4 font-display text-4xl font-bold sm:text-5xl">
            Sichere dir die Chance auf <span className="text-gradient-gold">einen der 25 Plätze.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/55">
            Fülle das Formular aus. Wir prüfen jede Bewerbung persönlich — die Teilnahme ist erst
            nach Freigabe möglich.
          </p>
        </div>

        <div className="mt-10 rounded-[2rem] border border-white/10 bg-[#0d1210] p-6 shadow-2xl sm:p-8">
          {submitted ? (
            <SuccessView />
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {banner && (
                <div
                  role="alert"
                  className={`rounded-xl border p-4 text-sm leading-6 ${
                    banner.kind === "duplicate"
                      ? "border-gold/35 bg-gold/10 text-white/85"
                      : "border-red-500/35 bg-red-500/10 text-white/85"
                  }`}
                >
                  {banner.message}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Vorname *" htmlFor="cc-first-name" error={errors.first_name}>
                  <Input
                    id="cc-first-name"
                    autoComplete="given-name"
                    value={form.first_name}
                    onChange={(e) => set("first_name", e.target.value)}
                    maxLength={80}
                    required
                    aria-invalid={!!errors.first_name}
                    className={fieldClasses}
                  />
                </FormField>
                <FormField label="Nachname *" htmlFor="cc-last-name" error={errors.last_name}>
                  <Input
                    id="cc-last-name"
                    autoComplete="family-name"
                    value={form.last_name}
                    onChange={(e) => set("last_name", e.target.value)}
                    maxLength={80}
                    required
                    aria-invalid={!!errors.last_name}
                    className={fieldClasses}
                  />
                </FormField>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="E-Mail *" htmlFor="cc-email" error={errors.email}>
                  <Input
                    id="cc-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    maxLength={200}
                    required
                    aria-invalid={!!errors.email}
                    className={fieldClasses}
                  />
                </FormField>
                <FormField label="Mobilnummer *" htmlFor="cc-phone" error={errors.phone}>
                  <Input
                    id="cc-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    maxLength={40}
                    required
                    aria-invalid={!!errors.phone}
                    className={fieldClasses}
                  />
                </FormField>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Alter (optional)" htmlFor="cc-age" error={errors.age}>
                  <Input
                    id="cc-age"
                    type="number"
                    inputMode="numeric"
                    min={14}
                    max={99}
                    value={form.age}
                    onChange={(e) => set("age", e.target.value)}
                    aria-invalid={!!errors.age}
                    className={fieldClasses}
                  />
                </FormField>
                <FormField label="Aktuelles Hauptziel (optional)" htmlFor="cc-goal-type">
                  <select
                    id="cc-goal-type"
                    value={form.goal_type}
                    onChange={(e) => set("goal_type", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50"
                  >
                    <option value="" className="bg-[#0d1210]">
                      Bitte wählen
                    </option>
                    {GOAL_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="bg-[#0d1210]">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField
                label="Was möchtest du in den 30 Tagen erreichen? *"
                htmlFor="cc-goal-text"
                error={errors.goal_text}
              >
                <Textarea
                  id="cc-goal-text"
                  rows={4}
                  value={form.goal_text}
                  onChange={(e) => set("goal_text", e.target.value)}
                  maxLength={2000}
                  required
                  aria-invalid={!!errors.goal_text}
                  className={fieldClasses}
                />
              </FormField>

              <FormField
                label="Warum möchtest du bei der Challenge dabei sein? *"
                htmlFor="cc-motivation"
                error={errors.motivation}
              >
                <Textarea
                  id="cc-motivation"
                  rows={4}
                  value={form.motivation}
                  onChange={(e) => set("motivation", e.target.value)}
                  maxLength={2000}
                  required
                  aria-invalid={!!errors.motivation}
                  className={fieldClasses}
                />
              </FormField>

              <div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="cc-privacy"
                    checked={form.privacy_consent}
                    onCheckedChange={(checked) => set("privacy_consent", checked === true)}
                    aria-invalid={!!errors.privacy_consent}
                    className="mt-0.5 border-white/30 data-[state=checked]:bg-gold data-[state=checked]:text-primary-foreground"
                  />
                  <Label htmlFor="cc-privacy" className="text-xs font-normal leading-5 text-white/65">
                    Ich bin damit einverstanden, dass meine Angaben zur Durchführung und Auswahl für
                    die Continental × BodyFuel Challenge verarbeitet werden. *
                  </Label>
                </div>
                {errors.privacy_consent && (
                  <p role="alert" className="mt-2 text-xs text-red-400">
                    {errors.privacy_consent}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={mutation.isPending}
                className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Bewerbung wird
                    gesendet…
                  </>
                ) : (
                  <>
                    Bewerbung absenden <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </Button>

              <p className="text-center text-[11px] leading-5 text-white/40">
                Nur 25 Plätze · Teilnahme nur nach Freigabe · Mehr in unserer{" "}
                <Link to="/datenschutz" className="underline underline-offset-2 hover:text-white/70">
                  Datenschutzerklärung
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function SuccessView() {
  return (
    <div className="py-6 text-center sm:py-10">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold/15 text-gold">
        <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
      </span>
      <h3 className="mt-6 font-display text-3xl font-bold sm:text-4xl">Bewerbung ist raus.</h3>
      <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/60">
        Wir prüfen deine Bewerbung. Wenn du einen der 25 Plätze erhältst, bekommst du die nächsten
        Schritte.
      </p>
      <div className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/45">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> Max. 25 Teilnehmer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-gold" aria-hidden="true" /> 30 Tage Challenge
        </span>
      </div>
    </div>
  );
}

function ChallengeFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#050806] py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <Link to="/">
          <img
            src={bodyfuelLogoAsset.url}
            alt="BodyFuel Coaching"
            className="h-10 w-auto max-w-[170px] object-contain"
          />
        </Link>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/45">
          <Link to="/">Homepage</Link>
          <Link to="/impressum">Impressum</Link>
          <Link to="/datenschutz">Datenschutz</Link>
          <span>© {new Date().getFullYear()} BodyFuel Coaching</span>
        </div>
      </div>
    </footer>
  );
}

function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-white/70">
        {label}
      </Label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
