import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, HeartPulse, AlertTriangle, Flame, Moon, Beef, Droplet, Footprints, Activity, Info } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsHero } from "@/components/bodyfuel/BullsHero";

export const Route = createFileRoute("/bulls/recovery")({
  head: () => ({ meta: [{ title: "Recovery & Verletzungsprävention — Bulls Hub" }] }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <RecoveryPage />
      </BullsGate>
    </AppLayout>
  ),
});

type IssueCard = {
  title: string;
  symptoms: string[];
  causes?: string[];
  recovery: string[];
  warning?: string;
};

const ISSUES: IssueCard[] = [
  {
    title: "Schulterprobleme",
    symptoms: ["Schmerzen beim Werfen", "Schmerzen beim Bankdrücken", "Schmerzen beim Armheben", "Kraftverlust"],
    causes: ["Zu viele Druckübungen", "Zu wenig Zugübungen", "Fehlende Schulterstabilität", "Hohe Kontaktbelastung"],
    recovery: ["Face Pulls", "Außenrotationen mit Band", "Band Pull Aparts", "Mobility für Brust und Schulter", "Schulterblattkontrolle verbessern"],
    warning: "Bei Instabilitätsgefühl oder starkem Kraftverlust Arzt aufsuchen.",
  },
  {
    title: "Hamstring-Probleme",
    symptoms: ["Ziehen in der Oberschenkelrückseite", "Beschwerden bei Sprints", "Spannungsgefühl nach Belastung"],
    causes: ["Zu wenig Sprinttraining", "Schwache hintere Kette", "Mangelnde Regeneration"],
    recovery: ["Nordic Hamstrings", "Isometrische Übungen", "Walking", "Ausreichend Schlaf", "Hohe Proteinzufuhr"],
    warning: "Bei plötzlichem stechenden Schmerz Belastung reduzieren.",
  },
  {
    title: "Schienbeinschmerzen",
    symptoms: ["Schmerzen entlang der Schienbeinkante", "Beschwerden beim Laufen", "Belastungsschmerzen"],
    causes: ["Zu schnelle Belastungssteigerung", "Harte Untergründe", "Schwache Wadenmuskulatur"],
    recovery: ["Belastung anpassen", "Wadenkräftigung", "Fußmuskulatur trainieren", "Radfahren als Alternative", "Geeignetes Schuhwerk"],
    warning: "Bei langanhaltenden Beschwerden medizinisch abklären lassen.",
  },
  {
    title: "Vordere Knieschmerzen",
    symptoms: ["Schmerzen unter der Kniescheibe", "Beschwerden bei Sprüngen", "Beschwerden beim Treppensteigen"],
    causes: ["Hohe Sprungbelastung", "Viele Richtungswechsel", "Überlastung"],
    recovery: ["Spanish Squats", "Wall Sits", "Belastung steuern", "Gesäßmuskulatur stärken", "Hüftstabilität verbessern"],
  },
  {
    title: "Rückenbeschwerden",
    symptoms: ["Verspannungen", "Steifigkeit", "Schmerzen nach Training"],
    causes: ["Schwacher Core", "Zu langes Sitzen", "Technikprobleme"],
    recovery: ["Dead Bugs", "Bird Dogs", "Walking", "Core Training", "Hüftmobilität"],
  },
  {
    title: "Hüftbeschwerden",
    symptoms: ["Ziehen in der Leiste", "Spannung beim Sprinten", "Beschwerden beim Knieheben"],
    causes: ["Viel Sitzen", "Sprintbelastung", "Beweglichkeitsdefizite"],
    recovery: ["Hüftmobilität", "Glute Bridges", "Dynamisches Warm-up", "Walking"],
  },
  {
    title: "Umknicken & Sprunggelenk",
    symptoms: ["Schwellung", "Instabilität", "Schmerzen nach Umknicken"],
    recovery: ["Balance Training", "Einbeinstand", "Wadenheben", "Langsame Belastungssteigerung"],
  },
  {
    title: "Nacken & Tackling",
    symptoms: ["Verspannungen", "Steifigkeit", "Kopfschmerzen"],
    recovery: ["Leichte Mobilisation", "Spaziergänge", "Triggerpunktarbeit", "Schlaf optimieren"],
  },
];

