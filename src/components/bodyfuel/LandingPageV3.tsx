import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Apple,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
  Dumbbell,
  Heart,
  Instagram,
  LineChart,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Target,
  Users,
  Zap,
} from "lucide-react";
import bodyfuelLogoAsset from "@/assets/bodyfuel-coaching-logo.png.asset.json";
import fuelyHappyAsset from "@/assets/fuely-happy.png.asset.json";
import fuelyMotivatedAsset from "@/assets/fuely-motivated.png.asset.json";
import appDashboardAsset from "@/assets/app-dashboard.png.asset.json";
import nutritionPlanAsset from "@/assets/nutrition-plan.jpeg.asset.json";
import nutritionMacrosAsset from "@/assets/nutrition-macros.jpeg.asset.json";
import nutritionTrackerAsset from "@/assets/nutrition-tracker.jpeg.asset.json";
import manuCoachAsset from "@/assets/manu-coach.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { PACKAGES } from "@/lib/bodyfuel/packages";
import { submitLead } from "@/lib/coaching.functions";
import { useConsent } from "@/lib/consent";
import { toast } from "sonner";

const painPoints = [
  {
    icon: Target,
    title: "Zu viel Information, zu wenig Plan",
    text: "Du weißt theoretisch viel — aber nicht, was heute wirklich Priorität hat.",
  },
  {
    icon: ClipboardList,
    title: "Kein Plan, keine Struktur",
    text: "Motivation ist da. Ein klarer Ablauf, der auch im Alltag funktioniert, fehlt.",
  },
  {
    icon: Phone,
    title: "Zu wenig Zeit",
    text: "Arbeit, Familie, Termine — dein Fitnessziel darf nicht noch ein Vollzeitprojekt werden.",
  },
  {
    icon: LineChart,
    title: "Keine klaren Ergebnisse",
    text: "Du trainierst und achtest auf Ernährung, siehst aber nicht zuverlässig, was funktioniert.",
  },
  {
    icon: BarChart3,
    title: "Zu kompliziert, zu unflexibel",
    text: "Ernährung, Training und Tracking laufen in verschiedenen Apps, Notizen oder Tabellen.",
  },
];

const processSteps = [
  {
    icon: Target,
    title: "Ziel setzen",
    text: "Du hinterlegst Ziel, Alltag, Erfahrung und Rahmenbedingungen.",
  },
  {
    icon: ClipboardList,
    title: "Plan erhalten",
    text: "BodyFuel strukturiert Ernährung, Training und deine wichtigsten Tagesziele.",
  },
  {
    icon: Check,
    title: "Umsetzen & tracken",
    text: "Du folgst dem Plan, dokumentierst deinen Alltag und sammelst echte Fortschrittsdaten.",
  },
  {
    icon: LineChart,
    title: "Fortschritte sehen",
    text: "Trends werden sichtbar und dein System kann auf deine Entwicklung reagieren.",
  },
];

const systemNeeds = [
  "Individuelle Ernährungsplanung",
  "Training für Fitnessstudio oder Zuhause",
  "Kalorien, Makros und Tagesziele",
  "Progress-Tracking & Auswertungen",
  "Rezepte, Einkaufsliste & Meal-Prep-Ideen",
  "Erinnerungen, Routinen & Motivation",
];

const outcomes = [
  { icon: Zap, title: "Mehr Klarheit", text: "im Alltag" },
  { icon: Dumbbell, title: "Mehr Struktur", text: "im Training" },
  { icon: Apple, title: "Bessere Ernährung", text: "ohne Rätselraten" },
  { icon: LineChart, title: "Messbarer Fortschritt", text: "statt Bauchgefühl" },
  { icon: Heart, title: "Mehr Konstanz", text: "für langfristige Ergebnisse" },
];

