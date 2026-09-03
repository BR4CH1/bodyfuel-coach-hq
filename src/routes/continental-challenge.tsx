import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
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
import fuelyAsset from "@/assets/fuely-motivated.png.asset.json";
import dashboardAsset from "@/assets/app-dashboard.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ACTIVITY_LEVEL_OPTIONS,
  BLOCKER_OPTIONS,
  GOAL_TYPE_OPTIONS,
  INSURANCE_PRIORITY_OPTIONS,
  INSURANCE_REVIEW_OPTIONS,
  INSURANCE_TOPIC_OPTIONS,
  submitContinentalApplication,
} from "@/lib/continental-challenge.functions";

const PARTNER_LOGO = "/continentale-woltering-sonntag-holt.jpg";
const PARTNER_NAME = "Woltering-Sonntag & Holt Versicherungsvermittlungs GmbH";
const CANONICAL = "https://bodyfuel-coaching.com/continental-challenge";

const PAGE_TITLE = "Continentale × BodyFuel – 30 Tage Challenge | Jetzt bewerben";
const PAGE_DESCRIPTION =
  "Die exklusive Continentale × BodyFuel Challenge für 25 ausgewählte Teilnehmer. 30 Tage mit BodyFuel Smart trainieren, tracken und im Ranking antreten. Jetzt für einen Platz bewerben.";

export const Route = createFileRoute("/continental-challenge")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: "Continentale × BodyFuel – 30 Tage Challenge" },
      { property: "og:description", content: PAGE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
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

function PartnerLogoCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`grid place-items-center rounded-2xl border border-white/15 bg-white p-3 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.8)] sm:p-4 ${className}`}
    >
      <img
        src={PARTNER_LOGO}
        alt={`Continentale – ${PARTNER_NAME}`}
        className="h-full w-full object-contain"
        loading="lazy"
      />
    </div>
  );
}

function ChallengeHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050806]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between gap-3 px-4 sm:h-[92px] sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link to="/" className="shrink-0">
            <img
              src={bodyfuelLogoAsset.url}
              alt="BodyFuel Coaching"
              className="h-11 w-auto max-w-[150px] object-contain sm:h-16 sm:max-w-[230px]"
            />
          </Link>
          <span aria-hidden="true" className="hidden text-2xl font-light text-white/25 sm:block">
            ×
          </span>
          <PartnerLogoCard className="hidden h-16 w-[220px] sm:grid" />
        </div>
        <a href="#bewerbung" className="shrink-0">
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
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_75%_25%,rgba(45,185,91,0.18),transparent_38%),radial-gradient(circle_at_12%_18%,rgba(45,185,91,0.08),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.15fr_.85fr] lg:gap-16 lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Exklusiv · 25 Plätze
          </div>

          <h1 className="mt-6 font-display text-[clamp(2.7rem,7.5vw,5.4rem)] font-bold leading-[0.92] tracking-[-0.03em]">
            30 Tage. Ein Ziel.
            <br />
            <span className="text-gradient-gold">Deine Challenge.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            Die exklusive Continentale × BodyFuel Challenge für 25 ausgewählte Teilnehmer.
            Trainiere und tracke 30 Tage mit BodyFuel Smart, sammle Punkte und kämpfe dich
            an die Spitze des Rankings.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#bewerbung" className="sm:inline-flex">
              <Button
                size="lg"
                className="w-full bg-gradient-gold px-7 text-primary-foreground shadow-gold hover:opacity-90 sm:w-auto"
              >
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

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
              Eine Kooperation von
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4 sm:gap-6">
              <img
                src={bodyfuelLogoAsset.url}
                alt="BodyFuel Coaching"
                className="h-12 w-auto max-w-[170px] object-contain sm:h-14"
              />
              <span aria-hidden="true" className="text-xl font-light text-white/25">
                ×
              </span>
              <PartnerLogoCard className="h-16 w-[210px] sm:h-20 sm:w-[260px]" />
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_50%_35%,rgba(45,185,91,.22),transparent_65%)] blur-2xl" />
          <div className="relative mx-auto max-w-[340px] overflow-hidden rounded-[2.2rem] border border-white/12 bg-[#0d1210] p-3 shadow-[0_40px_120px_-40px_rgba(0,0,0,1)]">
            <img
              src={dashboardAsset.url}
              alt="BodyFuel Smart App – Tagesfokus, Tracking und Ranking"
              className="w-full rounded-[1.6rem] object-cover"
              loading="lazy"
            />
          </div>
          <img
            src={fuelyAsset.url}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-6 -left-2 h-24 w-auto drop-shadow-[0_12px_30px_rgba(0,0,0,.7)] sm:h-32 lg:-left-8"
            loading="lazy"
          />
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
            <article
              key={step.n}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d1210] p-6 transition-colors hover:border-gold/30"
            >
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
              <li
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0d1210] p-4 text-sm font-medium"
              >
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
  birth_year: string;
  phone: string;
  email: string;
  city: string;
  goal_type: string;
  goal_other: string;
  activity_level: string;
  motivation: string;
  blockers: string[];
  blocker_other: string;
  insurance_last_review: string;
  insurance_topics: string[];
  insurance_priorities: string[];
  insurance_notes: string;
};

