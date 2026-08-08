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

const systemFeatures = [
  { icon: Apple, title: "Ernährung", text: "Einfach tracken, besser essen und bewusste Entscheidungen treffen." },
  { icon: Dumbbell, title: "Training", text: "Smarte Trainingspläne, Übungen, Fortschritt und Workouts im Blick." },
  { icon: BarChart3, title: "Tracking", text: "Kalorien, Makros, Schritte und mehr — übersichtlich an einem Ort." },
  { icon: LineChart, title: "Fortschritt", text: "Sieh, was du erreichst. Daten schaffen Motivation und Klarheit." },
  { icon: Heart, title: "Motivation", text: "Gewohnheiten aufbauen, dranbleiben und deine Ziele erreichen." },
];

const faqs = [
  {
    q: "Was ist der Unterschied zwischen Smart und Coaching?",
    a: "Smart ist dein digitaler Fitness-Autopilot. Im Coaching bekommst du zusätzlich persönliche 1:1-Betreuung, Check-ins und individuelle Anpassungen durch deinen Coach.",
  },
  {
    q: "Kann ich Smart kostenlos testen?",
    a: "Ja. BodyFuel Smart kannst du 7 Tage kostenlos testen. Dafür sind keine Zahlungsdaten nötig.",
  },
  {
    q: "Brauche ich ein Fitnessstudio?",
    a: "Nein. Dein Training kann auf dein verfügbares Equipment, dein Erfahrungslevel und deine Trainingstage abgestimmt werden.",
  },
];

export function LandingPageV3() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070b09] text-foreground selection:bg-gold/30">
      <Header />
      <main>
        <Hero />
        <SignalBar />
        <SystemSection />
        <ActionSection />
        <CoachSection />
        <PricingSection />
        <FaqSection />
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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050806]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="min-w-0 shrink-0"><BrandLogo /></Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-white/70 lg:flex">
          <a href="#funktionen" className="transition hover:text-white">Funktionen</a>
          <a href="#app" className="transition hover:text-white">App</a>
          <a href="#coaching" className="transition hover:text-white">Coaching</a>
          <a href="#preise" className="transition hover:text-white">Preise</a>
          <a href="#faq" className="transition hover:text-white">FAQ</a>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/app" className="inline-flex h-9 items-center justify-center rounded-lg border border-gold/35 bg-transparent px-3 text-xs font-semibold text-white transition hover:bg-gold/10 sm:px-4 sm:text-sm">Login</Link>
          <Link to="/trial">
            <Button size="sm" className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
              <span className="hidden sm:inline">7 Tage gratis testen</span>
              <span className="sm:hidden">Gratis</span>
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
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_68%_32%,rgba(45,185,91,0.16),transparent_34%),radial-gradient(circle_at_15%_20%,rgba(45,185,91,0.06),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.11] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:min-h-[720px] lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:pb-24 lg:pt-20">
        <div className="relative z-20 max-w-xl">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-gold">Dein Begleiter für mehr Energie</div>
          <h1 className="mt-5 font-display text-[clamp(3.4rem,6.2vw,6.4rem)] font-bold leading-[0.9] tracking-[-0.035em] text-white">
            Dein Ziel.<br />Ein System.<br /><span className="text-gradient-gold">Jeden Tag.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            Ernährung, Training, Tracking und Fortschritt — alles in einer App. Für mehr Energie, Fokus und spürbare Ergebnisse.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/trial"><Button size="lg" className="w-full bg-gradient-gold px-7 text-primary-foreground shadow-gold hover:opacity-90 sm:w-auto">7 Tage gratis testen</Button></Link>
            <a href="#funktionen"><Button size="lg" variant="outline" className="w-full border-gold/45 bg-transparent px-7 text-white hover:bg-gold/10 hover:text-white sm:w-auto">Mehr erfahren <ArrowRight className="ml-1 h-4 w-4" /></Button></a>
          </div>
          <RatingBadge />
        </div>
        <PhoneHero />
      </div>
    </section>
  );
}

