import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Target, Dumbbell, Apple, Moon, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsHero } from "@/components/bodyfuel/BullsHero";
import { getBullsProfile, trackHubEvent, type BullsPosition } from "@/lib/bulls.functions";

export const Route = createFileRoute("/bulls/benchmarks")({
  head: () => ({ meta: [{ title: "Positions-Benchmarks — Bulls Hub" }] }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <BenchmarksPage />
      </BullsGate>
    </AppLayout>
  ),
});

type Benchmark = {
  label: string;
  focus: string[];
  training: string[];
  nutrition: string[];
  recovery: string[];
  mistake: string;
};

const BENCHMARKS: Record<BullsPosition, Benchmark> = {
  QB: {
    label: "QB — Quarterback",
    focus: ["Schultergesundheit", "Core-Stabilität", "Beweglichkeit", "Rotationskraft", "Entscheidungsfähigkeit unter Belastung"],
    training: ["Core Training 2–3× pro Woche", "Einbeinige Übungen integrieren", "Schulter-Stabilisation regelmäßig trainieren", "Mobility für Brustwirbelsäule und Schulter"],
    nutrition: ["Ausreichend Kohlenhydrate vor Training und Gameday", "Protein täglich konstant hochhalten"],
    recovery: ["Schulterpflege nach Wurfeinheiten", "Ausreichend Schlaf"],
    mistake: "Zu viel Bankdrücken, zu wenig Schulterstabilität.",
  },
  RB: {
    label: "RB — Running Back",
    focus: ["Explosivität", "Beschleunigung", "Beinpower", "Richtungswechsel", "Regeneration"],
    training: ["Kniebeugen priorisieren", "Sprinttraining integrieren", "Plyometrics nutzen", "Core Training"],
    nutrition: ["Kohlenhydrate rund ums Training", "Protein hochhalten"],
    recovery: ["Waden, Hüfte und Hamstrings pflegen", "Nach intensiven Einheiten aktiv regenerieren"],
    mistake: "Nur Krafttraining ohne Sprintarbeit.",
  },
  WR: {
    label: "WR — Wide Receiver",
    focus: ["Geschwindigkeit", "Sprungkraft", "Explosivität", "Beweglichkeit", "Reaktionsfähigkeit"],
    training: ["Sprinttraining", "Sprungtraining", "Hüftmobilität", "Richtungswechsel trainieren"],
    nutrition: ["Nicht zu aggressiv diäten", "Ausreichend Kohlenhydrate"],
    recovery: ["Hamstrings regelmäßig pflegen", "Schlaf priorisieren"],
    mistake: "Zu viel Muskelmasse aufbauen und dadurch langsamer werden.",
  },
  TE: {
    label: "TE — Tight End",
    focus: ["Kraft", "Athletik", "Beweglichkeit", "Explosivität"],
    training: ["Krafttraining priorisieren", "Sprinttraining ergänzen", "Core Training"],
    nutrition: ["Hohe Proteinzufuhr", "Ausreichend Kalorien für Leistung"],
    recovery: ["Schulter und Knie besonders pflegen"],
    mistake: "Nur Masse aufbauen und Beweglichkeit vernachlässigen.",
  },
  OL: {
    label: "OL — Offensive Line",
    focus: ["Maximalkraft", "Explosivität auf den ersten Metern", "Mobilität", "Körperzusammensetzung"],
    training: ["Kniebeugen", "Kreuzheben", "Farmers Walks", "Schlittenarbeit"],
    nutrition: ["Protein hochhalten", "Körpergewicht kontrollieren", "Qualität vor Masse"],
    recovery: ["Hüfte und Sprunggelenke mobil halten"],
    mistake: "Gewichtszunahme ohne Leistungszuwachs.",
  },
  DL: {
    label: "DL — Defensive Line",
    focus: ["Explosivität", "Kraft", "Antritt", "Richtungswechsel"],
    training: ["Sprinttraining", "Schlittenarbeit", "Kniebeugen", "Power Movements"],
    nutrition: ["Protein hochhalten", "Ausreichende Energie für Training"],
    recovery: ["Hüfte und Rücken regelmäßig pflegen"],
    mistake: "Zu viel Fokus auf Muskelmasse statt Explosivität.",
  },
  LB: {
    label: "LB — Linebacker",
    focus: ["Kraft", "Geschwindigkeit", "Beweglichkeit", "Explosivität", "Richtungswechsel"],
    training: ["Sprinttraining", "Krafttraining", "Core Training", "Athletiktraining"],
    nutrition: ["Hohe Proteinzufuhr", "Ausreichend Kohlenhydrate"],
    recovery: ["Schlaf priorisieren", "Regelmäßige Mobility"],
    mistake: "Nur Krafttraining und zu wenig Athletiktraining.",
  },
  DB: {
    label: "DB — Defensive Back",
    focus: ["Geschwindigkeit", "Richtungswechsel", "Reaktion", "Sprungkraft"],
    training: ["Sprinttraining", "Agility Drills", "Plyometrics", "Core Training"],
    nutrition: ["Schlank und leistungsfähig bleiben", "Protein hochhalten"],
    recovery: ["Hamstrings und Hüfte pflegen"],
    mistake: "Zu viel Muskelmasse aufbauen.",
  },
  KP: {
    label: "Kicker / Punter",
    focus: ["Hüftbeweglichkeit", "Core", "Explosivität", "Technik"],
    training: ["Mobility", "Einbeinige Übungen", "Core Training"],
    nutrition: ["Ausreichend Protein", "Hydration beachten"],
    recovery: ["Hüfte und Adduktoren pflegen"],
    mistake: "Krafttraining ohne Beweglichkeitstraining.",
  },
  COACH: {
    label: "Coach / Sonstiges",
    focus: ["Gesundheit", "Energie", "Alltagstauglichkeit"],
    training: ["2–4 Krafttrainings pro Woche", "Tägliche Bewegung"],
    nutrition: ["Protein priorisieren", "Ausreichend trinken"],
    recovery: ["Schlaf verbessern", "Stressmanagement"],
    mistake: "Zu komplizierte Pläne statt einfacher Gewohnheiten.",
  },
};

