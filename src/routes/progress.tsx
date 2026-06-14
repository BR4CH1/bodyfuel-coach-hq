import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Scale, Ruler, Activity } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";
import { WeightProgressChart } from "@/components/bodyfuel/WeightProgressChart";

export const Route = createFileRoute("/progress")({
  head: () => ({ meta: [{ title: "Verlauf & Diagramme — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <ProgressContent />
    </AppLayout>
  ),
});

type Measurement = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
};

function ProgressContent() {
  const { supabaseUser } = useSession();
  const uid = supabaseUser?.id;

  const [items, setItems] = useState<Measurement[]>([]);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [ms, p] = await Promise.all([
        supabase
          .from("body_measurements")
          .select("id, measured_at, weight_kg, body_fat_pct, waist_cm")
          .eq("user_id", uid)
          .order("measured_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("goal_weight_kg")
          .eq("id", uid)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (ms.data) setItems(ms.data as Measurement[]);
      if (p.data) setGoalWeight((p.data as { goal_weight_kg: number | null }).goal_weight_kg);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const weights = items.filter((i) => i.weight_kg != null);
  const latest = weights[weights.length - 1];
  const first = weights[0];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/measurements"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Zurück zu Körpermaße
        </Link>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Fortschritt
        </p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          Verlauf & Diagramme
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          So entwickeln sich dein Gewicht und deine Körpermaße über die Zeit.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric
          icon={<Scale className="h-5 w-5" />}
          label="Aktuelles Gewicht"
          value={latest?.weight_kg != null ? `${latest.weight_kg} kg` : "—"}
          delta={
            latest && first && latest.weight_kg != null && first.weight_kg != null
              ? `${(latest.weight_kg - first.weight_kg > 0 ? "+" : "")}${(latest.weight_kg - first.weight_kg).toFixed(1)} kg gesamt`
              : ""
          }
        />
        <Metric
          icon={<Ruler className="h-5 w-5" />}
          label="Bauchumfang"
          value={latest?.waist_cm != null ? `${latest.waist_cm} cm` : "—"}
        />
        <Metric
          icon={<Activity className="h-5 w-5" />}
          label="Einträge"
          value={`${items.length}`}
          delta="Messungen"
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Lade deine Daten…
        </div>
      ) : (
        <WeightProgressChart
          measurements={items}
          goalWeight={goalWeight}
          title="Gewichtsverlauf"
        />
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-3 font-display text-2xl font-bold">{value}</div>
      {delta && <div className="mt-1 text-xs text-muted-foreground">{delta}</div>}
    </div>
  );
}
