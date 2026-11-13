import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, ClipboardList, Dumbbell, Instagram, Mail, Menu, MessageCircle, ShieldCheck, Utensils, X } from "lucide-react";
import heroImage from "@/assets/bodyfuel-everyday-training.jpg";
import bodyfuelLogoAsset from "@/assets/bodyfuel-coaching-logo.png.asset.json";
import fuelyHappyAsset from "@/assets/fuely-happy.png.asset.json";
import nutritionPlanAsset from "@/assets/nutrition-plan.jpeg.asset.json";
import nutritionTrackerAsset from "@/assets/nutrition-tracker.jpeg.asset.json";
import manuCoachAsset from "@/assets/manu-coach.png.asset.json";
import { Button } from "@/components/ui/button";
import { GuideTeasers } from "@/components/ratgeber/GuidePages";
import { LandingReviews } from "./LandingReviews";
import { LandingTrainingPreview } from "./LandingTrainingPreview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { PACKAGES } from "@/lib/bodyfuel/packages";
import { submitLead } from "@/lib/coaching.functions";
import { useConsent } from "@/lib/consent";
import { toast } from "sonner";

const faqs = [
 { q: "Was ist der Unterschied zwischen Smart und Coaching?", a: "Smart ist der selbstständige Weg: individuelle Pläne und digitale Unterstützung. Im Coaching bekommst du zusätzlich persönliche Betreuung durch Manu, Check-ins, Feedback und individuelle Anpassungen." },
 { q: "Wie funktioniert der kostenlose Test?", a: "Du kannst BodyFuel Smart 7 Tage kostenlos ausprobieren, ohne Zahlungsdaten. Der Test endet automatisch. Danach entscheidest du selbst, ob du Smart für 14,99 € pro Monat weiter nutzen möchtest." },
 { q: "Brauche ich ein Fitnessstudio?", a: "Nein. Dein Trainingsplan kann auf dein verfügbares Equipment, deine Erfahrung und deine Trainingstage abgestimmt werden – auch für Zuhause." },
 { q: "Ist BodyFuel nur zum Abnehmen gedacht?", a: "Nein. BodyFuel unterstützt auch Muskelaufbau, Recomposition und allgemeine Fitnessziele. Dein Plan richtet sich nach deinem Ziel und deinem Alltag." },
 { q: "Findet das Coaching vor Ort statt?", a: "BodyFuel Coaching findet vollständig online statt. Planung, Check-ins und direkter Austausch laufen digital – unabhängig von deinem Wohnort." },
];

