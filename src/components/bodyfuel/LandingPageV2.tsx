import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  Apple,
  ArrowRight,
  Check,
  ClipboardList,
  Dumbbell,
  Flame,
  Heart,
  Instagram,
  LineChart,
  Mail,
  Phone,
  Salad,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import appDashboardAsset from "@/assets/app-dashboard.png.asset.json";
import nutritionPlanAsset from "@/assets/nutrition-plan.jpeg.asset.json";
import nutritionMacrosAsset from "@/assets/nutrition-macros.jpeg.asset.json";
import nutritionTrackerAsset from "@/assets/nutrition-tracker.jpeg.asset.json";
import manuCoachAsset from "@/assets/manu-coach.png.asset.json";
import { Logo } from "@/components/bodyfuel/Logo";
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
import { submitLead } from "@/lib/coaching.functions";
import { useConsent } from "@/lib/consent";
import { PACKAGES } from "@/lib/bodyfuel/packages";
import { supabase } from "@/integrations/supabase/client";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { toast } from "sonner";

type Review = {
  quote: string;
  name: string;
  rating: number;
};

const coreFeatures = [
  {
    icon: Salad,
    title: "Ernährung, die in deinen Alltag passt",
    text: "Plan, Kalorien, Makros und Mahlzeiten direkt in der App — ohne PDF-Chaos und ohne tägliches Rätselraten.",
  },
  {
    icon: Dumbbell,
    title: "Training mit nachvollziehbarem Fortschritt",
    text: "Übungen, Sätze, Gewichte und Entwicklung an einem Ort. Du siehst, was funktioniert und wo du stärker wirst.",
  },
  {
    icon: LineChart,
    title: "Fortschritt statt Bauchgefühl",
    text: "Gewicht, Gewohnheiten, Streaks und Leistung werden sichtbar. So wird aus einzelnen Tagen ein belastbarer Trend.",
  },
  {
    icon: Trophy,
    title: "Konstanz, die sich gut anfühlt",
    text: "Punkte, Level und klare Tagesziele geben dir Struktur, ohne dass Fitness zum Vollzeitjob werden muss.",
  },
];

const steps = [
  {
    n: "01",
    icon: Target,
    title: "Ziel festlegen",
    text: "Du definierst dein Ziel, deinen Alltag und die Rahmenbedingungen, die wirklich berücksichtigt werden müssen.",
  },
  {
    n: "02",
    icon: ClipboardList,
    title: "System bekommen",
    text: "BodyFuel verbindet Ernährung, Training und Tracking in einem klaren Ablauf statt in mehreren Insellösungen.",
  },
  {
    n: "03",
    icon: Activity,
    title: "Messen & anpassen",
    text: "Du arbeitest mit echten Daten, erkennst Fortschritt schneller und kannst deine nächsten Schritte gezielt ableiten.",
  },
];

