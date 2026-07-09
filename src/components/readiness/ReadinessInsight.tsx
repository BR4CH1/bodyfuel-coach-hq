import { HeartPulse, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { readinessSeries, summarize, type ReadinessCheckin } from "@/lib/readiness";

/** Geteilte Readiness-Übersicht — verwendet SoT aus src/lib/readiness. */
export function ReadinessInsight({
  rows,
  tone = "auto",
  compact = false,
}: {
  rows: ReadinessCheckin[];
  tone?: "auto" | "athlete" | "coach";
  compact?: boolean;
}) {
  const s = summarize(rows);
  const series = readinessSeries(rows).slice(-30);

  const bucket =
    s.current == null ? null : s.current >= 70 ? "green" : s.current >= 45 ? "yellow" : "red";
  const bucketClass =
    bucket === "green"
      ? "text-green-500"
      : bucket === "yellow"
        ? "text-orange-400"
        : bucket === "red"
          ? "text-red-500"
          : "text-muted-foreground";

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <HeartPulse className="h-3.5 w-3.5" /> Readiness
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className={`font-display text-4xl font-bold ${bucketClass}`}>
            {s.current ?? "—"}
          </span>
          <span className="text-xs text-muted-foreground">/ 100 · heute</span>
        </div>
        <p className="mt-2 text-sm leading-snug text-foreground">{s.message}</p>

        {series.length >= 2 && <Sparkline points={series} />}

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Kpi label="7-Tage" value={s.avg7} />
          <Kpi label="30-Tage" value={s.avg30} />
          <KpiDelta label="7 vs 30" value={s.delta7v30} />
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-2">
          <SignalCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Beschwerden 7 Tage"
            value={s.pain_events_7 > 0 ? String(s.pain_events_7) : "keine"}
            highlight={s.pain_events_7 >= 2}
          />
          <LoadCard trend={s.load_trend} tone={tone} />
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-center">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-lg font-bold">{value ?? "—"}</div>
    </div>
  );
}

function KpiDelta({ label, value }: { label: string; value: number | null }) {
  const up = (value ?? 0) > 0;
  const cls =
    value == null
      ? "text-muted-foreground"
      : value === 0
        ? "text-muted-foreground"
        : up
          ? "text-green-500"
          : "text-red-500";
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-center">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`font-display text-lg font-bold ${cls}`}>
        {value == null ? "—" : `${up ? "+" : ""}${value}`}
      </div>
    </div>
  );
}

function SignalCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "border-orange-500/40 bg-orange-500/10" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`mt-1 font-display text-lg font-bold ${highlight ? "text-orange-400" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function LoadCard({
  trend,
  tone,
}: {
  trend: "rising" | "falling" | "stable" | null;
  tone: "auto" | "athlete" | "coach";
}) {
  const [icon, label, cls] =
    trend === "rising"
      ? [<TrendingUp className="h-4 w-4" key="u" />, "erhöht", "text-orange-400"]
      : trend === "falling"
        ? [<TrendingDown className="h-4 w-4" key="d" />, "erholend", "text-green-500"]
        : trend === "stable"
          ? [<Minus className="h-4 w-4" key="s" />, "stabil", "text-foreground"]
          : [<Minus className="h-4 w-4" key="n" />, "—", "text-muted-foreground"];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon}
        {tone === "coach" ? "Belastungstrend" : "Belastung"}
      </div>
      <div className={`mt-1 font-display text-lg font-bold ${cls}`}>{label}</div>
    </div>
  );
}

function Sparkline({ points }: { points: Array<{ t: number; v: number }> }) {
  const W = 300;
  const H = 44;
  const min = 0;
  const max = 100;
  const xFor = (i: number) =>
    points.length === 1 ? W / 2 : (i / (points.length - 1)) * W;
  const yFor = (v: number) => H - ((v - min) / (max - min)) * (H - 4) - 2;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(p.v).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-10 w-full text-primary">
      <line x1="0" x2={W} y1={yFor(70)} y2={yFor(70)} className="stroke-green-500/30" strokeDasharray="2 3" />
      <line x1="0" x2={W} y1={yFor(45)} y2={yFor(45)} className="stroke-orange-400/30" strokeDasharray="2 3" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={xFor(i)}
          cy={yFor(p.v)}
          r={i === points.length - 1 ? 3 : 1.5}
          className="fill-current"
        />
      ))}
    </svg>
  );
}