export function LandingPageV3() {
 return <div className="bodyfuel-landing min-h-screen overflow-x-clip bg-background text-foreground selection:bg-primary/30"><Header /><main><Hero /><SystemSection /><ProcessSection /><LandingReviews /><PricingSection /><CoachProfileSection /><FaqSection /><GuideTeasers /><ContactSection /></main><Footer /></div>;
}
function BrandLogo() {
 return <span className="flex items-center gap-2 font-display text-2xl font-semibold tracking-normal"><img src={bodyfuelLogoAsset.url} alt="" className="h-12 w-12 object-contain" />BODY<span className="-ml-2 text-primary">FUEL</span></span>;
}
function Header() {
 const [open,setOpen]=useState(false);
 return <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md"><div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
 <Link to="/" aria-label="BodyFuel Startseite"><BrandLogo /></Link>
 <nav aria-label="Hauptnavigation" className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex"><a href="#system" className="hover:text-foreground">Die App</a><a href="#wege" className="hover:text-foreground">Smart & Coaching</a><a href="#coach" className="hover:text-foreground">Dein Coach</a><Link to="/ratgeber" className="hover:text-foreground">Ratgeber</Link></nav>
 <div className="flex items-center gap-2"><Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/app">Login</Link></Button><Button asChild className="min-h-11"><Link to="/trial"><span className="hidden sm:inline">7 Tage gratis testen</span><span className="sm:hidden">Gratis testen</span><ArrowUpRight /></Link></Button><Button variant="ghost" size="icon" className="h-11 w-11 lg:hidden" aria-label={open ? "Menü schließen" : "Menü öffnen"} aria-expanded={open} onClick={()=>setOpen(!open)}>{open ? <X /> : <Menu />}</Button></div>
 </div>{open && <nav aria-label="Mobile Navigation" className="grid gap-1 border-t border-border px-5 py-3 lg:hidden">{[['#system','Die App'],['#wege','Smart & Coaching'],['#coach','Dein Coach'],['#kontakt','Kontakt']].map(([href,label])=><Button asChild variant="ghost" className="min-h-11 justify-start" key={href}><a href={href} onClick={()=>setOpen(false)}>{label}</a></Button>)}<Button asChild variant="ghost" className="min-h-11 justify-start"><Link to="/ratgeber">Ratgeber</Link></Button><Button asChild variant="ghost" className="min-h-11 justify-start"><Link to="/app">Login</Link></Button></nav>}</header>;
}
function Hero() {
 return <section className="landing-hero relative isolate border-b border-border">
 <img src={heroImage} width={1920} height={1088} fetchPriority="high" alt="Training und Mahlzeitenvorbereitung mit Hanteln, Wasser und einer Gemüsemahlzeit" className="absolute inset-0 -z-20 h-full w-full object-cover object-right" /><div className="landing-hero-shade absolute inset-0 -z-10" />
 <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20"><p className="flex items-center gap-3 text-xs font-semibold text-primary"><span className="h-px w-8 bg-primary" /> Online. Individuell. In deinem Alltag.</p><h1 className="mt-5 font-display text-6xl font-semibold leading-none sm:text-8xl">BodyFuel</h1><p className="mt-5 max-w-xl font-display text-3xl font-medium leading-tight sm:text-4xl">Deine Ernährung. Dein Training.<br /><span className="text-primary">Endlich ein klarer Plan.</span></p><p className="mt-6 max-w-lg text-base leading-7 text-foreground/80">Abnehmen, Muskeln aufbauen oder fitter werden: mit deiner eigenen App und genau so viel Begleitung, wie du brauchst.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="min-h-12"><Link to="/trial">Smart 7 Tage gratis testen <ArrowRight /></Link></Button><Button asChild size="lg" variant="outline" className="min-h-12 border-foreground/30 bg-background/40"><a href="#coach">Coaching kennenlernen</a></Button></div><p className="mt-5 flex items-center gap-2 text-xs text-foreground/80"><ShieldCheck className="h-4 w-4 text-primary" /> Ohne Zahlungsdaten · Test endet automatisch</p></div>
 </section>;
}
const appViews = [
 { label: 'Ernährung', icon: Utensils, src: nutritionPlanAsset.url, title: 'Heute wissen, was auf den Teller kommt.', description: 'Gerichte passend zu deinen Zielen und Vorlieben. Mit Zutaten, Mengen und einer Einkaufsliste, die deine Woche einfacher macht.', details: ['Individuelle Gerichte & Portionen','Kalorien und Makros im Blick','Einkaufsliste für deinen Plan'] },
 { label: 'Training', icon: Dumbbell, src: null, title: 'Dein Ziel wird zu einer Routine.', description: 'Deine Übungen, Sätze und Wiederholungen an einem Ort. Dein Trainingsplan passt zu deinen Möglichkeiten – im Studio oder Zuhause.', details: ['Training passend zu deinem Equipment','Sätze, Gewichte & Wiederholungen festhalten','Fortschritt nachvollziehbar dokumentieren'] },
 { label: 'Tracking', icon: ClipboardList, src: nutritionTrackerAsset.url, title: 'Nicht nur anfangen. Dranbleiben.', description: 'Dokumentiere deine Mahlzeiten und behalte deine Tagesziele im Blick. So wird sichtbar, was in deinem Alltag funktioniert.', details: ['Mahlzeiten einfach dokumentieren','Tagesziele & Fortschritt verfolgen','Alles in deiner BodyFuel App'] },
];
function SystemSection() {
 const [active,setActive]=useState(0); const view=appViews[active] ?? appViews[0];
 return <section id="system" className="scroll-mt-24 border-b border-border py-16 sm:py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-6"><div><SectionEyebrow>Dein Alltag. Eine App.</SectionEyebrow><h2 className="mt-4 max-w-2xl text-4xl font-semibold sm:text-5xl">Weniger zusammensuchen.<br />Mehr umsetzen.</h2></div><p className="max-w-sm text-sm leading-7 text-muted-foreground">Kein Wechsel zwischen Notizen, Tabellen und verschiedenen Apps. Dein Plan ist dort, wo du ihn brauchst.</p></div>
 <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1fr_1fr]"><div><div role="tablist" aria-label="App-Bereiche" className="flex flex-wrap gap-2 border-b border-border pb-5">{appViews.map((item,i)=><Button key={item.label} role="tab" id={`app-tab-${i}`} aria-controls="app-view" aria-selected={active===i} variant={active===i?'default':'outline'} className="min-h-11" onClick={()=>setActive(i)}><item.icon />{item.label}</Button>)}</div><div id="app-view" role="tabpanel" aria-labelledby={`app-tab-${active}`}><h3 className="mt-8 max-w-md text-3xl font-medium leading-tight sm:text-4xl">{view.title}</h3><p className="mt-5 max-w-md leading-8 text-muted-foreground">{view.description}</p><ul className="mt-7 space-y-4">{view.details.map(text=><li key={text} className="flex items-center gap-3 text-sm"><Check className="h-4 w-4 shrink-0 text-primary" />{text}</li>)}</ul><Button asChild variant="link" className="mt-7 px-0"><Link to="/smart">Smart entdecken <ArrowUpRight /></Link></Button></div></div>
 <div className="landing-product-stage relative flex min-h-[540px] items-center justify-center border-y border-border bg-secondary/40 p-8">{view.src ? <img key={view.src} src={view.src} alt={`BodyFuel App: ${view.label}`} loading="lazy" className="landing-app-screen block h-[490px] max-w-full rounded-3xl border border-border object-contain" /> : <LandingTrainingPreview />}<div className="absolute bottom-5 right-5 flex items-center gap-3"><img src={fuelyHappyAsset.url} alt="Fuely, dein BodyFuel Begleiter" loading="lazy" className="h-24 w-auto" /></div></div>
 </div></div></section>;
}
function ProcessSection() {
 return <section id="ablauf" className="scroll-mt-24 border-b border-border py-12 sm:py-16"><div className="mx-auto max-w-7xl px-5 sm:px-8"><SectionEyebrow>Dein Start mit BodyFuel</SectionEyebrow><div className="mt-7 grid gap-8 md:grid-cols-3">{[{title:'Dich kennenlernen',text:'Ziel, Vorlieben, Training und Alltag: dein Onboarding legt die Grundlage.'},{title:'Deinen Plan erhalten',text:'Ernährung und Training werden auf deine Ausgangslage abgestimmt.'},{title:'Umsetzen & anpassen',text:'Mit Tracking und Feedback wird aus einem Plan eine wiederholbare Routine.'}].map((step,i)=><div key={step.title} className="border-t border-border pt-5"><span className="font-display text-3xl text-primary">0{i+1}</span><h3 className="mt-4 text-xl font-semibold">{step.title}</h3><p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">{step.text}</p></div>)}</div></div></section>;
}
function PricingSection() {
 const {openCheckout,checkoutElement,isOpen}=useStripeCheckout(); const checkoutRef=useRef<HTMLDivElement>(null);
 const handleBuy=(priceId:string)=>{openCheckout({priceId,returnUrl:`${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`});window.setTimeout(()=>checkoutRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),80);};
 return <section id="wege" className="scroll-mt-24 bg-secondary/20 py-16 sm:py-24"><div id="preise" className="mx-auto max-w-7xl scroll-mt-24 px-5 sm:px-8"><SectionEyebrow>Zwei Wege. Dein Ziel.</SectionEyebrow><h2 className="mt-4 text-4xl font-semibold sm:text-5xl">Selbstständig starten.<br />Oder gemeinsam weiterkommen.</h2><p className="mt-5 max-w-2xl leading-7 text-muted-foreground">Die Basis ist immer dein individueller Plan. Du entscheidest, wie viel persönliche Begleitung du möchtest.</p><div className="mt-10 grid gap-6 md:grid-cols-2">{PACKAGES.map(pkg=><article key={pkg.key} className={`flex flex-col rounded-lg border bg-card p-6 sm:p-9 ${pkg.popular?'border-primary':'border-border'}`}><div className="flex items-center justify-between gap-4"><span className="text-sm font-semibold text-primary">{pkg.key==='smart'?'Dein digitales System':'Mit Manu an deiner Seite'}</span>{pkg.popular && <MessageCircle className="h-5 w-5 text-primary" />}</div><h3 className="mt-5 text-3xl font-semibold">{pkg.key==='smart'?'BodyFuel Smart':'BodyFuel Coaching'}</h3><p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">{pkg.tagline}</p><div className="mt-5 border-l-2 border-primary pl-4"><p className="text-sm font-semibold">{pkg.key==='smart'?'Passt zu dir, wenn …':'Passt zu dir, wenn …'}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{pkg.key==='smart'?'du selbstständig umsetzen möchtest und vor allem Struktur, passende Pläne und einen Überblick brauchst.':'du persönlichen Austausch, regelmäßiges Feedback und jemanden brauchst, der deinen Weg mit dir anpasst.'}</p></div><div className="mt-6 flex items-baseline gap-2"><span className="font-display text-5xl font-semibold">{String(pkg.price).replace('.',',')} €</span><span className="text-sm text-muted-foreground">/ Monat</span></div><ul className="my-8 flex-1 space-y-4 border-t border-border pt-7">{pkg.features.map(f=><li key={f} className="flex items-start gap-3 text-sm leading-6"><Check className="mt-1 h-4 w-4 shrink-0 text-primary" />{f}</li>)}</ul>{pkg.key==='smart'?<Button asChild size="lg" className="min-h-12 w-full"><Link to="/trial">7 Tage kostenlos testen <ArrowRight /></Link></Button>:<Button size="lg" className="min-h-12 w-full" onClick={()=>handleBuy(pkg.priceId)}>Coaching starten <ArrowRight /></Button>}<p className="mt-4 text-center text-xs leading-6 text-muted-foreground">{pkg.key==='smart'?'Ohne Zahlungsdaten · Test endet automatisch':<a href="#kontakt" className="underline underline-offset-4">Noch unsicher? Erst unverbindlich anfragen.</a>}</p></article>)}</div><div ref={checkoutRef} className={isOpen?'mt-8 scroll-mt-24 overflow-hidden rounded-lg bg-background':''}>{checkoutElement}</div><p className="mt-6 text-xs leading-6 text-muted-foreground">Alle Preise gemäß § 19 UStG (Kleinunternehmerregelung). Es wird keine Umsatzsteuer ausgewiesen.</p></div></section>;
}
function CoachProfileSection() {
 return <section id="coach" className="scroll-mt-24 border-y border-border py-16 sm:py-24"><div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20"><figure><img src={manuCoachAsset.url} alt="Manuel Manu Schrader, dein BodyFuel Coach" loading="lazy" className="aspect-[4/5] w-full rounded-lg object-cover object-top" /><figcaption className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4"><span className="font-display text-xl">Manuel „Manu“ Schrader</span><span className="text-xs text-muted-foreground">Gründer & Head Coach</span></figcaption></figure><div><SectionEyebrow>Persönlich. Auch online.</SectionEyebrow><h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">Ein Plan ist gut.<br /><span className="text-primary">Jemand, der hinschaut,<br />macht den Unterschied.</span></h2><p className="mt-6 max-w-xl leading-8 text-muted-foreground">Im Coaching bist du nicht auf dich allein gestellt. Ich schaue auf deine Entwicklung, gebe dir Feedback und passe deinen Plan mit dir an – an deinen Alltag, nicht umgekehrt.</p><ul className="mt-8 space-y-4 border-t border-border pt-6">{['Seit über 10 Jahren im Fitnessbereich','Performance-Coach im American Football','Persönliche Check-ins & direkter Austausch'].map(f=><li className="flex items-center gap-3 text-sm" key={f}><Check className="h-4 w-4 shrink-0 text-primary" />{f}</li>)}</ul><Button asChild size="lg" className="mt-9 min-h-12"><a href="#kontakt">Coaching mit Manu anfragen <ArrowUpRight /></a></Button></div></div></section>;
}
function FaqSection() {
 return <section id="faq" className="scroll-mt-24 py-16 sm:py-24"><div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.7fr_1.3fr]"><div><SectionEyebrow>Noch Fragen?</SectionEyebrow><h2 className="mt-4 text-4xl font-semibold">Gut zu wissen.<br />Bevor du startest.</h2><p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">Du musst dich nicht sofort entscheiden. Schau dir die App im kostenlosen Test an oder sprich mit mir über dein Ziel.</p></div><div>{faqs.map(faq=><details key={faq.q} className="group border-b border-border py-5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 text-base font-medium">{faq.q}<ChevronDown className="h-4 w-4 shrink-0 text-primary transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary><p className="mt-4 max-w-2xl pr-5 text-sm leading-7 text-muted-foreground">{faq.a}</p></details>)}</div></div></section>;
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
    <section id="kontakt" className="border-t border-border bg-background py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:px-8">
        <div>
          <SectionEyebrow>Coaching anfragen</SectionEyebrow>
          <h2 className="mt-4 font-display text-4xl font-bold  leading-tight text-foreground sm:text-5xl">Du willst mich<br /><span className="text-primary">an deiner Seite?</span></h2>
          <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">Schick mir kurz deine Eckdaten. Ich sehe mir deine Ausgangslage an und wir klären, ob persönliches BodyFuel Coaching zu dir passt.</p>
          <div className="mt-7 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3"><Check className="h-4 w-4 text-gold" /> Ziel und Ausgangslage klären</div>
            <div className="flex items-center gap-3"><Check className="h-4 w-4 text-gold" /> Persönliche Betreuung durch Manu</div>
            <div className="flex items-center gap-3"><Check className="h-4 w-4 text-gold" /> Unverbindliche Anfrage</div>
          </div>
        </div>

        {done ? (
          <div className="grid min-h-[430px] place-items-center rounded-lg border border-gold/30 bg-gold/5 p-8 text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary"><Check className="h-6 w-6 text-primary-foreground" /></span>
              <h3 className="mt-5 font-display text-3xl font-bold text-foreground">Anfrage ist raus.</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Danke dir. Deine Angaben wurden übermittelt.</p>
              <Button variant="outline" className="mt-6 border-border bg-transparent text-foreground hover:bg-accent" onClick={() => setDone(false)}>Weitere Anfrage</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6 sm:p-8">
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
            <Button type="submit" disabled={submitting} size="lg" className="mt-6 w-full bg-primary text-primary-foreground  hover:opacity-90">
              {submitting ? "Wird gesendet …" : "Unverbindlich anfragen"}
              {!submitting && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}


function SectionEyebrow({children}:{children:ReactNode}) { return <p className="text-xs font-semibold text-primary">{children}</p>; }
function Field({label,htmlFor,children}:{label:string;htmlFor:string;children:ReactNode}) { return <div className="space-y-2"><Label htmlFor={htmlFor} className="text-foreground/80">{label}</Label>{children}</div>; }
function Footer() {
 const {openSettings}=useConsent();
 return <footer className="border-t border-border py-12"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]"><div><BrandLogo /><p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">Dein Ziel. Ein System. Jeden Tag.<br />Ernährung & Training. Komplett online.</p></div><div className="space-y-3 text-sm text-muted-foreground"><h3 className="mb-5 text-lg text-foreground">Dein nächster Schritt</h3><Link to="/smart" className="block hover:text-primary">BodyFuel Smart</Link><a href="#coach" className="block hover:text-primary">Persönliches Coaching</a><Link to="/ratgeber" className="block hover:text-primary">Ratgeber</Link><Link to="/app" className="block hover:text-primary">Login</Link></div><div className="space-y-3 text-sm text-muted-foreground"><h3 className="mb-5 text-lg text-foreground">In Verbindung bleiben</h3><a href="mailto:info@bodyfuel-coaching.com" className="flex items-center gap-2 break-all hover:text-primary"><Mail className="h-4 w-4 shrink-0" />info@bodyfuel-coaching.com</a><a href="https://instagram.com/bodyfuel_coaching" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary"><Instagram className="h-4 w-4" />@bodyfuel_coaching</a></div></div><div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-6 text-xs text-muted-foreground"><span className="mr-auto">© {new Date().getFullYear()} BODYFUEL Nutrition Coaching</span><Link to="/impressum">Impressum</Link><Link to="/datenschutz">Datenschutz</Link><Button variant="link" className="h-auto p-0 text-xs text-muted-foreground" onClick={openSettings}>Cookie-Einstellungen</Button></div></div></footer>;
}