const faqs = [
  {
    q: "Was ist der Unterschied zwischen Smart und Coaching?",
    a: "Smart ist dein digitaler Fitness-Autopilot. Im Coaching bekommst du zusätzlich persönliche 1:1-Betreuung, Check-ins, Feedback und individuelle Anpassungen durch Manu.",
  },
  {
    q: "Kann ich Smart kostenlos testen?",
    a: "Ja. BodyFuel Smart kannst du 7 Tage kostenlos testen. Dafür sind keine Zahlungsdaten nötig.",
  },
  {
    q: "Brauche ich ein Fitnessstudio?",
    a: "Nein. Dein Training kann auf dein verfügbares Equipment, dein Erfahrungslevel und deine Trainingstage abgestimmt werden.",
  },
  {
    q: "Ist BodyFuel nur zum Abnehmen gedacht?",
    a: "Nein. BodyFuel kann dich beim Abnehmen, Muskelaufbau, bei Recomposition und bei allgemeinen Fitness- und Performancezielen unterstützen.",
  },
  {
    q: "Kann ich jederzeit zwischen Smart und Coaching wechseln?",
    a: "Ja. Smart ist der selbstständige Weg. Wenn du später persönliche Betreuung möchtest, kannst du auf Coaching wechseln.",
  },
];

export function LandingPageV3() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#060907] text-foreground selection:bg-gold/30">
      <Header />
      <main>
        <Hero />
        <ProblemSection />
        <HowItWorksSection />
        <ProductChoiceSection />
        <CoachProfileSection />
        <PricingSection />
        <OutcomeStrip />
        <FaqAndCtaSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}

function BrandLogo() {
  return (
    <img
      src={bodyfuelLogoAsset.url}
      alt="BodyFuel Coaching"
      className="h-10 w-auto max-w-[138px] object-contain sm:h-12 sm:max-w-[190px]"
    />
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050806]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="min-w-0 shrink-0">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-7 text-xs font-semibold uppercase tracking-[0.08em] text-white/65 lg:flex">
          <a href="#system" className="transition hover:text-white">Fürs System</a>
          <a href="#ablauf" className="transition hover:text-white">So funktioniert&apos;s</a>
          <a href="#wege" className="transition hover:text-white">Smart oder Coaching</a>
          <a href="#preise" className="transition hover:text-white">Preise</a>
          <a href="#faq" className="transition hover:text-white">FAQ</a>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/app"
            className="hidden h-9 items-center justify-center rounded-lg border border-white/15 bg-transparent px-4 text-sm font-semibold text-white transition hover:border-gold/40 hover:bg-gold/10 sm:inline-flex"
          >
            Login
          </Link>
          <Link to="/trial">
            <Button size="sm" className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
              <span className="hidden sm:inline">7 Tage kostenlos testen</span>
              <span className="sm:hidden">Gratis testen</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/10">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_72%_30%,rgba(45,185,91,0.18),transparent_34%),radial-gradient(circle_at_10%_15%,rgba(45,185,91,0.07),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.1] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:min-h-[720px] lg:grid-cols-[0.88fr_1.12fr] lg:px-8 lg:py-20">
        <div className="relative z-20 max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-gold">Dein System für Ernährung & Training</div>
          <h1 className="mt-5 font-display text-[clamp(3rem,6vw,6.1rem)] font-bold uppercase leading-[0.9] tracking-[-0.04em] text-white">
            Du musst nicht mehr wissen,<br />
            <span className="text-gradient-gold">was du tun sollst.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            BodyFuel plant, strukturiert und begleitet deine Ernährung und dein Training — jeden Tag in einer App.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/trial">
              <Button size="lg" className="w-full bg-gradient-gold px-7 text-primary-foreground shadow-gold hover:opacity-90 sm:w-auto">
                7 Tage kostenlos testen
              </Button>
            </Link>
            <a href="#wege">
              <Button size="lg" variant="outline" className="w-full border-white/20 bg-black/20 px-7 text-white hover:border-gold/45 hover:bg-gold/10 hover:text-white sm:w-auto">
                Coaching entdecken <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </a>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-white/50">
            <ShieldCheck className="h-4 w-4 text-gold" /> Keine Zahlungsdaten für den Smart-Test nötig
          </div>
        </div>
        <PhoneHero />
      </div>
    </section>
  );
}