export function LandingPageV2() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-gold/30">
      <Header />
      <main>
        <Hero />
        <SignalBar />
        <CoreSystem />
        <AppShowcase />
        <Process />
        <Reviews />
        <Coach />
        <Pricing />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0">
          <span className="sm:hidden"><Logo compact /></span>
          <span className="hidden sm:block"><Logo /></span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground lg:flex">
          <a className="transition hover:text-foreground" href="#system">System</a>
          <a className="transition hover:text-foreground" href="#app">App</a>
          <a className="transition hover:text-foreground" href="#coach">Coaching</a>
          <a className="transition hover:text-foreground" href="#pakete">Pakete</a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/app"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card/60 px-3 text-xs font-semibold transition hover:border-gold/40 hover:bg-card sm:px-4 sm:text-sm"
          >
            Login
          </Link>
          <Link to="/trial">
            <Button size="sm" className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
              <span className="hidden sm:inline">Smart gratis testen</span>
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
    <section className="relative isolate overflow-hidden border-b border-border/50">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-8rem] h-[36rem] w-[36rem] rounded-full bg-gold/12 blur-[110px]" />
        <div className="absolute right-[-8rem] top-[14rem] h-[28rem] w-[28rem] rounded-full bg-gold/8 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.08]" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:min-h-[760px] lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <Eyebrow><Sparkles className="h-3.5 w-3.5" /> Ernährung · Training · Fortschritt</Eyebrow>
          <h1 className="mt-6 font-display text-[clamp(3rem,7vw,6.7rem)] font-bold uppercase leading-[0.9] tracking-[-0.025em]">
            Dein Ziel.
            <span className="mt-1 block text-gradient-gold">Ein System.</span>
            <span className="mt-1 block text-foreground/95">Jeden Tag.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            BodyFuel verbindet Ernährungsplanung, Training, Tracking und Motivation in einer App.
            Nutze Smart selbstständig oder hol dir mit Coaching persönliche 1:1-Begleitung dazu.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/trial">
              <Button size="lg" className="w-full bg-gradient-gold px-6 text-primary-foreground shadow-gold hover:opacity-90 sm:w-auto">
                7 Tage Smart gratis testen
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <a href="#pakete">
              <Button size="lg" variant="outline" className="w-full border-border bg-card/40 px-6 hover:border-gold/40 hover:bg-card sm:w-auto">
                Pakete vergleichen
              </Button>
            </a>
          </div>

          <div className="mt-9 grid max-w-2xl grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <TrustItem icon={ShieldCheck}>Ohne Zahlungsdaten testen</TrustItem>
            <TrustItem icon={Zap}>Smart ab 14,99 €</TrustItem>
            <TrustItem icon={Users}>Coaching 69 €</TrustItem>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[580px] lg:ml-auto">
          <div className="absolute -inset-10 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-gold/25 bg-card/70 p-2 shadow-2xl backdrop-blur sm:p-3">
            <div className="overflow-hidden rounded-[1.45rem] border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-gold shadow-gold" /> Live in BodyFuel
                </div>
                <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gold">Dashboard</span>
              </div>
              <img
                src={appDashboardAsset.url}
                alt="BodyFuel App Dashboard"
                className="block h-auto w-full"
              />
            </div>
          </div>

          <div className="absolute -bottom-5 -left-2 hidden rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur sm:block lg:-left-10">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold"><Apple className="h-5 w-5" /></span>
              <div>
                <div className="text-xs text-muted-foreground">Alles verbunden</div>
                <div className="font-display text-base font-bold">ERNÄHRUNG · TRAINING · TRACKING</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SignalBar() {
  const items = [
    ["SMART", "14,99 € / Monat"],
    ["COACHING", "69 € / Monat"],
    ["TRIAL", "7 Tage kostenlos"],
    ["PLATTFORM", "Eine App statt fünf Tools"],
  ];
  return (
    <section className="border-b border-border/60 bg-card/25">
      <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-border/60 px-4 sm:px-6 lg:grid-cols-4 lg:divide-y-0 lg:px-8">
        {items.map(([label, value]) => (
          <div key={label} className="px-4 py-5 first:pl-0 sm:px-6 lg:py-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">{label}</div>
            <div className="mt-1 text-sm font-semibold text-foreground/90 sm:text-base">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoreSystem() {
  return (
    <section id="system" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Eyebrow>Das BodyFuel System</Eyebrow>
            <h2 className="mt-5 font-display text-4xl font-bold uppercase leading-[0.98] sm:text-5xl lg:text-6xl">
              Weniger Chaos.<br /><span className="text-gradient-gold">Mehr Klarheit.</span>
            </h2>
            <p className="mt-5 max-w-lg leading-7 text-muted-foreground">
              BodyFuel ist nicht nur ein Plan. Die entscheidenden Bausteine deines Fortschritts laufen in einem gemeinsamen System zusammen.
            </p>
            <a href="#app" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-gold transition hover:gap-3">
              App ansehen <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {coreFeatures.map((feature, index) => (
              <article
                key={feature.title}
                className="group min-h-[250px] rounded-3xl border border-border bg-card/45 p-6 transition duration-300 hover:-translate-y-1 hover:border-gold/35 hover:bg-card/70 sm:p-7"
              >
                <div className="flex items-start justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
                    <feature.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-3xl text-border transition group-hover:text-gold/35">0{index + 1}</span>
                </div>
                <h3 className="mt-8 font-display text-2xl font-bold uppercase leading-tight">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AppShowcase() {
  const bullets = [
    "Ernährungsplan direkt in der App",
    "Trainingstag und Restday getrennt steuerbar",
    "Mahlzeiten mit wenigen Klicks tracken",
    "Tagesbilanz für Kalorien und Makros",
  ];

  return (
    <section id="app" className="relative overflow-hidden border-y border-border/60 bg-card/25 py-24 sm:py-32">
      <div className="pointer-events-none absolute right-[-10rem] top-0 h-[34rem] w-[34rem] rounded-full bg-gold/8 blur-[110px]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[.9fr_1.1fr] lg:gap-20">
          <div>
            <Eyebrow><Zap className="h-3.5 w-3.5" /> Echte App. Echter Workflow.</Eyebrow>
            <h2 className="mt-5 font-display text-4xl font-bold uppercase leading-[0.98] sm:text-5xl lg:text-6xl">
              Dein Alltag<br /><span className="text-gradient-gold">auf einen Blick.</span>
            </h2>
            <p className="mt-5 max-w-xl leading-7 text-muted-foreground">
              Keine zusammengewürfelten PDFs und Tabellen. Planen, durchführen und auswerten passiert dort, wo du es täglich brauchst.
            </p>
            <ul className="mt-8 space-y-3">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-sm text-foreground/90">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-gold">
                    <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
            <Link to="/trial" className="mt-8 inline-flex">
              <Button className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
                Smart kostenlos ausprobieren <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <figure className="overflow-hidden rounded-3xl border border-gold/25 bg-background shadow-2xl sm:col-span-2">
              <img src={nutritionTrackerAsset.url} alt="BodyFuel Ernährungstracking" loading="lazy" className="w-full" />
              <figcaption className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Tagesbilanz · Kalorien · Makros · Tracking</figcaption>
            </figure>
            <figure className="overflow-hidden rounded-3xl border border-border bg-background">
              <img src={nutritionMacrosAsset.url} alt="BodyFuel Makroziele" loading="lazy" className="w-full" />
              <figcaption className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Makroziele</figcaption>
            </figure>
            <figure className="overflow-hidden rounded-3xl border border-border bg-background">
              <img src={nutritionPlanAsset.url} alt="BodyFuel Ernährungsplan" loading="lazy" className="w-full" />
              <figcaption className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Ernährungsplan</figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}

function Process() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Eyebrow>So funktioniert es</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-bold uppercase leading-[0.98] sm:text-5xl lg:text-6xl">
            Vom Ziel zum<br /><span className="text-gradient-gold">klaren nächsten Schritt.</span>
          </h2>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {steps.map((step) => (
            <article key={step.n} className="relative overflow-hidden rounded-3xl border border-border bg-card/45 p-7 sm:p-8">
              <div className="absolute right-5 top-3 font-display text-7xl font-bold text-border/45">{step.n}</div>
              <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold">
                <step.icon className="h-5 w-5" />
              </span>
              <h3 className="relative mt-10 font-display text-2xl font-bold uppercase">{step.title}</h3>
              <p className="relative mt-3 text-sm leading-6 text-muted-foreground">{step.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("public_app_reviews" as any)
        .select("rating, comment, first_name")
        .not("comment", "is", null)
        .order("created_at", { ascending: false })
        .limit(3);

      const liveReviews = (data ?? [])
        .filter((review: any) => review.comment && review.first_name)
        .map((review: any) => ({
          quote: review.comment as string,
          name: review.first_name as string,
          rating: review.rating as number,
        }));
      setReviews(liveReviews);
    })();
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section className="border-y border-border/60 bg-card/25 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <Eyebrow>Aus der BodyFuel App</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-bold uppercase sm:text-5xl">Was Nutzer sagen.</h2>
          </div>
          <div className="text-sm text-muted-foreground">Nur veröffentlichte App-Bewertungen.</div>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {reviews.map((review, index) => (
            <article key={`${review.name}-${index}`} className="rounded-3xl border border-border bg-background/60 p-6">
              <div className="flex gap-1 text-gold" aria-label={`${review.rating} von 5 Sternen`}>
                {Array.from({ length: Math.min(5, Math.max(0, review.rating)) }).map((_, star) => (
                  <span key={star}>★</span>
                ))}
              </div>
              <p className="mt-5 text-sm leading-7 text-foreground/90">„{review.quote}“</p>
              <div className="mt-6 border-t border-border pt-4 text-sm font-semibold">{review.name}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Coach() {
  return (
    <section id="coach" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-20">
          <div className="relative mx-auto w-full max-w-md lg:mx-0">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-gold/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card">
              <img src={manuCoachAsset.url} alt="Manu, BodyFuel Coach" loading="lazy" className="aspect-[4/5] w-full object-cover" />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-background/80 p-4 backdrop-blur-xl">
                <div className="font-display text-xl font-bold uppercase">Manu</div>
                <div className="mt-0.5 text-xs font-bold uppercase tracking-[0.16em] text-gold">Head Coach · Essen</div>
              </div>
            </div>
          </div>

          <div>
            <Eyebrow><Users className="h-3.5 w-3.5" /> BodyFuel Coaching</Eyebrow>
            <h2 className="mt-5 font-display text-4xl font-bold uppercase leading-[0.98] sm:text-5xl lg:text-6xl">
              Technik ist stark.<br /><span className="text-gradient-gold">Persönliche Führung stärker.</span>
            </h2>
            <p className="mt-6 max-w-2xl leading-7 text-muted-foreground">
              Wenn du nicht nur ein System, sondern persönliche Begleitung möchtest, kommt beim Coaching Manu dazu. Pläne, Check-ins und Anpassungen werden individuell mit dir gesteuert.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                [Heart, "Persönliche 1:1 Betreuung"],
                [ClipboardList, "Wöchentliche Check-ins"],
                [Dumbbell, "Individuelle Plananpassungen"],
                [Phone, "Direkter Support bei Fragen"],
              ].map(([Icon, label]) => {
                const FeatureIcon = Icon as typeof Heart;
                return (
                  <div key={label as string} className="flex items-center gap-3 rounded-2xl border border-border bg-card/45 p-4 text-sm font-medium">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold"><FeatureIcon className="h-4 w-4" /></span>
                    {label as string}
                  </div>
                );
              })}
            </div>
            <a href="#kontakt" className="mt-8 inline-flex">
              <Button variant="outline" className="border-gold/35 bg-gold/5 hover:bg-gold/10">
                Coaching kennenlernen <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
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
    <section id="pakete" className="relative overflow-hidden border-y border-border/60 bg-card/25 py-24 sm:py-32">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-gold/8 blur-[110px]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Eyebrow center>Wähle deinen Weg</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-bold uppercase sm:text-5xl lg:text-6xl">Smart oder <span className="text-gradient-gold">Coaching.</span></h2>
          <p className="mx-auto mt-5 max-w-2xl leading-7 text-muted-foreground">
            Dasselbe BodyFuel Fundament — entweder selbstständig mit Smart oder mit persönlicher Betreuung im Coaching.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          {PACKAGES.map((pkg) => (
            <article
              key={pkg.key}
              className={`relative flex flex-col rounded-[2rem] border p-7 sm:p-8 ${pkg.popular ? "border-gold/50 bg-gradient-to-b from-gold/10 to-card/50 shadow-gold" : "border-border bg-background/55"}`}
            >
              {pkg.popular && (
                <span className="absolute right-5 top-5 rounded-full bg-gradient-gold px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground">Persönlich</span>
              )}
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{pkg.name}</div>
              <div className="mt-3 text-sm text-muted-foreground">{pkg.tagline}</div>
              <div className="mt-7 flex items-end gap-2">
                <span className="font-display text-5xl font-bold">{String(pkg.price).replace(".", ",")} €</span>
                <span className="mb-1.5 text-sm text-muted-foreground">/ Monat</span>
              </div>
              <div className="my-7 h-px bg-border" />
              <ul className="space-y-3">
                {pkg.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-foreground/90">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-gold" strokeWidth={2.5} />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex-1" />
              {pkg.key === "smart" ? (
                <Link to="/trial">
                  <Button size="lg" className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
                    7 Tage gratis testen <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  size="lg"
                  onClick={() => handleBuy(pkg.priceId)}
                  className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
                >
                  Coaching buchen <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </article>
          ))}
        </div>

        <div ref={checkoutRef} className={isOpen ? "mt-8 scroll-mt-24 overflow-hidden rounded-2xl bg-background" : ""}>
          {checkoutElement}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-muted-foreground">
          Alle Preise gemäß § 19 UStG (Kleinunternehmerregelung). Es wird keine Umsatzsteuer ausgewiesen.
        </p>
      </div>
    </section>
  );
}

function Contact() {
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
    <section id="kontakt" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
          <div>
            <Eyebrow>Persönliches Coaching</Eyebrow>
            <h2 className="mt-5 font-display text-4xl font-bold uppercase leading-[0.98] sm:text-5xl lg:text-6xl">
              Noch unsicher?<br /><span className="text-gradient-gold">Sprich mit Manu.</span>
            </h2>
            <p className="mt-5 max-w-lg leading-7 text-muted-foreground">
              Wenn du wissen willst, ob Coaching zu deinem Ziel passt, schick kurz deine Eckdaten. Die Anfrage ist unverbindlich.
            </p>
            <div className="mt-8 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-3"><Check className="h-4 w-4 text-gold" /> Ziel und Ausgangslage klären</div>
              <div className="flex items-center gap-3"><Check className="h-4 w-4 text-gold" /> Passendes Paket einordnen</div>
              <div className="flex items-center gap-3"><Check className="h-4 w-4 text-gold" /> Kein Kauf über das Formular</div>
            </div>
          </div>

          {done ? (
            <div className="grid min-h-[420px] place-items-center rounded-[2rem] border border-gold/35 bg-gold/5 p-8 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-gold shadow-gold"><Check className="h-6 w-6 text-primary-foreground" /></span>
                <h3 className="mt-5 font-display text-3xl font-bold uppercase">Anfrage ist raus.</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Danke dir. Deine Angaben wurden übermittelt.</p>
                <Button variant="outline" className="mt-6" onClick={() => setDone(false)}>Weitere Anfrage</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="rounded-[2rem] border border-border bg-card/45 p-6 sm:p-8">
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
      </div>
    </section>
  );
}

function Footer() {
  const { openSettings } = useConsent();
  return (
    <footer className="border-t border-border bg-card/20 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Ernährung, Training und Fortschritt in einem klaren System.</p>
          </div>
          <FooterCol title="BodyFuel">
            <a href="#system" className="hover:text-foreground">System</a>
            <a href="#app" className="hover:text-foreground">App</a>
            <a href="#pakete" className="hover:text-foreground">Pakete</a>
            <Link to="/app" className="hover:text-foreground">Login</Link>
          </FooterCol>
          <FooterCol title="Kontakt & Rechtliches">
            <a href="mailto:info@bodyfuel-coaching.com" className="inline-flex items-center gap-2 hover:text-foreground"><Mail className="h-3.5 w-3.5" /> info@bodyfuel-coaching.com</a>
            <a href="https://instagram.com/bodyfuel_coaching" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-foreground"><Instagram className="h-3.5 w-3.5" /> @bodyfuel_coaching</a>
            <Link to="/impressum" className="hover:text-foreground">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-foreground">Datenschutz</Link>
            <button onClick={openSettings} className="text-left hover:text-foreground">Cookie-Einstellungen</button>
          </FooterCol>
        </div>
        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">© {new Date().getFullYear()} BODYFUEL Nutrition Coaching.</div>
      </div>
    </footer>
  );
}

function Eyebrow({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gold ${center ? "mx-auto" : ""}`}>
      {children}
    </div>
  );
}

function TrustItem({ icon: Icon, children }: { icon: typeof ShieldCheck; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/8 text-gold"><Icon className="h-4 w-4" /></span>
      <span>{children}</span>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="font-display text-sm font-bold uppercase tracking-[0.12em]">{title}</div>
      <div className="mt-4 flex flex-col gap-2.5 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
