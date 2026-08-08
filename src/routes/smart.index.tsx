import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Dumbbell,
  Flame,
  HeartHandshake,
  LineChart,
  ListChecks,
  ShoppingCart,
  Sparkles,
  Target,
  Trophy,
  Utensils,
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
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/smart/")({
  head: () => ({
    meta: [
      { title: "BodyFuel Smart — Dein Fitness-Autopilot | 7 Tage gratis" },
      {
        name: "description",
        content:
          "BodyFuel Smart verbindet Ernährungsplan, Trainingsplan, Einkaufsliste, Tracking, Strength Check und Fortschrittsprognosen in einer App. 7 Tage kostenlos testen.",
      },
      { property: "og:title", content: "BodyFuel Smart — Dein Fitness-Autopilot" },
      {
        property: "og:description",
        content:
          "Ernährung, Training und Fortschritt automatisch organisiert. 7 Tage gratis testen — ohne Zahlungsdaten.",
      },
      { property: "og:url", content: "https://bodyfuel-coaching.com/smart" },
    ],
    links: [{ rel: "canonical", href: "https://bodyfuel-coaching.com/smart" }],
  }),
  component: SmartLandingPage,
});

const smartFeatures = [
  {
    icon: Utensils,
    title: "Ernährungsplan",
    text: "Smart erstellt einen Plan passend zu Ziel, Kalorien, Makros, Vorlieben und deinem Alltag.",
  },
  {
    icon: Dumbbell,
    title: "Trainingsplan",
    text: "Training passend zu Erfahrung, Equipment und verfügbaren Tagen — direkt in der App.",
  },
  {
    icon: ShoppingCart,
    title: "Einkaufsliste",
    text: "Deine geplanten Mahlzeiten werden zu einer übersichtlichen Einkaufsliste zusammengeführt.",
  },
  {
    icon: Zap,
    title: "Strength Check",
    text: "Kraftwerte regelmäßig prüfen und Fortschritt sichtbar machen, statt nur nach Gefühl zu trainieren.",
  },
  {
    icon: LineChart,
    title: "Prognosen & Tracking",
    text: "Kalorien, Makros, Gewicht und Leistung werden zusammengeführt und als Entwicklung sichtbar.",
  },
  {
    icon: Users,
    title: "Partner-Modus",
    text: "Ziele gemeinsam verfolgen und Fortschritt teilen — ohne dass dein eigenes System unübersichtlich wird.",
  },
];

const processSteps = [
  {
    n: "01",
    title: "Du beantwortest das Onboarding",
    text: "Ziel, Alltag, Training, Lebensmittel und persönliche Rahmenbedingungen — einmal sauber erfassen.",
  },
  {
    n: "02",
    title: "Smart baut dein System",
    text: "Ernährung und Training werden passend zu deinen Angaben zusammengestellt und direkt in der App bereitgestellt.",
  },
  {
    n: "03",
    title: "Du trackst deinen Alltag",
    text: "Mahlzeiten, Workouts, Makros und Fortschritt laufen in einem gemeinsamen Dashboard zusammen.",
  },
  {
    n: "04",
    title: "Du entwickelst dich weiter",
    text: "Strength Check, Fortschrittsdaten, Level und Prognosen zeigen dir, was funktioniert und wo du nachsteuern solltest.",
  },
];

const faqs = [
  {
    q: "Ist der 7-Tage-Test wirklich kostenlos?",
    a: "Ja. Du brauchst keine Zahlungsdaten. Der Test endet nach 7 Tagen automatisch. Danach entscheidest du selbst, ob du Smart für 14,99 € pro Monat weiter nutzen möchtest.",
  },
  {
    q: "Ist BodyFuel Smart ein persönliches Coaching?",
    a: "Nein. Smart ist die selbstständige BodyFuel-Lösung mit automatisierter Planung und digitalen Tools. Wenn du persönliche Check-ins, individuelle Anpassungen und direkten Support möchtest, ist BodyFuel Coaching die passende Stufe.",
  },
  {
    q: "Brauche ich ein Fitnessstudio?",
    a: "Nein. Der Trainingsplan kann sich an dein verfügbares Equipment und deine möglichen Trainingstage anpassen.",
  },
  {
    q: "Kann ich Smart später auf Coaching upgraden?",
    a: "Ja. Du kannst später auf BodyFuel Coaching wechseln, wenn du zusätzlich persönliche Betreuung möchtest.",
  },
  {
    q: "Was kostet Smart nach dem Test?",
    a: "BodyFuel Smart kostet nach dem kostenlosen Test 14,99 € pro Monat.",
  },
];

function SmartLandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070b09] text-white selection:bg-gold/30">
      <SmartHeader />
      <main>
        <SmartHero />
        <SmartSignalBar />
        <SmartFeatures />
        <HowItWorks />
        <AppShowcase />
        <FuelySection />
        <SmartVsCoaching />
        <SmartPrice />
        <FaqSection />
        <FinalCta />
      </main>
      <SmartFooter />
    </div>
  );
}

function BrandLogo() {
  return (
    <img
      src={bodyfuelLogoAsset.url}
      alt="BodyFuel Coaching"
      className="h-11 w-auto max-w-[185px] object-contain sm:h-12"
    />
  );
}

function SmartHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050806]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0"><BrandLogo /></Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-white/65 lg:flex">
          <a href="#features" className="transition hover:text-white">Funktionen</a>
          <a href="#ablauf" className="transition hover:text-white">So funktioniert's</a>
          <a href="#app" className="transition hover:text-white">App</a>
          <a href="#vergleich" className="transition hover:text-white">Smart vs. Coaching</a>
          <a href="#faq" className="transition hover:text-white">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/app" className="hidden h-9 items-center rounded-lg border border-gold/35 px-4 text-sm font-semibold text-white transition hover:bg-gold/10 sm:inline-flex">
            Login
          </Link>
          <Link to="/trial">
            <Button size="sm" className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
              7 Tage gratis testen
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function SmartHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/10">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_72%_30%,rgba(45,185,91,0.18),transparent_33%),radial-gradient(circle_at_15%_20%,rgba(45,185,91,0.07),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.1] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:min-h-[720px] lg:grid-cols-[.82fr_1.18fr] lg:px-8 lg:pb-24">
        <div className="relative z-20 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3.5 w-3.5" /> BodyFuel Smart
          </div>
          <h1 className="mt-6 font-display text-[clamp(3.3rem,6vw,6.2rem)] font-bold leading-[0.9] tracking-[-0.035em]">
            Dein Fitness-<br />
            <span className="text-gradient-gold">Autopilot.</span><br />
            Jeden Tag.
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            BodyFuel Smart organisiert Ernährung, Training und Fortschritt in einem System — damit du weniger planen und mehr umsetzen kannst.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/trial">
              <Button size="lg" className="w-full bg-gradient-gold px-7 text-primary-foreground shadow-gold hover:opacity-90 sm:w-auto">
                7 Tage gratis testen <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="w-full border-gold/40 bg-transparent px-7 text-white hover:bg-gold/10 hover:text-white sm:w-auto">
                Funktionen ansehen
              </Button>
            </a>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/55">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-gold" /> Ohne Zahlungsdaten</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-gold" /> Test endet automatisch</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-gold" /> Danach 14,99 € / Monat</span>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="flex gap-0.5 text-sm text-[#f4b83f]" aria-hidden="true">★★★★★</div>
            <div className="text-xs text-white/60"><span className="font-semibold text-white">4,8/5</span> aus 50+ Bewertungen</div>
          </div>
        </div>

        <SmartPhoneStack />
      </div>
    </section>
  );
}

function SmartPhoneStack() {
  return (
    <div className="relative mx-auto min-h-[500px] w-full max-w-[760px] lg:min-h-[590px]">
      <div className="absolute inset-x-[8%] top-[8%] h-[68%] rounded-full bg-gold/10 blur-[95px]" />
      <PhoneShot src={nutritionTrackerAsset.url} alt="BodyFuel Smart Ernährungstracking" className="left-[3%] top-[12%] z-10 -rotate-[4deg] sm:left-[7%]" />
      <PhoneShot src={nutritionPlanAsset.url} alt="BodyFuel Smart Ernährungsplan" className="left-1/2 top-[3%] z-20 -translate-x-1/2 rotate-[1deg]" />
      <PhoneShot src={appDashboardAsset.url} alt="BodyFuel Smart Dashboard" className="right-[2%] top-[13%] z-10 rotate-[4deg] sm:right-[5%]" />
      <img
        src={fuelyHappyAsset.url}
        alt="Fuely"
        className="absolute bottom-[-1%] right-[0%] z-30 h-[145px] w-auto drop-shadow-[0_20px_35px_rgba(0,0,0,.55)] sm:h-[185px] lg:h-[215px]"
      />
    </div>
  );
}