const EMPTY_FORM: FormState = {
  first_name: "",
  last_name: "",
  birth_year: "",
  phone: "",
  email: "",
  city: "",
  goal_type: "",
  goal_other: "",
  activity_level: "",
  motivation: "",
  blockers: [],
  blocker_other: "",
  insurance_last_review: "",
  insurance_topics: [],
  insurance_priorities: [],
  insurance_notes: "",
};

const DRAFT_KEY = "bf-continental-application-draft";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+0-9 ()\/.-]{4,40}$/;

type FieldErrors = Partial<Record<keyof FormState | "privacy_consent", string>>;

function validateStep1(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const year = new Date().getFullYear();
  if (form.first_name.trim().length < 2) errors.first_name = "Bitte gib deinen Vornamen an.";
  if (form.last_name.trim().length < 2) errors.last_name = "Bitte gib deinen Nachnamen an.";
  const by = Number(form.birth_year);
  if (!/^\d{4}$/.test(form.birth_year.trim()) || !Number.isFinite(by) || by > year - 14 || by < year - 99) {
    errors.birth_year = `Bitte gib ein plausibles Geburtsjahr an (Mindestalter 14 Jahre).`;
  }
  if (!PHONE_RE.test(form.phone.trim())) errors.phone = "Bitte gib eine gültige Telefonnummer an.";
  if (!EMAIL_RE.test(form.email.trim().toLowerCase())) errors.email = "Bitte gib eine gültige E-Mail-Adresse an.";
  if (form.city.trim().length < 2) errors.city = "Bitte gib deinen Wohnort an.";
  return errors;
}

function validateStep2(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.goal_type) errors.goal_type = "Bitte wähle dein Hauptziel aus.";
  if (form.goal_type === "sonstiges" && form.goal_other.trim().length < 3) {
    errors.goal_other = "Bitte beschreibe kurz dein Ziel.";
  }
  if (!form.activity_level) errors.activity_level = "Bitte wähle aus, wie oft du aktuell aktiv bist.";
  if (form.motivation.trim().length < 5) {
    errors.motivation = "Bitte beschreibe kurz, warum du teilnehmen möchtest.";
  }
  if (form.blockers.length === 0) errors.blockers = "Bitte wähle mindestens ein Hindernis aus.";
  if (form.blockers.includes("sonstiges") && form.blocker_other.trim().length < 3) {
    errors.blocker_other = "Bitte beschreibe kurz dein sonstiges Hindernis.";
  }
  return errors;
}

const fieldClasses =
  "border-white/15 bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:border-gold/50 focus-visible:ring-gold/40";