function RatingBadge() {
  return (
    <div className="mt-8 flex items-center gap-3">
      <div className="flex -space-x-2">
        {["B", "F", "S", "C"].map((letter, index) => <span key={`${letter}-${index}`} className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#070b09] bg-[#16201a] text-[10px] font-bold text-white">{letter}</span>)}
      </div>
      <div>
        <div className="flex gap-0.5 text-sm text-[#f4b83f]" aria-hidden="true"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>
        <div className="mt-0.5 text-xs text-white/60"><span className="font-semibold text-white">4,8/5</span> aus 50+ Bewertungen</div>
      </div>
    </div>
  );
}

function PhoneHero() {
  return (
    <div className="relative mx-auto min-h-[500px] w-full max-w-[760px] lg:min-h-[590px]">
      <div className="absolute inset-x-[6%] top-[7%] h-[70%] rounded-full bg-gold/10 blur-[90px]" />
      <PhoneShot src={appDashboardAsset.url} alt="BodyFuel App Dashboard" className="left-[3%] top-[12%] z-10 -rotate-[4deg] sm:left-[7%]" />
      <PhoneShot src={nutritionPlanAsset.url} alt="BodyFuel Ernährungsplan" className="left-1/2 top-[4%] z-20 -translate-x-1/2 rotate-[1deg]" />
      <PhoneShot src={nutritionTrackerAsset.url} alt="BodyFuel Ernährungstracking" className="right-[2%] top-[13%] z-10 rotate-[4deg] sm:right-[5%]" />
      <img src={fuelyHappyAsset.url} alt="Fuely, der BodyFuel Begleiter" className="absolute bottom-[-2%] right-[0%] z-30 h-[150px] w-auto drop-shadow-[0_20px_35px_rgba(0,0,0,0.55)] sm:h-[190px] lg:h-[220px]" />
    </div>
  );
}

function PhoneShot({ src, alt, className }: { src: string; alt: string; className: string }) {
  return (
    <div className={`absolute w-[38%] max-w-[245px] ${className}`}>
      <div className="rounded-[2rem] border border-white/20 bg-black p-[7px] shadow-[0_30px_80px_rgba(0,0,0,0.58)] sm:rounded-[2.4rem] sm:p-[9px]">
        <div className="overflow-hidden rounded-[1.55rem] bg-[#090d0b] sm:rounded-[1.9rem]"><img src={src} alt={alt} className="block h-auto w-full" /></div>
      </div>
    </div>
  );
}

function SignalBar() {
  const items = [
    { icon: Zap, title: "Smart", text: "Intelligent. Automatisch. Effektiv." },
    { icon: Users, title: "Coaching", text: "Persönliche Betreuung inklusive." },
    { icon: Target, title: "7 Tage gratis", text: "Teste BodyFuel ohne Risiko." },
    { icon: Phone, title: "Alles in einer App", text: "Ernährung, Training, Tracking, Fortschritt & Motivation." },
  ];
  return (
    <section className="relative z-30 -mt-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d1210]/95 shadow-2xl backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => (
          <div key={item.title} className={`flex gap-4 p-5 sm:p-6 ${index > 0 ? "border-t border-white/10 sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 lg:border-l" : ""}`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold"><item.icon className="h-5 w-5" /></span>
            <div><h3 className="font-semibold text-white">{item.title}</h3><p className="mt-1 text-xs leading-5 text-white/55">{item.text}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SystemSection() {
  return (
    <section id="funktionen" className="py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <h2 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl">Dein System. <span className="text-gradient-gold">Deine Ergebnisse.</span></h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">BodyFuel verbindet die Dinge, die deinen Fortschritt bestimmen — klar, messbar und ohne Tool-Chaos.</p>
          </div>
          <div className="relative hidden min-w-[300px] rounded-2xl border border-gold/30 bg-gold/5 p-5 lg:block">
            <img src={fuelyMotivatedAsset.url} alt="Fuely" className="absolute bottom-0 left-2 h-32 w-auto" />
            <div className="ml-28"><div className="font-semibold text-white">Hi, ich bin Fuely! 👋</div><p className="mt-2 text-xs leading-5 text-white/55">Dein Daily Coach in der App. Ich erinnere dich, motiviere dich und feiere deine Erfolge mit dir.</p><Link to="/trial" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gold">Fuely kennenlernen <ArrowRight className="h-3 w-3" /></Link></div>
          </div>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
          {systemFeatures.map((feature) => <article key={feature.title} className="bg-[#090d0b] p-6 transition hover:bg-[#0e1511]"><feature.icon className="h-7 w-7 text-gold" /><h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3><p className="mt-2 text-xs leading-5 text-white/55">{feature.text}</p></article>)}
        </div>
      </div>
    </section>
  );
}

function ActionSection() {
  const shots = [
    { src: appDashboardAsset.url, eyebrow: "HEUTIGES TRAINING", title: "Dashboard & Training" },
    { src: nutritionTrackerAsset.url, eyebrow: "ERNÄHRUNG", title: "Essen tracken" },
    { src: nutritionMacrosAsset.url, eyebrow: "TAGESZIELE", title: "Kalorien & Makros" },
    { src: nutritionPlanAsset.url, eyebrow: "DEIN PLAN", title: "Mahlzeiten im Blick" },
  ];
  return (
    <section id="app" className="border-y border-white/10 bg-[#090d0b] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Echte Einblicke</div><h2 className="mt-3 font-display text-4xl font-bold text-white sm:text-5xl">BodyFuel in Action</h2></div>
          <p className="max-w-lg text-sm leading-6 text-white/50">Keine generierten Produktbilder — echte Screenshots aus der BodyFuel App.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shots.map((shot) => <figure key={shot.title} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#0d1210] transition hover:-translate-y-1 hover:border-gold/35"><div className="border-b border-white/10 px-4 py-4"><div className="text-[9px] font-bold uppercase tracking-[0.18em] text-gold">{shot.eyebrow}</div><div className="mt-1 font-display text-xl font-bold text-white">{shot.title}</div></div><div className="max-h-[470px] overflow-hidden"><img src={shot.src} alt={shot.title} loading="lazy" className="w-full transition duration-500 group-hover:scale-[1.02]" /></div></figure>)}
        </div>
      </div>
    </section>
  );
}

function CoachSection() {
  return (
    <section id="coaching" className="py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-8">
        <div className="relative mx-auto w-full max-w-md lg:mx-0"><div className="absolute -inset-8 rounded-full bg-gold/10 blur-3xl" /><div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1210]"><img src={manuCoachAsset.url} alt="Manu, Head Coach von BodyFuel" loading="lazy" className="aspect-[4/5] w-full object-cover" /><div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-black/65 p-4 backdrop-blur-lg"><div className="font-display text-xl font-bold text-white">MANU</div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Head Coach · BodyFuel</div></div></div></div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">BodyFuel Coaching</div>
          <h2 className="mt-4 font-display text-4xl font-bold leading-[1.02] text-white sm:text-5xl lg:text-6xl">App im Rücken.<br /><span className="text-gradient-gold">Coach an deiner Seite.</span></h2>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/55">Du willst nicht nur ein System, sondern persönliche Führung? Im Coaching werden Ernährung und Training individuell begleitet und laufend an deinen Fortschritt angepasst.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[{ icon: MessageCircle, text: "Direkter persönlicher Support" },{ icon: ClipboardList, text: "Wöchentliche Check-ins" },{ icon: Dumbbell, text: "Individuelle Plananpassungen" },{ icon: ShieldCheck, text: "Klare Führung & Feedback" }].map((item) => <div key={item.text} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-white/80"><item.icon className="h-4 w-4 shrink-0 text-gold" />{item.text}</div>)}
          </div>
          <a href="#kontakt" className="mt-8 inline-flex"><Button className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">Coaching anfragen <ArrowRight className="ml-1 h-4 w-4" /></Button></a>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const { openCheckout, checkoutElement, isOpen } = useStripeCheckout();
  const checkoutRef = useRef<HTMLDivElement>(null);
  const handleBuy = (priceId: string) => {
    openCheckout({ priceId, returnUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}` });
    window.setTimeout(() => checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  return (
    <section id="preise" className="border-y border-white/10 bg-[#090d0b] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center"><div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Wähle deinen Weg</div><h2 className="mt-4 font-display text-4xl font-bold text-white sm:text-5xl">Smart oder <span className="text-gradient-gold">Coaching.</span></h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">Dasselbe BodyFuel Fundament — selbstständig mit Smart oder mit persönlicher Begleitung im Coaching.</p></div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          {PACKAGES.map((pkg) => <article key={pkg.key} className={`relative flex flex-col rounded-2xl border p-7 sm:p-8 ${pkg.popular ? "border-gold/50 bg-gradient-to-b from-gold/10 to-[#0d1210] shadow-gold" : "border-white/10 bg-[#0d1210]"}`}>{pkg.popular && <span className="absolute right-5 top-5 rounded-full bg-gradient-gold px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-primary-foreground">Persönlich</span>}<div className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{pkg.name}</div><p className="mt-3 text-sm text-white/50">{pkg.tagline}</p><div className="mt-7 flex items-end gap-2"><span className="font-display text-5xl font-bold text-white">{String(pkg.price).replace(".", ",")} €</span><span className="mb-1.5 text-sm text-white/45">/ Monat</span></div><div className="my-7 h-px bg-white/10" /><ul className="space-y-3">{pkg.features.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-white/75"><Check className="mt-1 h-4 w-4 shrink-0 text-gold" strokeWidth={2.5} />{feature}</li>)}</ul><div className="mt-8 flex-1" />{pkg.key === "smart" ? <Link to="/trial"><Button size="lg" className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">7 Tage gratis testen <ArrowRight className="ml-1 h-4 w-4" /></Button></Link> : <Button size="lg" onClick={() => handleBuy(pkg.priceId)} className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">Coaching buchen <ArrowRight className="ml-1 h-4 w-4" /></Button>}</article>)}
        </div>
        <div ref={checkoutRef} className={isOpen ? "mt-8 scroll-mt-24 overflow-hidden rounded-2xl bg-background" : ""}>{checkoutElement}</div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-white/40">Alle Preise gemäß § 19 UStG (Kleinunternehmerregelung). Es wird keine Umsatzsteuer ausgewiesen.</p>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="py-24 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center"><div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">FAQ</div><h2 className="mt-4 font-display text-4xl font-bold text-white sm:text-5xl">Noch Fragen?</h2></div>
        <div className="mt-10 space-y-3">{faqs.map((faq) => <details key={faq.q} className="group rounded-2xl border border-white/10 bg-[#0d1210] p-5 open:border-gold/30"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white">{faq.q}<ChevronDown className="h-4 w-4 shrink-0 text-gold transition group-open:rotate-180" /></summary><p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">{faq.a}</p></details>)}</div>
      </div>
    </section>
  );
}

function ContactSection() {
  const submitLeadFn = useServerFn(submitLead);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", goal: "", current_weight: "", desired_package: "" as "" | "smart" | "coaching" | "unsure", message: "" });
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name || !form.email) { toast.error("Bitte fülle mindestens Name und E-Mail aus."); return; }
    setSubmitting(true);
    try {
      await submitLeadFn({ data: { name: form.name, email: form.email, phone: form.phone || undefined, goal: form.goal || undefined, current_weight: form.current_weight || undefined, desired_package: form.desired_package || undefined, message: form.message || undefined } });
      setDone(true);
      setForm({ name: "", email: "", phone: "", goal: "", current_weight: "", desired_package: "", message: "" });
    } catch (error) { toast.error((error as Error).message || "Senden fehlgeschlagen."); } finally { setSubmitting(false); }
  };
  return (
    <section id="kontakt" className="border-t border-white/10 bg-[#090d0b] py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20 lg:px-8">
        <div className="relative"><div className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Persönlich sprechen</div><h2 className="mt-4 font-display text-4xl font-bold leading-[1.02] text-white sm:text-5xl">Bereit für deinen<br /><span className="text-gradient-gold">nächsten Schritt?</span></h2><p className="mt-5 max-w-lg text-sm leading-7 text-white/55 sm:text-base">Du bist noch unsicher, welches BodyFuel Paket zu dir passt? Schick kurz deine Eckdaten — die Anfrage ist unverbindlich.</p><div className="mt-8 space-y-3 text-sm text-white/60"><div className="flex items-center gap-3"><Check className="h-4 w-4 text-gold" /> Ziel und Ausgangslage klären</div><div className="flex items-center gap-3"><Check className="h-4 w-4 text-gold" /> Passendes Paket einordnen</div><div className="flex items-center gap-3"><Check className="h-4 w-4 text-gold" /> Unverbindliche Anfrage</div></div><img src={fuelyHappyAsset.url} alt="Fuely" className="mt-8 h-44 w-auto lg:absolute lg:bottom-[-35px] lg:right-0 lg:mt-0" /></div>
        {done ? <div className="grid min-h-[430px] place-items-center rounded-2xl border border-gold/30 bg-gold/5 p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-gold"><Check className="h-6 w-6 text-primary-foreground" /></span><h3 className="mt-5 font-display text-3xl font-bold text-white">Anfrage ist raus.</h3><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/50">Danke dir. Deine Angaben wurden übermittelt.</p><Button variant="outline" className="mt-6 border-white/15 bg-transparent text-white hover:bg-white/5" onClick={() => setDone(false)}>Weitere Anfrage</Button></div></div> : <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-[#0d1210] p-6 sm:p-8"><div className="grid gap-5 sm:grid-cols-2"><Field label="Name *" htmlFor="name"><Input id="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Dein Name" /></Field><Field label="E-Mail *" htmlFor="email"><Input id="email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@beispiel.de" /></Field><Field label="Telefon" htmlFor="phone"><Input id="phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+49 …" /></Field><Field label="Aktuelles Gewicht" htmlFor="weight"><Input id="weight" value={form.current_weight} onChange={(event) => setForm({ ...form, current_weight: event.target.value })} placeholder="z. B. 82 kg" /></Field><Field label="Dein Ziel" htmlFor="goal"><Select value={form.goal} onValueChange={(value) => setForm({ ...form, goal: value })}><SelectTrigger id="goal"><SelectValue placeholder="Ziel auswählen" /></SelectTrigger><SelectContent><SelectItem value="abnehmen">Abnehmen</SelectItem><SelectItem value="muskelaufbau">Muskelaufbau</SelectItem><SelectItem value="koerperform">Körperform verbessern</SelectItem><SelectItem value="ernaehrung">Ernährung strukturieren</SelectItem><SelectItem value="sonstiges">Sonstiges</SelectItem></SelectContent></Select></Field><Field label="Wunschpaket" htmlFor="pkg"><Select value={form.desired_package} onValueChange={(value) => setForm({ ...form, desired_package: value as typeof form.desired_package })}><SelectTrigger id="pkg"><SelectValue placeholder="Noch unsicher? Auch okay." /></SelectTrigger><SelectContent><SelectItem value="smart">BodyFuel Smart (14,99 €)</SelectItem><SelectItem value="coaching">BodyFuel Coaching (69 €)</SelectItem><SelectItem value="unsure">Noch unsicher</SelectItem></SelectContent></Select></Field></div><div className="mt-5"><Field label="Nachricht" htmlFor="message"><Textarea id="message" rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Erzähl kurz, wo du gerade stehst …" /></Field></div><Button type="submit" disabled={submitting} size="lg" className="mt-6 w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">{submitting ? "Wird gesendet …" : "Unverbindlich anfragen"}{!submitting && <ArrowRight className="ml-1 h-4 w-4" />}</Button></form>}
      </div>
    </section>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={htmlFor} className="text-white/75">{label}</Label>{children}</div>;
}

function Footer() {
  const { openSettings } = useConsent();
  return (
    <footer className="border-t border-white/10 bg-[#050806] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]"><div><BrandLogo /><p className="mt-4 max-w-sm text-sm leading-6 text-white/45">Ernährung, Training und Fortschritt in einem klaren System.</p></div><FooterCol title="BodyFuel"><a href="#funktionen">Funktionen</a><a href="#app">App</a><a href="#preise">Preise</a><Link to="/app">Login</Link></FooterCol><FooterCol title="Kontakt & Rechtliches"><a href="mailto:info@bodyfuel-coaching.com" className="inline-flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> info@bodyfuel-coaching.com</a><a href="https://instagram.com/bodyfuel_coaching" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2"><Instagram className="h-3.5 w-3.5" /> @bodyfuel_coaching</a><Link to="/impressum">Impressum</Link><Link to="/datenschutz">Datenschutz</Link><button onClick={openSettings} className="text-left">Cookie-Einstellungen</button></FooterCol></div>
        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/35">© {new Date().getFullYear()} BODYFUEL Nutrition Coaching.</div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return <div><div className="font-display text-sm font-bold uppercase tracking-[0.12em] text-white">{title}</div><div className="mt-4 flex flex-col gap-2.5 text-sm text-white/45 [&_a:hover]:text-white [&_button:hover]:text-white">{children}</div></div>;
}