const BASICS = [
  { icon: Moon, title: "Schlaf", goal: "7–9 Stunden pro Nacht", text: "Schlaf ist der wichtigste Regenerationsfaktor." },
  { icon: Beef, title: "Protein", goal: "2 g pro kg Körpergewicht", text: "Unterstützt Muskelaufbau und Regeneration." },
  { icon: Droplet, title: "Wasser", goal: "35–45 ml pro kg Körpergewicht", text: "Verbessert Leistungsfähigkeit und Erholung." },
  { icon: Footprints, title: "Schritte", goal: "8.000–10.000 pro Tag", text: "Fördert Durchblutung und Regeneration." },
  { icon: Activity, title: "Mobility", goal: "5–10 Minuten täglich", text: "Verbessert Beweglichkeit und reduziert Verletzungsrisiko." },
];

const MANU_RULES = [
  "Schlaf schlägt jedes Supplement.",
  "Bewegung regeneriert besser als komplettes Nichtstun.",
  "Protein zuerst, alles andere danach.",
  "Mobility täglich schlägt 1 Stunde Mobility am Sonntag.",
  "Wer nie regeneriert, wird irgendwann verletzt.",
];

function RecoveryPage() {
  return (
    <div className="space-y-6">
      <Link to="/bulls" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red">
        <ArrowLeft className="h-3 w-3" /> Zurück zum Hub
      </Link>
      <BullsHero
        eyebrow="Recovery & Verletzungsprävention"
        title="🩺 Recovery & Verletzungsprävention"
        subtitle="Typische Beschwerden besser verstehen — und erste sinnvolle Maßnahmen zur Regeneration kennenlernen."
      />

      <div className="rounded-2xl border border-bulls-red/50 bg-bulls-red/10 p-4 text-sm text-foreground/90">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-bulls-red">
          <Info className="h-4 w-4" /> Hinweis
        </div>
        <p className="mt-2">
          Die folgenden Informationen dienen ausschließlich der Orientierung. Bei starken Schmerzen,
          Instabilität oder anhaltenden Beschwerden solltest du einen Arzt oder Physiotherapeuten aufsuchen.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-white">Typische Beschwerden</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {ISSUES.map((c) => <IssueBlock key={c.title} card={c} />)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-white">🏆 Recovery Basics für jeden Football-Spieler</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BASICS.map((b) => (
            <div key={b.title} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-400">
                <b.icon className="h-4 w-4" /> {b.title}
              </div>
              <p className="mt-2 font-display text-2xl font-bold text-white">{b.goal}</p>
              <p className="mt-2 text-sm text-muted-foreground">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="rounded-2xl border border-bulls-red/50 bg-gradient-to-br from-black to-background p-6 shadow-bulls">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-bulls-red">
            <Flame className="h-4 w-4" /> Manu's Top 5 Recovery Regeln
          </div>
          <ol className="mt-3 space-y-2 text-sm text-foreground/90">
            {MANU_RULES.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-display text-lg font-bold text-bulls-red">{i + 1}.</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

function IssueBlock({ card }: { card: IssueCard }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-bulls-red" />
        <h3 className="font-display text-lg font-bold text-white">{card.title}</h3>
      </div>

      <Sub label="Typische Symptome" items={card.symptoms} />
      {card.causes && <Sub label="Häufige Ursachen" items={card.causes} />}
      <Sub label="Recovery" items={card.recovery} tone="green" />

      {card.warning && (
        <div className="rounded-xl border border-bulls-red/40 bg-bulls-red/5 p-3 text-sm text-foreground/90">
          <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-bulls-red">
            <AlertTriangle className="h-3.5 w-3.5" /> Wichtig
          </div>
          <p className="mt-1">{card.warning}</p>
        </div>
      )}
    </div>
  );
}

function Sub({ label, items, tone }: { label: string; items: string[]; tone?: "green" }) {
  return (
    <div>
      <div className={`text-[11px] font-bold uppercase tracking-wider ${tone === "green" ? "text-emerald-400" : "text-muted-foreground"}`}>
        {label}
      </div>
      <ul className="mt-1 list-disc pl-5 text-sm text-foreground/90 space-y-0.5">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </div>
  );
}
