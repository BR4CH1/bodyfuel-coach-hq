import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
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

const BENCHMARKS: Record<BullsPosition, { label: string; focus: string }> = {
  QB: { label: "QB — Quarterback", focus: "Beweglichkeit, Schultergesundheit, Core und Energieversorgung." },
  RB: { label: "RB — Running Back", focus: "Explosivität, Beinpower und Regeneration." },
  WR: { label: "WR — Wide Receiver", focus: "Geschwindigkeit, Sprungkraft und niedriger Körperfettanteil." },
  TE: { label: "TE — Tight End", focus: "Kraft, Athletik und Beweglichkeit." },
  OL: { label: "OL — Offensive Line", focus: "Maximalkraft, Mobilität und Körperzusammensetzung." },
  DL: { label: "DL — Defensive Line", focus: "Explosivität, Kraft und schnelle erste Schritte." },
  LB: { label: "LB — Linebacker", focus: "Kraft, Geschwindigkeit, Richtungswechsel und Core." },
  DB: { label: "DB — Defensive Back", focus: "Speed, Beweglichkeit und Richtungswechsel." },
  KP: { label: "Kicker / Punter", focus: "Hüftmobilität, Beinexplosivität und Core." },
  COACH: { label: "Coach / Sonstiges", focus: "Gesundheit, Energie und bessere Gewohnheiten." },
};

function BenchmarksPage() {
  const fn = useServerFn(trackHubEvent);
  const profileQ = useQuery({ queryKey: ["bulls-profile"], queryFn: useServerFn(getBullsProfile) });
  useEffect(() => { fn({ data: { kind: "benchmarks_opened" } }).catch(() => {}); }, [fn]);

  const position = (profileQ.data as any)?.position as BullsPosition | undefined;
  const bm = position ? BENCHMARKS[position] : null;

  return (
    <div className="space-y-6">
      <Link to="/bulls" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red">
        <ArrowLeft className="h-3 w-3" /> Zurück zum Hub
      </Link>
      <BullsHero
        eyebrow="Position Benchmarks"
        title="Worauf es auf deiner Position ankommt"
        subtitle={bm ? `Schwerpunkte für deine Position: ${bm.label}.` : "Lade …"}
      />

      {bm && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="font-display text-3xl font-bold text-bulls-red">{bm.label}</div>
          <p className="mt-3 text-base text-foreground/90">{bm.focus}</p>
        </div>
      )}
    </div>
  );
}
