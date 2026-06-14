import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

type Measurement = { measured_at: string; weight_kg: number | null };

export function WeightProgressChart({
  measurements,
  goalWeight,
  title = "Gewichtsverlauf",
  emptyHint = "Sobald du dein erstes Gewicht einträgst, siehst du hier deine Entwicklung.",
}: {
  measurements: Measurement[];
  goalWeight?: number | null;
  title?: string;
  emptyHint?: string;
}) {
  // Filter + sort ascending by date
  const points = (measurements ?? [])
    .filter((m) => m.weight_kg != null)
    .map((m) => ({
      date: m.measured_at,
      ts: new Date(m.measured_at).getTime(),
      weight: Number(m.weight_kg),
    }))
    .sort((a, b) => a.ts - b.ts);

  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  const first = points[0];
  const latest = points[points.length - 1];
  const totalDelta = +(latest.weight - first.weight).toFixed(1);
  const totalDays = Math.max(
    1,
    Math.round((latest.ts - first.ts) / 86400000),
  );

  const within = (days: number) => {
    const cutoff = latest.ts - days * 86400000;
    const ref = [...points].reverse().find((p) => p.ts <= cutoff);
    return ref ? +(latest.weight - ref.weight).toFixed(1) : null;
  };
  const delta7 = within(7);
  const delta30 = within(30);

  const goalDelta =
    goalWeight != null ? +(latest.weight - goalWeight).toFixed(1) : null;

  // Min/Max for nicer y-axis
  const weights = points.map((p) => p.weight);
  const minW = Math.min(...weights, goalWeight ?? Infinity);
  const maxW = Math.max(...weights, goalWeight ?? -Infinity);
  const pad = Math.max(0.5, (maxW - minW) * 0.1);
  const yDomain: [number, number] = [
    Math.floor((minW - pad) * 10) / 10,
    Math.ceil((maxW + pad) * 10) / 10,
  ];

  const chartData = points.map((p) => ({
    label: new Date(p.date).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
    }),
    Gewicht: p.weight,
  }));

  // Verbal summary
  let summary: string;
  if (points.length === 1) {
    summary = `Erster Eintrag mit ${latest.weight} kg gespeichert. Trag in den nächsten Tagen weitere Werte ein – dann siehst du hier deine Entwicklung.`;
  } else {
    const dir =
      totalDelta < -0.2
        ? "abgenommen"
        : totalDelta > 0.2
          ? "zugenommen"
          : "dein Gewicht stabil gehalten";
    const abs = Math.abs(totalDelta).toFixed(1);
    summary =
      totalDelta === 0 || dir === "dein Gewicht stabil gehalten"
        ? `Du hast in den letzten ${totalDays} Tagen ${dir}.`
        : `Du hast in den letzten ${totalDays} Tagen ${abs} kg ${dir} (von ${first.weight} kg auf ${latest.weight} kg).`;

    if (goalWeight != null) {
      const remaining = +(latest.weight - goalWeight).toFixed(1);
      if (Math.abs(remaining) < 0.3) {
        summary += ` Du bist quasi an deinem Wunschgewicht (${goalWeight} kg) angekommen 🎯`;
      } else if (remaining > 0) {
        summary += ` Noch ${remaining.toFixed(1)} kg bis zu deinem Wunschgewicht von ${goalWeight} kg.`;
      } else {
        summary += ` Du liegst ${Math.abs(remaining).toFixed(1)} kg unter deinem Wunschgewicht von ${goalWeight} kg.`;
      }
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <DeltaBadge value={totalDelta} />
      </div>

      <p className="mb-4 text-sm text-foreground/90">{summary}</p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Aktuell" value={`${latest.weight} kg`} />
        <Stat
          label="Letzte 7 Tage"
          value={delta7 == null ? "—" : `${delta7 > 0 ? "+" : ""}${delta7} kg`}
          tone={tone(delta7)}
        />
        <Stat
          label="Letzte 30 Tage"
          value={delta30 == null ? "—" : `${delta30 > 0 ? "+" : ""}${delta30} kg`}
          tone={tone(delta30)}
        />
        <Stat
          label={goalWeight != null ? "Zum Ziel" : "Gesamt"}
          value={
            goalWeight != null
              ? `${goalDelta! > 0 ? "+" : ""}${goalDelta} kg`
              : `${totalDelta > 0 ? "+" : ""}${totalDelta} kg`
          }
          tone={tone(goalWeight != null ? goalDelta : totalDelta)}
        />
      </div>

      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              domain={yDomain}
              tickFormatter={(v: number) => `${v}`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number) => [`${v} kg`, "Gewicht"]}
            />
            {goalWeight != null && (
              <ReferenceLine
                y={goalWeight}
                stroke="var(--primary)"
                strokeDasharray="4 4"
                label={{
                  value: `Ziel ${goalWeight} kg`,
                  position: "insideTopRight",
                  fill: "var(--primary)",
                  fontSize: 10,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="Gewicht"
              stroke="var(--primary)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--primary)" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function tone(v: number | null): "up" | "down" | "flat" | undefined {
  if (v == null) return undefined;
  if (v > 0.1) return "up";
  if (v < -0.1) return "down";
  return "flat";
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "flat";
}) {
  const color =
    tone === "down"
      ? "text-emerald-600"
      : tone === "up"
        ? "text-amber-600"
        : tone === "flat"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" /> stabil
      </span>
    );
  }
  const isDown = value < 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        isDown
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      }`}
    >
      {isDown ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
      {value > 0 ? "+" : ""}
      {value.toFixed(1)} kg gesamt
    </span>
  );
}