function PhoneHero() {
  return (
    <div className="relative mx-auto min-h-[480px] w-full max-w-[760px] sm:min-h-[560px] lg:min-h-[600px]">
      <div className="absolute inset-x-[5%] top-[8%] h-[68%] rounded-full bg-gold/10 blur-[95px]" />
      <PhoneShot src={nutritionPlanAsset.url} alt="BodyFuel Ernährungsplan" className="left-[2%] top-[16%] z-10 -rotate-[5deg] sm:left-[5%]" />
      <PhoneShot src={appDashboardAsset.url} alt="BodyFuel App Dashboard" className="left-1/2 top-[4%] z-20 -translate-x-1/2 rotate-[1deg]" />
      <PhoneShot src={nutritionTrackerAsset.url} alt="BodyFuel Fortschritt und Tracking" className="right-[1%] top-[18%] z-10 rotate-[5deg] sm:right-[4%]" />
      <img
        src={fuelyHappyAsset.url}
        alt="Fuely, der BodyFuel Begleiter"
        className="absolute bottom-[-1%] right-[0%] z-30 h-[145px] w-auto drop-shadow-[0_20px_35px_rgba(0,0,0,0.55)] sm:h-[185px] lg:h-[205px]"
      />
    </div>
  );
}

function PhoneShot({ src, alt, className }: { src: string; alt: string; className: string }) {
  return (
    <div className={`absolute w-[38%] max-w-[245px] ${className}`}>
      <div className="rounded-[2rem] border border-white/20 bg-black p-[7px] shadow-[0_30px_80px_rgba(0,0,0,0.58)] sm:rounded-[2.4rem] sm:p-[9px]">
        <div className="overflow-hidden rounded-[1.55rem] bg-[#090d0b] sm:rounded-[1.9rem]">
          <img src={src} alt={alt} className="block h-auto w-full" />
        </div>
      </div>
    </div>
  );
}