function PhoneShot({ src, alt, className }: { src: string; alt: string; className: string }) {
  return (
    <div className={`absolute w-[38%] max-w-[245px] ${className}`}>
      <div className="rounded-[2rem] border border-white/20 bg-black p-[7px] shadow-[0_30px_80px_rgba(0,0,0,.58)] sm:rounded-[2.4rem] sm:p-[9px]">
        <div className="overflow-hidden rounded-[1.55rem] bg-[#090d0b] sm:rounded-[1.9rem]">
          <img src={src} alt={alt} className="block h-auto w-full" />
        </div>
      </div>
    </div>
  );
}

function SmartSignalBar() {
  const items = [
    [Zap, "Autopilot", "Planung digital organisiert"],
    [Utensils, "Ernährung", "Plan, Makros & Tracking"],
    [Dumbbell, "Training", "Plan & Strength Check"],
    [BarChart3, "Fortschritt", "Daten, Ziele & Prognosen"],
  ] as const;

  return (
    <section className="relative z-30 -mt-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d1210]/95 shadow-2xl backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([Icon, title, text], index) => (
          <div key={title} className={`flex gap-4 p-5 sm:p-6 ${index > 0 ? "border-t border-white/10 sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 lg:border-l" : ""}`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold"><Icon className="h-5 w-5" /></span>
            <div><div className="font-semibold">{title}</div><div className="mt-1 text-xs leading-5 text-white/50">{text}</div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SmartFeatures() {
  return (
    <section id="features" className="py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionIntro eyebrow="Alles in Smart" title={<>Ein System, das dir <span className="text-gradient-gold">Arbeit abnimmt.</span></>} text="Du musst nicht jeden Tag neu überlegen, was du essen oder trainieren sollst. Smart bringt die wichtigsten Bausteine in einen klaren Ablauf." />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {smartFeatures.map((feature, index) => (
            <article key={feature.title} className="group min-h-[235px] rounded-3xl border border-white/10 bg-[#0d1210] p-6 transition duration-300 hover:-translate-y-1 hover:border-gold/35 sm:p-7">
              <div className="flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-gold/20 bg-gold/10 text-gold"><feature.icon className="h-5 w-5" /></span>
                <span className="font-display text-3xl text-white/10 transition group-hover:text-gold/30">0{index + 1}</span>
              </div>
              <h3 className="mt-7 font-display text-2xl font-bold uppercase">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/52">{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="ablauf" className="border-y border-white/10 bg-[#0a0f0c] py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionIntro eyebrow="So funktioniert Smart" title={<>Einmal einrichten.<br /><span className="text-gradient-gold">Dann einfach machen.</span></>} text="Smart soll dir nicht noch mehr Aufgaben geben. Das System nimmt dir Planung ab und bündelt deinen Alltag in einem klaren Workflow." />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step) => (
            <article key={step.n} className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d1210] p-6">
              <div className="absolute right-4 top-2 font-display text-6xl font-bold text-white/[0.06]">{step.n}</div>
              <div className="relative grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold font-display text-sm font-bold text-primary-foreground">{step.n}</div>
              <h3 className="relative mt-7 font-display text-xl font-bold uppercase leading-tight">{step.title}</h3>
              <p className="relative mt-3 text-sm leading-6 text-white/50">{step.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AppShowcase() {
  return (
    <section id="app" className="py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[.78fr_1.22fr] lg:gap-16">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Echte BodyFuel App</div>
            <h2 className="mt-4 font-display text-4xl font-bold leading-[0.98] sm:text-5xl lg:text-6xl">
              Kein Konzept.<br /><span className="text-gradient-gold">Das ist die App.</span>
            </h2>
            <p className="mt-5 max-w-xl leading-7 text-white/55">
              Plan, Tracking und Tagesübersicht laufen dort zusammen, wo du sie wirklich nutzt. Keine PDFs, keine separaten Tabellen und kein ständiges Wechseln zwischen Tools.
            </p>
            <div className="mt-8 space-y-3 text-sm text-white/75">
              <CheckLine>Trainings- und Restday-Ziele getrennt im Blick</CheckLine>
              <CheckLine>Mahlzeiten direkt aus dem Plan tracken</CheckLine>
              <CheckLine>Kalorien und Makros live sehen</CheckLine>
              <CheckLine>Training und Fortschritt im selben System</CheckLine>
            </div>
            <Link to="/trial" className="mt-8 inline-flex">
              <Button className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">Smart kostenlos testen <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <figure className="overflow-hidden rounded-3xl border border-gold/25 bg-[#0d1210] shadow-2xl sm:col-span-2">
              <img src={nutritionTrackerAsset.url} alt="BodyFuel Smart Tracking" loading="lazy" className="w-full" />
            </figure>
            <figure className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d1210]">
              <img src={nutritionMacrosAsset.url} alt="BodyFuel Smart Makros" loading="lazy" className="w-full" />
            </figure>
            <figure className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d1210]">
              <img src={nutritionPlanAsset.url} alt="BodyFuel Smart Ernährungsplan" loading="lazy" className="w-full" />
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}

function FuelySection() {
  return (
    <section className="border-y border-white/10 bg-[#0a0f0c] py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[.72fr_1.28fr] lg:px-8">
        <div className="relative mx-auto h-[270px] w-full max-w-[320px]">
          <div className="absolute inset-8 rounded-full bg-gold/12 blur-3xl" />
          <img src={fuelyMotivatedAsset.url} alt="Fuely" className="relative mx-auto h-full w-auto object-contain drop-shadow-[0_24px_50px_rgba(0,0,0,.5)]" />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Fuely ist dabei</div>
          <h2 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">Nicht nur Daten.<br /><span className="text-gradient-gold">Auch Motivation.</span></h2>
          <p className="mt-5 max-w-2xl leading-7 text-white/55">
            Fuely begleitet dich innerhalb von BodyFuel mit Erinnerungen, Motivation, Erfolgen und kleinen Impulsen. So bleibt Smart nicht nur ein Plan, sondern wird Teil deines Alltags.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <MiniBenefit icon={Target} text="Tagesziele" />
            <MiniBenefit icon={Trophy} text="Erfolge & Level" />
            <MiniBenefit icon={Flame} text="Streaks & Motivation" />
          </div>
        </div>
      </div>
    </section>
  );
}

function SmartVsCoaching() {
  return (
    <section id="vergleich" className="py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Welcher Weg passt zu dir?</div>
          <h2 className="mt-4 font-display text-4xl font-bold sm:text-5xl">Smart oder <span className="text-gradient-gold">Coaching.</span></h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-white/52">Beides basiert auf BodyFuel. Der Unterschied ist, wie viel persönliche Betreuung du möchtest.</p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <CompareCard
            name="BodyFuel Smart"
            price="14,99 €"
            kicker="Selbstständig"
            text="Für alle, die ein komplettes digitales System wollen und ihren Alltag selbstständig umsetzen möchten."
            items={["Ernährungs- & Trainingsplan", "Einkaufsliste", "Strength Check & Prognosen", "Tracking, Community & Partner-Modus", "Fuely als digitaler Begleiter"]}
            cta={<Link to="/trial"><Button size="lg" className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">7 Tage gratis testen</Button></Link>}
            highlight
          />
          <CompareCard
            name="BodyFuel Coaching"
            price="69 €"
            kicker="Persönlich"
            text="Für alle, die zusätzlich einen echten Coach für Check-ins, individuelle Anpassungen und direkten Support möchten."
            items={["Alles aus Smart", "Manu als persönlicher Coach", "Regelmäßige Check-ins", "Individuelle Plananpassungen", "Direkter Support bei Fragen"]}
            cta={<Link to="/" hash="pakete"><Button size="lg" variant="outline" className="w-full border-gold/35 bg-transparent text-white hover:bg-gold/10 hover:text-white">Coaching ansehen</Button></Link>}
          />
        </div>
      </div>
    </section>
  );
}

function SmartPrice() {
  return (
    <section className="border-y border-white/10 bg-[#0a0f0c] py-24 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2.2rem] border border-gold/35 bg-[radial-gradient(circle_at_80%_20%,rgba(45,185,91,.15),transparent_32%),#0d1210] p-7 shadow-2xl sm:p-10 lg:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_.85fr]">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">BodyFuel Smart</div>
              <h2 className="mt-4 font-display text-4xl font-bold sm:text-5xl">7 Tage testen.<br />Dann selbst entscheiden.</h2>
              <p className="mt-5 max-w-xl leading-7 text-white/55">Keine Zahlungsdaten für den Test. Keine automatische Verlängerung des Trials. Erst danach entscheidest du, ob Smart zu dir passt.</p>
              <div className="mt-7 grid gap-2 text-sm text-white/75 sm:grid-cols-2">
                <CheckLine>7 Tage kostenlos</CheckLine>
                <CheckLine>Keine Zahlungsdaten</CheckLine>
                <CheckLine>Test endet automatisch</CheckLine>
                <CheckLine>Danach 14,99 € / Monat</CheckLine>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/25 p-7 text-center">
              <div className="text-sm text-white/50">Nach dem Trial</div>
              <div className="mt-2 font-display text-6xl font-bold">14,99 €</div>
              <div className="mt-1 text-sm text-white/45">pro Monat</div>
              <Link to="/trial" className="mt-6 block">
                <Button size="lg" className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">Jetzt kostenlos starten <ArrowRight className="ml-1 h-4 w-4" /></Button>
              </Link>
              <div className="mt-3 text-[11px] text-white/40">7 Tage gratis · ohne Zahlungsdaten</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="py-24 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">FAQ</div>
          <h2 className="mt-4 font-display text-4xl font-bold sm:text-5xl">Noch Fragen zu Smart?</h2>
        </div>
        <div className="mt-10 space-y-3">
          {faqs.map((faq) => (
            <details key={faq.q} className="group rounded-2xl border border-white/10 bg-[#0d1210] p-5 open:border-gold/25 sm:p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-semibold text-white">
                {faq.q}<ChevronDown className="h-4 w-4 shrink-0 text-gold transition group-open:rotate-180" />
              </summary>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/52">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-[#0a0f0c] py-20 sm:py-24">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-[100px]" />
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
        <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">BodyFuel Smart</div>
        <h2 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">Weniger planen.<br /><span className="text-gradient-gold">Mehr umsetzen.</span></h2>
        <p className="mx-auto mt-5 max-w-2xl leading-7 text-white/55">Starte deinen 7-Tage-Test und schau dir BodyFuel Smart in deinem eigenen Alltag an.</p>
        <Link to="/trial" className="mt-8 inline-flex">
          <Button size="lg" className="bg-gradient-gold px-8 text-primary-foreground shadow-gold hover:opacity-90">7 Tage Smart gratis testen <ArrowRight className="ml-1 h-4 w-4" /></Button>
        </Link>
        <p className="mt-4 text-xs text-white/40">Ohne Zahlungsdaten · Test endet automatisch</p>
      </div>
    </section>
  );
}

function SmartFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#050806] py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <Link to="/"><BrandLogo /></Link>
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

function SectionIntro({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">{eyebrow}</div>
      <h2 className="mt-4 font-display text-4xl font-bold leading-[0.98] sm:text-5xl lg:text-6xl">{title}</h2>
      <p className="mt-5 max-w-2xl leading-7 text-white/52">{text}</p>
    </div>
  );
}

function CheckLine({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={2.5} /><span>{children}</span></div>;
}

function MiniBenefit({ icon: Icon, text }: { icon: typeof Target; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0d1210] p-4 text-sm font-medium">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold/10 text-gold"><Icon className="h-4 w-4" /></span>{text}
    </div>
  );
}

function CompareCard({ name, price, kicker, text, items, cta, highlight = false }: { name: string; price: string; kicker: string; text: string; items: string[]; cta: ReactNode; highlight?: boolean }) {
  return (
    <article className={`flex flex-col rounded-[2rem] border p-7 sm:p-8 ${highlight ? "border-gold/45 bg-[linear-gradient(180deg,rgba(45,185,91,.10),rgba(13,18,16,.9))] shadow-gold" : "border-white/10 bg-[#0d1210]"}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">{kicker}</div>
      <h3 className="mt-3 font-display text-3xl font-bold uppercase">{name}</h3>
      <div className="mt-4 flex items-end gap-2"><span className="font-display text-5xl font-bold">{price}</span><span className="mb-1.5 text-sm text-white/40">/ Monat</span></div>
      <p className="mt-5 text-sm leading-6 text-white/52">{text}</p>
      <div className="my-7 h-px bg-white/10" />
      <div className="space-y-3 text-sm text-white/75">{items.map((item) => <CheckLine key={item}>{item}</CheckLine>)}</div>
      <div className="mt-8 flex-1" />
      {cta}
    </article>
  );
}