const STEP_LABELS = ["Persönliche Angaben", "Deine 30-Tage-Challenge", "Financial Fitness Check"];

function ApplicationSection() {
  const submitFn = useServerFn(submitContinentalApplication);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [financialConsent, setFinancialConsent] = useState(false);
  const [banner, setBanner] = useState<{ kind: "duplicate" | "error"; message: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const topRef = useRef<HTMLDivElement | null>(null);

  // Entwurf laden (nie Einwilligungen)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) setForm({ ...EMPTY_FORM, ...(JSON.parse(raw) as Partial<FormState>) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [form]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const toggleMulti = (key: "blockers" | "insurance_topics" | "insurance_priorities", value: string) => {
    setForm((prev) => {
      const current = prev[key];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const mutation = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          birth_year: Number(form.birth_year),
          city: form.city.trim(),
          goal_type: form.goal_type,
          goal_other: form.goal_other.trim() || null,
          activity_level: form.activity_level,
          motivation: form.motivation.trim(),
          blockers: form.blockers,
          blocker_other: form.blocker_other.trim() || null,
          insurance_last_review: form.insurance_last_review || null,
          insurance_topics: form.insurance_topics,
          insurance_priorities: form.insurance_priorities,
          insurance_notes: form.insurance_notes.trim() || null,
          privacy_consent: privacyConsent,
          financial_contact_consent: financialConsent,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        setSubmitted(true);
        setBanner(null);
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        scrollTop();
        return;
      }
      setBanner({ kind: res.code === "duplicate" ? "duplicate" : "error", message: res.message });
      scrollTop();
    },
    onError: () => {
      setBanner({
        kind: "error",
        message:
          "Deine Bewerbung konnte gerade nicht übertragen werden. Bitte prüfe deine Internetverbindung und versuche es erneut.",
      });
      scrollTop();
    },
  });

  const goNext = () => {
    const stepErrors = step === 0 ? validateStep1(form) : validateStep2(form);
    setErrors(stepErrors);
    if (Object.values(stepErrors).some(Boolean)) return;
    setStep((s) => Math.min(2, s + 1));
    scrollTop();
  };

  const goBack = () => {
    setStep((s) => Math.max(0, s - 1));
    scrollTop();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setBanner(null);
    const allErrors = { ...validateStep1(form), ...validateStep2(form) };
    if (!privacyConsent) {
      allErrors.privacy_consent =
        "Bitte bestätige die Einwilligung, damit wir deine Bewerbung bearbeiten dürfen.";
    }
    setErrors(allErrors);
    if (Object.values(allErrors).some(Boolean)) {
      const firstStepInvalid = Object.keys(validateStep1(form)).length > 0;
      const secondStepInvalid = Object.keys(validateStep2(form)).length > 0;
      if (firstStepInvalid) setStep(0);
      else if (secondStepInvalid) setStep(1);
      scrollTop();
      return;
    }
    mutation.mutate();
  };

  return (
    <section
      id="bewerbung"
      className="scroll-mt-20 border-t border-white/10 bg-[#0a0f0c] py-20 sm:py-24"
      aria-labelledby="bewerbung-heading"
    >
      <div ref={topRef} className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Bewerbung</div>
          <h2 id="bewerbung-heading" className="mt-4 font-display text-4xl font-bold sm:text-5xl">
            Sichere dir die Chance auf <span className="text-gradient-gold">einen der 25 Plätze.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/55">
            Fülle das Formular in drei kurzen Schritten aus. Wir prüfen jede Bewerbung persönlich —
            die Teilnahme ist erst nach Freigabe möglich.
          </p>
        </div>

        <div className="mt-10 rounded-[2rem] border border-white/10 bg-[#0d1210] p-5 shadow-2xl sm:p-8">
          {submitted ? (
            <SuccessView />
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <StepIndicator current={step} />

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

              {step === 0 && (
                <div className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="Vorname *" htmlFor="cc-first-name" error={errors.first_name}>
                      <Input
                        id="cc-first-name"
                        autoComplete="given-name"
                        value={form.first_name}
                        onChange={(e) => set("first_name", e.target.value)}
                        maxLength={80}
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
                        aria-invalid={!!errors.last_name}
                        className={fieldClasses}
                      />
                    </FormField>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="Geburtsjahr *" htmlFor="cc-birth-year" error={errors.birth_year}>
                      <Input
                        id="cc-birth-year"
                        inputMode="numeric"
                        placeholder="z. B. 1992"
                        value={form.birth_year}
                        onChange={(e) => set("birth_year", e.target.value.replace(/\D/g, "").slice(0, 4))}
                        aria-invalid={!!errors.birth_year}
                        className={fieldClasses}
                      />
                    </FormField>
                    <FormField label="Telefonnummer *" htmlFor="cc-phone" error={errors.phone}>
                      <Input
                        id="cc-phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        maxLength={40}
                        aria-invalid={!!errors.phone}
                        className={fieldClasses}
                      />
                    </FormField>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="E-Mail-Adresse *" htmlFor="cc-email" error={errors.email}>
                      <Input
                        id="cc-email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)}
                        maxLength={200}
                        aria-invalid={!!errors.email}
                        className={fieldClasses}
                      />
                    </FormField>
                    <FormField label="Wohnort *" htmlFor="cc-city" error={errors.city}>
                      <Input
                        id="cc-city"
                        autoComplete="address-level2"
                        value={form.city}
                        onChange={(e) => set("city", e.target.value)}
                        maxLength={120}
                        aria-invalid={!!errors.city}
                        className={fieldClasses}
                      />
                    </FormField>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-7">
                  <ChoiceGroup
                    legend="Was ist dein Hauptziel für die 30 Tage? *"
                    name="cc-goal"
                    options={GOAL_TYPE_OPTIONS}
                    value={form.goal_type}
                    onChange={(v) => set("goal_type", v)}
                    error={errors.goal_type}
                  />
                  {form.goal_type === "sonstiges" && (
                    <FormField label="Dein Ziel *" htmlFor="cc-goal-other" error={errors.goal_other}>
                      <Input
                        id="cc-goal-other"
                        value={form.goal_other}
                        onChange={(e) => set("goal_other", e.target.value)}
                        maxLength={500}
                        className={fieldClasses}
                      />
                    </FormField>
                  )}

                  <ChoiceGroup
                    legend="Wie oft bist du aktuell sportlich aktiv? *"
                    name="cc-activity"
                    options={ACTIVITY_LEVEL_OPTIONS}
                    value={form.activity_level}
                    onChange={(v) => set("activity_level", v)}
                    error={errors.activity_level}
                  />

                  <FormField
                    label="Warum möchtest du teilnehmen? *"
                    htmlFor="cc-motivation"
                    error={errors.motivation}
                  >
                    <Textarea
                      id="cc-motivation"
                      rows={4}
                      value={form.motivation}
                      onChange={(e) => set("motivation", e.target.value)}
                      maxLength={2000}
                      aria-invalid={!!errors.motivation}
                      className={fieldClasses}
                    />
                  </FormField>

                  <MultiGroup
                    legend="Was hat dich bisher am meisten gebremst? (Mehrfachauswahl) *"
                    options={BLOCKER_OPTIONS}
                    values={form.blockers}
                    onToggle={(v) => toggleMulti("blockers", v)}
                    error={errors.blockers}
                  />
                  {form.blockers.includes("sonstiges") && (
                    <FormField label="Dein Hindernis *" htmlFor="cc-blocker-other" error={errors.blocker_other}>
                      <Input
                        id="cc-blocker-other"
                        value={form.blocker_other}
                        onChange={(e) => set("blocker_other", e.target.value)}
                        maxLength={500}
                        className={fieldClasses}
                      />
                    </FormField>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-7">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-4">
                      <PartnerLogoCard className="h-14 w-[180px]" />
                      <p className="min-w-[220px] flex-1 text-xs leading-5 text-white/55">
                        Der Financial Fitness Check ist ein freiwilliges Angebot unseres Kooperationspartners
                        {" "}
                        {PARTNER_NAME}. Alle Fragen in diesem Schritt sind optional und haben keinen Einfluss auf
                        deine Bewerbung.
                      </p>
                    </div>
                  </div>

                  <ChoiceGroup
                    legend="Wann hast du deine Versicherungen zuletzt überprüfen lassen?"
                    name="cc-insurance-review"
                    options={INSURANCE_REVIEW_OPTIONS}
                    value={form.insurance_last_review}
                    onChange={(v) => set("insurance_last_review", v)}
                  />

                  <MultiGroup
                    legend="Welche Themen sind für dich interessant? (Mehrfachauswahl)"
                    options={INSURANCE_TOPIC_OPTIONS}
                    values={form.insurance_topics}
                    onToggle={(v) => toggleMulti("insurance_topics", v)}
                  />

                  <MultiGroup
                    legend="Was wäre dir dabei am wichtigsten? (Mehrfachauswahl)"
                    options={INSURANCE_PRIORITY_OPTIONS}
                    values={form.insurance_priorities}
                    onToggle={(v) => toggleMulti("insurance_priorities", v)}
                  />

                  <FormField
                    label="Gibt es ein Thema, das du unbedingt besprechen möchtest? (optional)"
                    htmlFor="cc-insurance-notes"
                  >
                    <Textarea
                      id="cc-insurance-notes"
                      rows={3}
                      value={form.insurance_notes}
                      onChange={(e) => set("insurance_notes", e.target.value)}
                      maxLength={2000}
                      className={fieldClasses}
                    />
                  </FormField>

                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                    <div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="cc-privacy"
                          checked={privacyConsent}
                          onCheckedChange={(checked) => {
                            setPrivacyConsent(checked === true);
                            setErrors((prev) => ({ ...prev, privacy_consent: undefined }));
                          }}
                          aria-invalid={!!errors.privacy_consent}
                          className="mt-0.5 border-white/30 data-[state=checked]:bg-gold data-[state=checked]:text-primary-foreground"
                        />
                        <Label htmlFor="cc-privacy" className="text-xs font-normal leading-5 text-white/70">
                          Ich bin damit einverstanden, dass BodyFuel Coaching meine Angaben zur Prüfung meiner
                          Bewerbung und zur Durchführung der Continentale × BodyFuel Challenge verarbeitet. Weitere
                          Informationen in der{" "}
                          <Link to="/datenschutz" className="text-gold underline underline-offset-2">
                            Datenschutzerklärung
                          </Link>
                          . *
                        </Label>
                      </div>
                      {errors.privacy_consent && (
                        <p role="alert" className="mt-2 text-xs text-red-400">
                          {errors.privacy_consent}
                        </p>
                      )}
                    </div>

                    <div className="flex items-start gap-3 border-t border-white/10 pt-4">
                      <Checkbox
                        id="cc-financial"
                        checked={financialConsent}
                        onCheckedChange={(checked) => setFinancialConsent(checked === true)}
                        className="mt-0.5 border-white/30 data-[state=checked]:bg-gold data-[state=checked]:text-primary-foreground"
                      />
                      <Label htmlFor="cc-financial" className="text-xs font-normal leading-5 text-white/70">
                        Freiwillig: Ich bin damit einverstanden, dass meine Kontaktdaten und meine Antworten aus dem
                        Financial Fitness Check an die {PARTNER_NAME} weitergegeben werden und diese mich für einen
                        unverbindlichen Beratungstermin kontaktieren darf. Diese Einwilligung ist{" "}
                        <strong className="font-semibold text-white/85">keine Voraussetzung</strong> für die Bewerbung
                        und kann jederzeit widerrufen werden. Ohne dieses Häkchen erfolgt weder eine Weitergabe noch
                        eine Kontaktaufnahme.
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Zurück
                  </Button>
                ) : (
                  <span className="hidden sm:block" />
                )}

                {step < 2 ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={goNext}
                    className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
                  >
                    Weiter <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="lg"
                    disabled={mutation.isPending}
                    className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Bewerbung wird gesendet…
                      </>
                    ) : (
                      <>
                        Bewerbung absenden <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </Button>
                )}
              </div>

              <p className="text-center text-[11px] leading-5 text-white/40">
                Nur 25 Plätze · Teilnahme nur nach Freigabe ·{" "}
                <Link to="/datenschutz" className="underline underline-offset-2 hover:text-white/70">
                  Datenschutz
                </Link>{" "}
                ·{" "}
                <Link to="/impressum" className="underline underline-offset-2 hover:text-white/70">
                  Impressum
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, index) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                index <= current ? "bg-gradient-gold text-primary-foreground" : "bg-white/10 text-white/45"
              }`}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span
              className={`h-1 flex-1 rounded-full ${index < current ? "bg-gold/70" : "bg-white/10"} ${
                index === STEP_LABELS.length - 1 ? "hidden" : ""
              }`}
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
        Schritt {current + 1} von {STEP_LABELS.length} · {STEP_LABELS[current]}
      </p>
    </div>
  );
}

function ChoiceGroup({
  legend,
  name,
  options,
  value,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-white/85">{legend}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${
                active ? "border-gold/60 bg-gold/10 text-white" : "border-white/12 bg-white/[0.03] text-white/70 hover:border-white/25"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={active}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                  active ? "border-gold bg-gold" : "border-white/30"
                }`}
                aria-hidden="true"
              >
                {active && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
              </span>
              {option.label}
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function MultiGroup({
  legend,
  options,
  values,
  onToggle,
  error,
}: {
  legend: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  values: string[];
  onToggle: (value: string) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-white/85">{legend}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = values.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${
                active ? "border-gold/60 bg-gold/10 text-white" : "border-white/12 bg-white/[0.03] text-white/70 hover:border-white/25"
              }`}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => onToggle(option.value)}
                className="sr-only"
              />
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                  active ? "border-gold bg-gold text-primary-foreground" : "border-white/30"
                }`}
                aria-hidden="true"
              >
                {active && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              {option.label}
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </fieldset>
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
    <footer className="border-t border-white/10 bg-[#050806] py-12">
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-5 sm:gap-8">
          <Link to="/">
            <img
              src={bodyfuelLogoAsset.url}
              alt="BodyFuel Coaching"
              className="h-12 w-auto max-w-[190px] object-contain sm:h-14"
            />
          </Link>
          <span aria-hidden="true" className="text-xl font-light text-white/25">
            ×
          </span>
          <PartnerLogoCard className="h-16 w-[210px] sm:h-20 sm:w-[250px]" />
        </div>

        <p className="max-w-2xl text-xs leading-6 text-white/45">
          Kooperationspartner: {PARTNER_NAME}, Schorlemerstraße 7, 48683 Ahaus ·{" "}
          <a href="tel:+492561 93480" className="hover:text-white/70">
            02561 93480
          </a>
        </p>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-sm font-medium text-white/70">
          <Link to="/" className="hover:text-gold">
            Homepage
          </Link>
          <Link to="/impressum" className="hover:text-gold">
            Impressum
          </Link>
          <Link to="/datenschutz" className="hover:text-gold">
            Datenschutz
          </Link>
          <a
            href="https://www.continentale.de/web/woltering-sonntag-holt/rechtliches"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gold"
          >
            Rechtliches des Partners
          </a>
          <span className="text-xs text-white/35">© {new Date().getFullYear()} BodyFuel Coaching</span>
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
