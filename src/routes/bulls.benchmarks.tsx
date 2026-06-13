import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsHero } from "@/components/bodyfuel/BullsHero";
import { CoachingUpsell } from "@/components/bodyfuel/CoachingUpsell";
import { trackHubEvent } from "@/lib/bulls.functions";

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

const BENCHMARKS = [
  ["QB", "Beweglichkeit, Schultergesundheit, Core und Energieversorgung."],
  ["RB", "Explosivität, Beinpower und Regeneration."],
  ["WR", "Geschwindigkeit, Sprungkraft und niedriger Körperfettanteil."],
  ["TE", "Kraft, Athletik und Beweglichkeit."],
  ["OL", "Maximalkraft, Mobilität und Körperzusammensetzung."],
  ["DL", "Explosivität, Kraft und schnelle erste Schritte."],
  ["LB", "Kraft, Geschwindigkeit, Richtungswechsel und Core."],
  ["DB", "Speed, Beweglichkeit und Richtungswechsel."],
  ["Kicker / Punter", "Hüftmobilität, Beinexplosivität und Core."],
  ["Coach / Sonstiges", "Gesundheit, Energie und bessere Gewohnheiten."],
] as const;

function BenchmarksPage() {
  const fn = useServerFn(trackHubEvent);
  useEffect(() => { fn({ data: { kind: "benchmarks_opened" } }).catch(() => {}); }, [fn]);

  return (
    <div className="space-y-6">
      <Link to="/bulls" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red">
        <ArrowLeft className="h-3 w-3" /> Zurück zum Hub
      </Link>
      <BullsHero
        eyebrow="Position Benchmarks"
        title="Worauf es auf deiner Position ankommt"
        subtitle="Die wichtigsten Schwerpunkte pro Position — als Orientierung für dein Training."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BENCHMARKS.map(([pos, focus]) => (
          <div key={pos} className="rounded-2xl border border-border bg-card p-5">
            <div className="font-display text-2xl font-bold text-bulls-red">{pos}</div>
            <p className="mt-2 text-sm text-foreground/90">{focus}</p>
          </div>
        ))}
      </div>

      <CoachingUpsell />
    </div>
  );
}
