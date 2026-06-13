import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsHero } from "@/components/bodyfuel/BullsHero";

import { trackHubEvent } from "@/lib/bulls.functions";

export const Route = createFileRoute("/bulls/nutrition")({
  head: () => ({ meta: [{ title: "Mini-Ernährungsplan — Bulls Hub" }] }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <NutritionPage />
      </BullsGate>
    </AppLayout>
  ),
});

function NutritionPage() {
  const fn = useServerFn(trackHubEvent);
  useEffect(() => { fn({ data: { kind: "nutrition_plan_opened" } }).catch(() => {}); }, [fn]);

  return (
    <div className="space-y-6">
      <Link to="/bulls" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red">
        <ArrowLeft className="h-3 w-3" /> Zurück zum Hub
      </Link>
      <BullsHero
        eyebrow="Mini-Ernährungsplan"
        title="Dein kostenloser Mini-Ernährungsplan"
        subtitle="Bewusst einfach gehalten — ersetzt keinen individuellen Plan, gibt dir aber eine solide Grundlage."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Day title="🏋️ Trainingstag">
          <Meal name="Frühstück">
            <li>250 g Skyr</li>
            <li>1 Banane</li>
            <li>optional 30 g Haferflocken</li>
          </Meal>
          <Meal name="Mittag">
            <li>150–200 g Hähnchen, Pute, Rind oder vegane Alternative</li>
            <li>150–250 g Reis, Kartoffeln oder Nudeln</li>
            <li>Gemüse</li>
          </Meal>
          <Meal name="Snack">
            <li>Proteinshake oder 250 g Skyr</li>
            <li>Obst</li>
          </Meal>
          <Meal name="Abend">
            <li>150–200 g Proteinquelle</li>
            <li>Gemüse</li>
            <li>Kohlenhydrate je nach Hunger und Training</li>
          </Meal>
        </Day>

        <Day title="🛌 Restday">
          <Meal name="Frühstück">
            <li>3 Eier oder 250 g Skyr</li>
            <li>Obst</li>
          </Meal>
          <Meal name="Mittag">
            <li>150–200 g Proteinquelle</li>
            <li>viel Gemüse</li>
            <li>kleinere Portion Kohlenhydrate</li>
          </Meal>
          <Meal name="Snack">
            <li>Skyr, Proteinshake oder Hüttenkäse</li>
          </Meal>
          <Meal name="Abend">
            <li>Proteinquelle</li>
            <li>Gemüse</li>
            <li>gesunde Fettquelle (Nüsse, Avocado oder Olivenöl)</li>
          </Meal>
        </Day>
      </div>

      
    </div>
  );
}

function Day({ title, children }: any) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl font-bold text-white">{title}</h2>
      {children}
    </div>
  );
}
function Meal({ name, children }: any) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-bulls-red">{name}</div>
      <ul className="mt-1 list-disc pl-5 text-sm text-foreground/90">{children}</ul>
    </div>
  );
}