function ProblemSection() {
  return (
    <section id="system" className="border-b border-white/10 bg-[#080c09] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <SectionEyebrow>Kennst du das?</SectionEyebrow>
          <h2 className="mt-4 font-display text-4xl font-bold uppercase text-white sm:text-5xl">Fitness wird oft unnötig kompliziert.</h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {painPoints.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-[#0d1210] p-6 text-center transition hover:-translate-y-1 hover:border-gold/35">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-gold/35 bg-gold/8 text-gold">
                <item.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-sm font-bold leading-5 text-white">{item.title}</h3>
              <p className="mt-3 text-xs leading-5 text-white/50">{item.text}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 text-center">
          <div className="font-display text-xl font-bold uppercase text-gold sm:text-2xl">BodyFuel ist die Lösung.</div>
          <p className="mt-2 text-sm text-white/55 sm:text-base">Ein System. Alles in einer App. Für echte Ergebnisse.</p>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="ablauf" className="relative overflow-hidden border-b border-white/10 py-20 sm:py-24">
      <div className="pointer-events-none absolute right-[-12rem] top-[-5rem] h-[34rem] w-[34rem] rounded-full bg-gold/8 blur-[120px]" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:gap-16 lg:px-8">
        <div>
          <SectionEyebrow>So funktioniert&apos;s</SectionEyebrow>
          <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-[0.98] text-white sm:text-5xl">Ein klarer Ablauf.<br /><span className="text-gradient-gold">Jeden Tag.</span></h2>
          <div className="mt-9 space-y-4">
            {processSteps.map((step, index) => (
              <div key={step.title} className="relative flex gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold">
                  <step.icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Schritt {index + 1}</div>
                  <h3 className="mt-1 font-semibold text-white">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-white/50">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-[0.78fr_1.22fr]">
          <div className="relative flex min-h-[560px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-[#0d1210] p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(45,185,91,0.16),transparent_42%)]" />
            <div className="relative w-[76%] max-w-[245px]">
              <PhoneShotStatic src={nutritionMacrosAsset.url} alt="BodyFuel Tagesziele" />
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d1210] p-7 sm:p-8">
            <SectionEyebrow>Alles, was du brauchst</SectionEyebrow>
            <h3 className="mt-4 font-display text-3xl font-bold uppercase text-white">Ein System statt fünf Tools.</h3>
            <ul className="mt-7 space-y-4">
              {systemNeeds.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-white/70">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-gold" strokeWidth={2.7} />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-2xl border border-gold/25 bg-gold/5 p-5 pr-28 sm:pr-32">
              <div className="text-sm font-semibold text-white">Und Fuely ist dabei.</div>
              <p className="mt-2 text-xs leading-5 text-white/50">Dein Begleiter erinnert dich an Routinen, motiviert dich und macht Fortschritt sichtbar.</p>
            </div>
            <img src={fuelyMotivatedAsset.url} alt="Fuely" className="absolute bottom-0 right-2 h-40 w-auto sm:h-48" />
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneShotStatic({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-[2.2rem] border border-white/20 bg-black p-[8px] shadow-[0_30px_80px_rgba(0,0,0,0.58)]">
      <div className="overflow-hidden rounded-[1.75rem] bg-[#090d0b]">
        <img src={src} alt={alt} loading="lazy" className="block h-auto w-full" />
      </div>
    </div>
  );
}

function ProductChoiceSection() {
  const smart = PACKAGES.find((pkg) => pkg.key === "smart");
  const coaching = PACKAGES.find((pkg) => pkg.key === "coaching");

  if (!smart || !coaching) return null;

  return (
    <section id="wege" className="border-b border-white/10 bg-[#080c09] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <SectionEyebrow>Smart oder persönliches Coaching?</SectionEyebrow>
          <h2 className="mt-4 font-display text-4xl font-bold uppercase text-white sm:text-5xl">Du entscheidest, wie viel Begleitung du willst.</h2>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <ChoiceCard
            title="BodyFuel Smart"
            subtitle="Dein Plan. Deine App. Dein Tempo."
            price={`${String(smart.price).replace(".", ",")} €`}
            features={smart.features}
            image={nutritionTrackerAsset.url}
            imageAlt="BodyFuel Smart Fortschritt"
            action={<Link to="/trial"><Button size="lg" className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">7 Tage kostenlos testen</Button></Link>}
          />
          <ChoiceCard
            title="Persönliches Coaching"
            subtitle="Du & ich. Gemeinsam zu deinem Ziel."
            price={`${String(coaching.price).replace(".", ",")} €`}
            features={coaching.features}
            image={manuCoachAsset.url}
            imageAlt="Manu, BodyFuel Coach"
            action={<a href="#kontakt"><Button size="lg" className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">Coaching entdecken</Button></a>}
            coachImage
          />
        </div>
      </div>
    </section>
  );
}

function ChoiceCard({
  title,
  subtitle,
  price,
  features,
  image,
  imageAlt,
  action,
  coachImage = false,
}: {
  title: string;
  subtitle: string;
  price: string;
  features: string[];
  image: string;
  imageAlt: string;
  action: ReactNode;
  coachImage?: boolean;
}) {
  return (
    <article className="grid overflow-hidden rounded-3xl border border-white/10 bg-[#0d1210] sm:grid-cols-[0.75fr_1.25fr]">
      <div className="relative min-h-[300px] overflow-hidden border-b border-white/10 sm:min-h-full sm:border-b-0 sm:border-r">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(45,185,91,0.14),transparent_50%)]" />
        {coachImage ? (
          <img src={image} alt={imageAlt} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="w-[74%] max-w-[220px]"><PhoneShotStatic src={image} alt={imageAlt} /></div>
          </div>
        )}
      </div>
      <div className="p-7 sm:p-8">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{title}</div>
        <h3 className="mt-2 font-display text-2xl font-bold uppercase text-white">{subtitle}</h3>
        <ul className="mt-6 space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-white/65">
              <Check className="mt-1 h-4 w-4 shrink-0 text-gold" />{feature}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex items-end gap-2">
          <div className="font-display text-4xl font-bold text-white">{price}</div>
          <div className="mb-1 text-xs text-white/45">/ Monat</div>
        </div>
        <div className="mt-6">{action}</div>
      </div>
    </article>
  );
}

function CoachProfileSection() {
  const badges = ["Coaching", "Ernährung", "Krafttraining", "Athletik"];
  const facts = [
    "Seit über 10 Jahren im Fitnessbereich",
    "Performance-Coach im American Football",
    "Gründer & Entwickler von BodyFuel",
  ];

  return (
    <section id="coach" className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-3xl border border-white/10 bg-[#0d1210] lg:grid-cols-[0.82fr_1.18fr]">
          <div className="relative min-h-[420px] overflow-hidden border-b border-white/10 lg:min-h-[560px] lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(45,185,91,0.16),transparent_55%)]" />
            <img src={manuCoachAsset.url} alt="Manuel Manu Schrader, Founder und Head Coach von BodyFuel" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
            <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur-lg">
              <div className="font-display text-2xl font-bold uppercase text-white">Manuel „Manu“ Schrader</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">Founder & Head Coach · BodyFuel</div>
            </div>
          </div>

          <div className="p-7 sm:p-10 lg:p-12">
            <SectionEyebrow>Dein Coach</SectionEyebrow>
            <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-[0.98] text-white sm:text-5xl">Kein anonymer Plan.<br /><span className="text-gradient-gold">Ein echter Ansprechpartner.</span></h2>
            <div className="mt-7 flex flex-wrap gap-2">
              {badges.map((badge) => <span key={badge} className="rounded-full border border-gold/25 bg-gold/7 px-3 py-1.5 text-xs font-semibold text-white/75">{badge}</span>)}
            </div>
            <ul className="mt-8 space-y-3">
              {facts.map((fact) => <li key={fact} className="flex items-center gap-3 text-sm text-white/70"><Check className="h-4 w-4 shrink-0 text-gold" />{fact}</li>)}
            </ul>
            <blockquote className="mt-9 rounded-2xl border border-white/10 bg-black/20 p-6">
              <div className="font-display text-4xl leading-none text-gold">“</div>
              <p className="mt-2 text-sm leading-7 text-white/65 sm:text-base">
                Ich weiß, wie es ist, wenn man alles alleine herausfinden muss. BodyFuel ist aus genau diesem Gedanken entstanden: ein System zu bauen, das dir Klarheit gibt — und im Coaching zusätzlich jemanden, der wirklich hinschaut.
              </p>
              <div className="mt-4 font-display text-xl font-bold text-white">Manu</div>
            </blockquote>
            <a href="#kontakt" className="mt-8 inline-flex"><Button className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">Coaching mit Manu anfragen <ArrowRight className="ml-1 h-4 w-4" /></Button></a>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const { openCheckout, checkoutElement, isOpen } = useStripeCheckout();
  const checkoutRef = useRef<HTMLDivElement>(null);

  const handleBuy = (priceId: string) => {
    openCheckout({
      priceId,
      returnUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    });
    window.setTimeout(() => checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  return (
    <section id="preise" className="border-y border-white/10 bg-[#080c09] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionEyebrow>Fair. Transparent.</SectionEyebrow>
            <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-[0.98] text-white sm:text-5xl">Wähle den Weg,<br /><span className="text-gradient-gold">der zu dir passt.</span></h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/55 sm:text-base">Smart, wenn du selbstständig arbeiten willst. Coaching, wenn du persönliche Führung und regelmäßiges Feedback möchtest.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <TrustTile icon={ShieldCheck} title="Smart testen" text="7 Tage kostenlos" />
              <TrustTile icon={MessageCircle} title="Echter Support" text="im Coaching" />
              <TrustTile icon={Check} title="Klare Preise" text="ohne Tarifchaos" />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {PACKAGES.map((pkg) => (
              <article key={pkg.key} className={`relative flex flex-col rounded-3xl border p-7 ${pkg.popular ? "border-gold/45 bg-gradient-to-b from-gold/10 to-[#0d1210]" : "border-white/10 bg-[#0d1210]"}`}>
                {pkg.popular && <span className="absolute right-5 top-5 rounded-full bg-gradient-gold px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-primary-foreground">Persönlich</span>}
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{pkg.name}</div>
                <p className="mt-3 text-sm text-white/50">{pkg.tagline}</p>
                <div className="mt-6 flex items-end gap-2">
                  <span className="font-display text-5xl font-bold text-white">{String(pkg.price).replace(".", ",")} €</span>
                  <span className="mb-1.5 text-sm text-white/45">/ Monat</span>
                </div>
                <div className="my-6 h-px bg-white/10" />
                <ul className="space-y-3">
                  {pkg.features.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-white/70"><Check className="mt-1 h-4 w-4 shrink-0 text-gold" />{feature}</li>)}
                </ul>
                <div className="mt-8 flex-1" />
                {pkg.key === "smart" ? (
                  <Link to="/trial"><Button size="lg" className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">Jetzt kostenlos testen</Button></Link>
                ) : (
                  <Button size="lg" onClick={() => handleBuy(pkg.priceId)} className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">Coaching starten</Button>
                )}
              </article>
            ))}
          </div>
        </div>
        <div ref={checkoutRef} className={isOpen ? "mt-8 scroll-mt-24 overflow-hidden rounded-2xl bg-background" : ""}>{checkoutElement}</div>
        <p className="mt-8 text-center text-xs leading-5 text-white/35">Alle Preise gemäß § 19 UStG (Kleinunternehmerregelung). Es wird keine Umsatzsteuer ausgewiesen.</p>
      </div>
    </section>
  );
}

function TrustTile({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1210] p-4">
      <Icon className="h-5 w-5 text-gold" />
      <div className="mt-3 text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs text-white/45">{text}</div>
    </div>
  );
}

function OutcomeStrip() {
  return (
    <section className="py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-[#0d1210] px-5 py-7">
          <div className="text-center font-display text-xl font-bold uppercase text-white">Ein System. Echte Ergebnisse.</div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {outcomes.map((item) => (
              <div key={item.title} className="flex items-center gap-3 lg:justify-center">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/10 text-gold"><item.icon className="h-4 w-4" /></span>
                <div><div className="text-sm font-semibold text-white">{item.title}</div><div className="text-xs text-white/45">{item.text}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqAndCtaSection() {
  return (
    <section id="faq" className="pb-20 pt-8 sm:pb-24">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-[#0d1210] p-6 sm:p-8">
          <SectionEyebrow>Häufige Fragen</SectionEyebrow>
          <div className="mt-6 space-y-3">
            {faqs.map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-white/10 bg-black/20 p-4 open:border-gold/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-white">
                  {faq.q}<ChevronDown className="h-4 w-4 shrink-0 text-gold transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-6 text-white/50">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d1210] p-7 pr-8 sm:p-10 lg:pr-52">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_55%,rgba(45,185,91,0.15),transparent_35%)]" />
          <div className="relative z-10">
            <SectionEyebrow>Bereit, dein Ziel zu erreichen?</SectionEyebrow>
            <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-[0.98] text-white sm:text-5xl">Starte jetzt.<br /><span className="text-gradient-gold">Der nächste Schritt ist klar.</span></h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/55 sm:text-base">Teste BodyFuel Smart kostenlos oder hol dir persönliche Unterstützung im Coaching.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Link to="/trial"><Button size="lg" className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90 sm:w-auto lg:w-full xl:w-auto">7 Tage kostenlos testen</Button></Link>
              <a href="#kontakt"><Button size="lg" variant="outline" className="w-full border-white/20 bg-transparent text-white hover:border-gold/40 hover:bg-gold/10 hover:text-white sm:w-auto lg:w-full xl:w-auto">Coaching anfragen</Button></a>
            </div>
          </div>
          <img src={fuelyHappyAsset.url} alt="Fuely" className="relative z-10 mx-auto mt-8 h-44 w-auto lg:absolute lg:bottom-0 lg:right-3 lg:mt-0 lg:h-52" />
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  const submitLeadFn = useServerFn(submitLead);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    goal: "",
    current_weight: "",
    desired_package: "" as "" | "smart" | "coaching" | "unsure",
    message: "",
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name || !form.email) {
      toast.error("Bitte fülle mindestens Name und E-Mail aus.");
      return;
    }
    setSubmitting(true);
    try {
      await submitLeadFn({
        data: {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          goal: form.goal || undefined,
          current_weight: form.current_weight || undefined,
          desired_package: form.desired_package || undefined,
          message: form.message || undefined,
        },
      });
      setDone(true);
      setForm({ name: "", email: "", phone: "", goal: "", current_weight: "", desired_package: "", message: "" });
    } catch (error) {
      toast.error((error as Error).message || "Senden fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="kontakt" className="border-t border-white/10 bg-[#080c09] py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:px-8">
        <div>
          <SectionEyebrow>Coaching anfragen</SectionEyebrow>
          <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-[0.98] text-white sm:text-5xl">Du willst mich<br /><span className="text-gradient-gold">an deiner Seite?</span></h2>
          <p className="mt-5 max-w-lg text-sm leading-7 text-white/55 sm:text-base">Schick mir kurz deine Eckdaten. Ich sehe mir deine Ausgangslage an und wir klären, ob persönliches BodyFuel Coaching zu dir passt.</p>
          <div className="mt-7 space-y-3 text-sm text-white/60">
            <div className="flex items-center gap-3"><Check className="h-4 w-4 text-gold" /> Ziel und Ausgangslage klären</div>
            <div className="flex items-center gap-3"><Check className="h-4 w-4 text-gold" /> Persönliche Betreuung durch Manu</div>
            <div className="flex items-center gap-3"><Check className="h-4 w-4 text-gold" /> Unverbindliche Anfrage</div>
          </div>
        </div>

        {done ? (
          <div className="grid min-h-[430px] place-items-center rounded-3xl border border-gold/30 bg-gold/5 p-8 text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-gold"><Check className="h-6 w-6 text-primary-foreground" /></span>
              <h3 className="mt-5 font-display text-3xl font-bold text-white">Anfrage ist raus.</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/50">Danke dir. Deine Angaben wurden übermittelt.</p>
              <Button variant="outline" className="mt-6 border-white/15 bg-transparent text-white hover:bg-white/5" onClick={() => setDone(false)}>Weitere Anfrage</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-[#0d1210] p-6 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name *" htmlFor="name"><Input id="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Dein Name" /></Field>
              <Field label="E-Mail *" htmlFor="email"><Input id="email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@beispiel.de" /></Field>
              <Field label="Telefon" htmlFor="phone"><Input id="phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+49 …" /></Field>
              <Field label="Aktuelles Gewicht" htmlFor="weight"><Input id="weight" value={form.current_weight} onChange={(event) => setForm({ ...form, current_weight: event.target.value })} placeholder="z. B. 82 kg" /></Field>
              <Field label="Dein Ziel" htmlFor="goal">
                <Select value={form.goal} onValueChange={(value) => setForm({ ...form, goal: value })}>
                  <SelectTrigger id="goal"><SelectValue placeholder="Ziel auswählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abnehmen">Abnehmen</SelectItem>
                    <SelectItem value="muskelaufbau">Muskelaufbau</SelectItem>
                    <SelectItem value="koerperform">Körperform verbessern</SelectItem>
                    <SelectItem value="ernaehrung">Ernährung strukturieren</SelectItem>
                    <SelectItem value="sonstiges">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Wunschpaket" htmlFor="pkg">
                <Select value={form.desired_package} onValueChange={(value) => setForm({ ...form, desired_package: value as typeof form.desired_package })}>
                  <SelectTrigger id="pkg"><SelectValue placeholder="Noch unsicher? Auch okay." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smart">BodyFuel Smart (14,99 €)</SelectItem>
                    <SelectItem value="coaching">BodyFuel Coaching (69 €)</SelectItem>
                    <SelectItem value="unsure">Noch unsicher</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-5">
              <Field label="Nachricht" htmlFor="message"><Textarea id="message" rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Erzähl kurz, wo du gerade stehst …" /></Field>
            </div>
            <Button type="submit" disabled={submitting} size="lg" className="mt-6 w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
              {submitting ? "Wird gesendet …" : "Unverbindlich anfragen"}
              {!submitting && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">{children}</div>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={htmlFor} className="text-white/75">{label}</Label>{children}</div>;
}

function Footer() {
  const { openSettings } = useConsent();
  return (
    <footer className="border-t border-white/10 bg-[#050806] py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div><BrandLogo /><p className="mt-4 max-w-sm text-sm leading-6 text-white/45">Dein Ziel. Ein System. Jeden Tag.</p></div>
          <FooterCol title="BodyFuel"><a href="#system">System</a><a href="#ablauf">So funktioniert&apos;s</a><a href="#wege">Smart oder Coaching</a><a href="#preise">Preise</a><Link to="/app">Login</Link></FooterCol>
          <FooterCol title="Kontakt & Rechtliches">
            <a href="mailto:info@bodyfuel-coaching.com" className="inline-flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> info@bodyfuel-coaching.com</a>
            <a href="https://instagram.com/bodyfuel_coaching" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2"><Instagram className="h-3.5 w-3.5" /> @bodyfuel_coaching</a>
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
            <button onClick={openSettings} className="text-left">Cookie-Einstellungen</button>
          </FooterCol>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/35">© {new Date().getFullYear()} BODYFUEL Nutrition Coaching.</div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return <div><div className="font-display text-sm font-bold uppercase tracking-[0.12em] text-white">{title}</div><div className="mt-4 flex flex-col gap-2.5 text-sm text-white/45 [&_a:hover]:text-white [&_button:hover]:text-white">{children}</div></div>;
}
