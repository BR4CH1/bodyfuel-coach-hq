import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsHero } from "@/components/bodyfuel/BullsHero";

import { listBullsWeights, logBullsWeight } from "@/lib/bulls.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/bulls/weight")({
  head: () => ({ meta: [{ title: "Gewichtstracking — Bulls Hub" }] }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <WeightPage />
      </BullsGate>
    </AppLayout>
  ),
});

function WeightPage() {
  const listFn = useServerFn(listBullsWeights);
  const logFn = useServerFn(logBullsWeight);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["bulls-weights"], queryFn: () => listFn() });
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");

  const mut = useMutation({
    mutationFn: () => logFn({ data: { log_date: date, weight_kg: Number(weight) } }),
    onSuccess: () => {
      toast.success("Gewicht gespeichert.");
      setWeight("");
      qc.invalidateQueries({ queryKey: ["bulls-weights"] });
      qc.invalidateQueries({ queryKey: ["bulls-score"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data as { log_date: string; weight_kg: number }[]) ?? [];
  const trend = (() => {
    if (rows.length < 2) return { dir: "flat" as const, diff: 0 };
    const first = Number(rows[0].weight_kg);
    const last = Number(rows[rows.length - 1].weight_kg);
    const diff = last - first;
    return { dir: diff > 0.2 ? "up" : diff < -0.2 ? "down" : "flat", diff };
  })();

  const TrendIcon = trend.dir === "down" ? TrendingDown : trend.dir === "up" ? TrendingUp : Minus;

  return (
    <div className="space-y-6">
      <Link to="/bulls" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red">
        <ArrowLeft className="h-3 w-3" /> Zurück zum Hub
      </Link>
      <BullsHero
        eyebrow="Gewichtstracking"
        title="Gewicht eintragen"
        subtitle="Tracke dein Gewicht 1–3× pro Woche. Der Trend ist wichtiger als einzelne Tage."
      />

      <form
        onSubmit={(e) => { e.preventDefault(); if (!weight) return; mut.mutate(); }}
        className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div className="space-y-2">
          <Label>Datum</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Gewicht (kg)</Label>
          <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <Button type="submit" disabled={mut.isPending} className="bg-gradient-bulls text-white">
          {mut.isPending ? "Speichere…" : "Speichern"}
        </Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lade…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Noch keine Einträge. Trage dein erstes Gewicht ein.
        </p>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">Verlauf</h2>
              <span className="inline-flex items-center gap-1 text-sm text-bulls-red">
                <TrendIcon className="h-4 w-4" />
                {trend.diff > 0 ? "+" : ""}{trend.diff.toFixed(1)} kg
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="log_date" stroke="#999" />
                  <YAxis stroke="#999" domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #333" }} />
                  <Line type="monotone" dataKey="weight_kg" stroke="oklch(0.68 0.24 25)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Datum</th><th className="px-4 py-3">Gewicht</th></tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.log_date} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">{r.log_date}</td>
                    <td className="px-4 py-2 font-display">{Number(r.weight_kg).toFixed(1)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      
    </div>
  );
}
