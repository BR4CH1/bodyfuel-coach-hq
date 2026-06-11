import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, Plus, Scale, Ruler } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/progress")({
  head: () => ({ meta: [{ title: "Fortschritt — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <ProgressContent />
    </AppLayout>
  ),
});

function ProgressContent() {
  const { user } = useSession();
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  if (!user) return null;

  const data = user.weightHistory.map((w) => ({
    date: new Date(w.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
    Gewicht: w.weight,
    Bauchumfang: w.waist,
  }));

  const latest = user.weightHistory[user.weightHistory.length - 1];
  const first = user.weightHistory[0];

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight) return;
    user.weightHistory.push({
      date: new Date().toISOString().slice(0, 10),
      weight: parseFloat(weight),
      waist: waist ? parseFloat(waist) : undefined,
    });
    setWeight("");
    setWaist("");
    toast.success("Messung gespeichert");
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fortschritt</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Deine Entwicklung</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric
          icon={<Scale className="h-5 w-5" />}
          label="Aktuelles Gewicht"
          value={`${latest.weight} kg`}
          delta={`${(latest.weight - first.weight).toFixed(1)} kg`}
          positive={latest.weight <= first.weight}
        />
        <Metric
          icon={<Ruler className="h-5 w-5" />}
          label="Bauchumfang"
          value={`${latest.waist} cm`}
          delta={`${(((latest.waist ?? 0) - (first.waist ?? 0))).toFixed(1)} cm`}
          positive={(latest.waist ?? 0) <= (first.waist ?? 0)}
        />
        <Metric
          icon={<Camera className="h-5 w-5" />}
          label="Fortschrittsfotos"
          value={`${user.photos.length}`}
          delta="hochgeladen"
        />
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Verlauf</h2>
          <div className="flex gap-3 text-xs">
            <Legend color="var(--gold)" label="Gewicht (kg)" />
            <Legend color="var(--success)" label="Bauchumfang (cm)" />
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="Gewicht"
                stroke="var(--gold)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--gold)" }}
              />
              <Line
                type="monotone"
                dataKey="Bauchumfang"
                stroke="var(--success)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* New entry */}
      <form
        onSubmit={save}
        className="rounded-2xl border border-border bg-card p-5 sm:p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">Neue Messung</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <Label>Gewicht (kg)</Label>
            <Input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="z.B. 84.5"
            />
          </div>
          <div className="space-y-2">
            <Label>Bauchumfang (cm)</Label>
            <Input
              type="number"
              step="0.1"
              value={waist}
              onChange={(e) => setWaist(e.target.value)}
              placeholder="z.B. 78"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90 sm:w-auto"
            >
              <Plus className="mr-1 h-4 w-4" /> Speichern
            </Button>
          </div>
        </div>
      </form>

      {/* Photos */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Fortschrittsfotos</h2>
          <button
            onClick={() => toast("Foto-Upload (Demo)")}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-accent"
          >
            <Camera className="h-4 w-4" /> Hochladen
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {user.photos.map((p, i) => (
            <div
              key={i}
              className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-gradient-to-br from-secondary to-background"
            >
              <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                <Camera className="h-10 w-10 opacity-30" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="text-xs font-semibold">{p.label}</div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(p.date).toLocaleDateString("de-DE")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  delta,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-gold">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-3 font-display text-2xl font-bold">{value}</div>
      <div className={`mt-1 text-xs ${positive ? "text-success" : "text-muted-foreground"}`}>
        {delta}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
