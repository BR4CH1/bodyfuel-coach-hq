import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  type SetLog,
  type Metric,
  type WindowKey,
  WINDOWS,
  groupByDay,
  filterByWindow,
  computePRs,
} from "@/lib/training-analytics";

const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: "weight", label: "Gewicht", unit: "kg" },
  { key: "e1rm", label: "e1RM", unit: "kg" },
  { key: "volume", label: "Volumen", unit: "kg" },
];

export function ExerciseAnalytics({ logs }: { logs: SetLog[] }) {
  const [metric, setMetric] = useState<Metric>("e1rm");
  const [win, setWin] = useState<WindowKey>("12w");

  const allPoints = useMemo(() => groupByDay(logs), [logs]);
  const points = useMemo(() => filterByWindow(allPoints, win), [allPoints, win]);
  const prs = useMemo(() => computePRs(allPoints), [allPoints]);

  if (allPoints.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-[11px] text-muted-foreground">
        Noch keine Trainingsdaten — sobald Sätze geloggt sind, erscheint hier deine Entwicklung.
      </div>
    );
  }

  const current = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const metricLabel = METRICS.find((m) => m.key === metric)!;
  const currentVal = current ? (current[metric] as number) : 0;
  const prevVal = previous ? (previous[metric] as number) : null;
  const delta = prevVal != null ? currentVal - prevVal : null;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md border border-border bg-card p-0.5 text-[10px]">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded px-2 py-1 ${
                metric === m.key
                  ? "bg-gradient-gold text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1 rounded-md border border-border bg-card p-0.5 text-[10px]">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWin(w.key)}
              className={`rounded px-2 py-1 ${
                win === w.key
                  ? "bg-secondary text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {points.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-muted-foreground">
          Keine Einträge in diesem Zeitraum.
        </div>
      ) : (
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickFormatter={(d) => d.slice(5).replace("-", ".")}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} width={36} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v} ${metricLabel.unit}`, metricLabel.label]}
                labelFormatter={(l) => new Date(l).toLocaleDateString("de-DE")}
              />
              <Line
                type="monotone"
                dataKey={metric}
                stroke="hsl(var(--gold, 45 95% 55%))"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Comparison */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Stat
          label="Aktuell"
          value={current ? `${formatVal(current, metric)}` : "—"}
          sub={current ? `${current.weight} kg × ${current.reps}` : ""}
        />
        <Stat
          label="Letztes Mal"
          value={previous ? `${formatVal(previous, metric)}` : "—"}
          sub={previous ? new Date(previous.date).toLocaleDateString("de-DE") : ""}
        />
        <Stat
          label="Δ"
          value={
            delta == null ? "—" : `${delta > 0 ? "+" : ""}${Math.round(delta * 10) / 10} ${metricLabel.unit}`
          }
          icon={
            delta == null ? (
              <Minus className="h-3 w-3" />
            ) : delta > 0 ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ) : delta < 0 ? (
              <TrendingDown className="h-3 w-3 text-red-500" />
            ) : (
              <Minus className="h-3 w-3 text-amber-500" />
            )
          }
        />
      </div>

      {/* PRs */}
      <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
        <PR icon="🏆" label="Max Gewicht" v={prs.maxWeight ? `${prs.maxWeight.weight} kg` : "—"} />
        <PR icon="🏆" label="Max e1RM" v={prs.maxE1rm ? `${prs.maxE1rm.e1rm} kg` : "—"} />
        <PR icon="🏆" label="Max Volumen" v={prs.maxVolume ? `${prs.maxVolume.volume} kg` : "—"} />
        <PR icon="🏆" label="Beste Wdh." v={prs.maxReps ? `${prs.maxReps.reps}` : "—"} />
      </div>
    </div>
  );
}

function formatVal(p: { weight: number; e1rm: number; volume: number }, m: Metric) {
  const v = p[m];
  return `${Math.round(v * 10) / 10} kg`;
}

function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-card/60 p-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-display text-sm font-bold">{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PR({ icon, label, v }: { icon: string; label: string; v: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/5 px-2 py-1">
      <Trophy className="h-3 w-3 text-gold" />
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
          {icon} {label}
        </div>
        <div className="truncate text-[11px] font-semibold">{v}</div>
      </div>
    </div>
  );
}
