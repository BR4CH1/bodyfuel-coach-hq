import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsHero } from "@/components/bodyfuel/BullsHero";
import { getBullsProfile, trackHubEvent, type BullsGoal } from "@/lib/bulls.functions";

export const Route = createFileRoute("/bulls/training")({
  head: () => ({ meta: [{ title: "Mini-Trainingsplan — Bulls Hub" }] }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <TrainingPage />
      </BullsGate>
    </AppLayout>
  ),
});

const GOAL_LABEL: Record<BullsGoal, string> = {
  fat_loss: "Körperfett reduzieren",
  muscle_gain: "Muskelmasse aufbauen",
  performance: "Football Performance",
  general_fitness: "Allgemein fitter werden",
};

function TrainingPage() {
  const fn = useServerFn(trackHubEvent);
  const profileQ = useQuery({ queryKey: ["bulls-profile"], queryFn: useServerFn(getBullsProfile) });
  useEffect(() => { fn({ data: { kind: "training_plan_opened" } }).catch(() => {}); }, [fn]);

  const goal = (profileQ.data as any)?.main_goal as BullsGoal | undefined;

  return (
    <div className="space-y-6">
      <Link to="/bulls" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red">
        <ArrowLeft className="h-3 w-3" /> Zurück zum Hub
      </Link>
      <BullsHero
        eyebrow="Mini-Trainingsplan"
        title="Dein kostenloser Mini-Trainingsplan"
        subtitle={goal ? `Plan passend zu deinem Ziel: ${GOAL_LABEL[goal]}.` : "Ein einfacher Starter-Plan."}
      />

      {!goal ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Lade…</p>
      ) : (
        <Plan goal={goal} />
      )}
    </div>
  );
}

function Plan({ goal }: { goal: BullsGoal }) {
  if (goal === "fat_loss") return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Block title="Einheit A">
        <li>Kniebeugen oder Beinpresse 3×8–10</li>
        <li>Rudern 3×10</li>
        <li>Liegestütze oder Bankdrücken 3×8–10</li>
        <li>Plank 3×30–45 Sek.</li>
      </Block>
      <Block title="Einheit B">
        <li>Kreuzheben leicht oder Hip Thrust 3×8</li>
        <li>Latzug 3×10</li>
        <li>Schulterdrücken 3×8–10</li>
        <li>Farmers Walk 3 Runden</li>
      </Block>
      <Note>Zusätzlich: 8.000 Schritte täglich · 2 Cardioeinheiten pro Woche à 20–30 Min.</Note>
    </div>
  );
  if (goal === "muscle_gain") return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Block title="Einheit A">
        <li>Kniebeugen oder Beinpresse 4×8</li>
        <li>Bankdrücken 4×8</li>
        <li>Rudern 4×10</li>
        <li>Bauchübung 3 Sätze</li>
      </Block>
      <Block title="Einheit B">
        <li>Kreuzheben oder Hip Thrust 4×6–8</li>
        <li>Schulterdrücken 4×8</li>
        <li>Latzug oder Klimmzüge 4×8–10</li>
        <li>Seitheben 3×12–15</li>
      </Block>
      <Note>Progression tracken — jede Woche versuchen stärker zu werden.</Note>
    </div>
  );
  if (goal === "performance") return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Block title="A — Kraft">
        <li>Kniebeugen oder Beinpresse 3×5</li>
        <li>Bankdrücken 3×5</li>
        <li>Rudern 3×8</li>
        <li>Core 3 Sätze</li>
      </Block>
      <Block title="B — Explosivität">
        <li>Box Jumps 3×5</li>
        <li>Sprints 6×10–20 m</li>
        <li>Farmers Walk 3 Runden</li>
        <li>Mobility 10 Min.</li>
      </Block>
      <Block title="C — Stabilität & Recovery">
        <li>Ausfallschritte 3×8 je Seite</li>
        <li>Schulter-Stabi 3×12</li>
        <li>Dead Bug 3×10 je Seite</li>
        <li>Mobility 10 Min.</li>
      </Block>
    </div>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Block title="Einheit A">
        <li>Beinpresse 3×10</li>
        <li>Brustpresse 3×10</li>
        <li>Rudern 3×10</li>
        <li>Plank 3×30 Sek.</li>
      </Block>
      <Block title="Einheit B">
        <li>Ausfallschritte 3×8 je Seite</li>
        <li>Latzug 3×10</li>
        <li>Schulterdrücken 3×10</li>
        <li>Dead Bug 3×10 je Seite</li>
      </Block>
      <Note>Zusätzlich: 8.000 Schritte täglich · 2 Cardioeinheiten pro Woche.</Note>
    </div>
  );
}

function Block({ title, children }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-lg font-bold text-white">{title}</h3>
      <ul className="mt-2 list-disc pl-5 text-sm text-foreground/90 space-y-1">{children}</ul>
    </div>
  );
}
function Note({ children }: any) {
  return (
    <div className="rounded-2xl border border-bulls-red/40 bg-bulls-red/5 p-4 text-sm text-foreground/90 lg:col-span-3">
      {children}
    </div>
  );
}