function BenchmarksPage() {
  const fn = useServerFn(trackHubEvent);
  const profileQ = useQuery({ queryKey: ["bulls-profile"], queryFn: useServerFn(getBullsProfile) });
  useEffect(() => { fn({ data: { kind: "benchmarks_opened" } }).catch(() => {}); }, [fn]);

  const position = (profileQ.data as any)?.position as BullsPosition | undefined;
  const bm = position ? BENCHMARKS[position] : null;

  return (
    <div className="space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red">
        <ArrowLeft className="h-3 w-3" /> Zurück zum Hub
      </Link>
      <BullsHero
        eyebrow="Position Benchmarks"
        title="Worauf es auf deiner Position ankommt"
        subtitle={bm ? `Schwerpunkte und Handlungsempfehlungen für: ${bm.label}.` : "Lade …"}
      />

      {bm && (
        <>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="font-display text-3xl font-bold text-bulls-red">{bm.label}</div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section icon={Target} title="Fokus" items={bm.focus} />
            <Section icon={Dumbbell} title="Trainingsschwerpunkte" items={bm.training} />
            <Section icon={Apple} title="Ernährungsschwerpunkte" items={bm.nutrition} />
            <Section icon={Moon} title="Regeneration" items={bm.recovery} />
          </div>

          <div className="rounded-2xl border border-bulls-red/40 bg-bulls-red/5 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-bulls-red">
              <AlertTriangle className="h-4 w-4" /> Typischer Fehler
            </div>
            <p className="mt-2 text-sm text-foreground/90">{bm.mistake}</p>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, items }: { icon: any; title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-bulls-red">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <ul className="mt-3 list-disc pl-5 text-sm text-foreground/90 space-y-1">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </div>
  );
}
