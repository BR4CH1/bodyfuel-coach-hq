import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { CoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";

export const STATUS_TONE: Record<CoachAthleteDetail["status"]["key"], string> = {
  critical: "bg-red-500/15 text-red-500 border-red-500/30",
  attention: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  watch: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  stable: "bg-muted text-muted-foreground border-border",
  positive: "bg-green-500/15 text-green-500 border-green-500/30",
};

export function fmtPct(v: number | null) {
  return v == null ? "—" : `${v} %`;
}

export function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-lg font-bold text-primary">
      {initials || "?"}
    </div>
  );
}

export function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export function TrendChip({ delta, suffix }: { delta: number; suffix: string }) {
  if (delta === 0) {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        <Minus className="h-3 w-3" /> ±0{suffix}
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        up ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
      }`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}
      {delta}
      {suffix}
    </span>
  );
}

export function PulseCell({
  label,
  value,
  delta,
  suffix,
}: {
  label: string;
  value: string;
  delta: number | null;
  suffix: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 font-display text-lg font-bold">{value}</div>
      {delta != null && <TrendChip delta={delta} suffix={suffix} />}
    </div>
  );
}

export function MetricRow({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </div>
      <div className="font-display text-lg font-bold">{value}</div>
    </div>
  );
}

export function TinyStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "yellow" | "red";
}) {
  const cls =
    tone === "green"
      ? "text-green-500"
      : tone === "yellow"
      ? "text-orange-400"
      : tone === "red"
      ? "text-red-500"
      : "";
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 text-center">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`font-display text-lg font-bold ${cls}`}>{value}</div>
    </div>
  );
}

export function TinyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-display text-lg font-bold">{value}</div>
    </div>
  );
}

export function MiniLine({
  label,
  unit,
  points,
  trend,
  trendLabel,
}: {
  label: string;
  unit: string;
  points: Array<{ t: number; v: number }>;
  trend: number | null;
  trendLabel: string;
}) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Keine Daten im Zeitraum.</div>
      </div>
    );
  }
  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const spread = Math.max(0.1, max - min);
  const W = 300;
  const H = 60;
  const xFor = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const yFor = (v: number) => H - ((v - min) / spread) * (H - 4) - 2;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(p.v).toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </div>
          <div className="font-display text-lg font-bold">
            {last.v.toFixed(1)} {unit}
          </div>
        </div>
        {trend != null && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Trend {trendLabel}
            </div>
            <div className="text-sm font-bold">
              {trend > 0 ? "↑ +" : trend < 0 ? "↓ " : "→ "}
              {Math.abs(trend).toFixed(1)} {unit}
            </div>
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.v)}
            r={i === 0 || i === points.length - 1 ? 2.5 : 1.5}
            className="fill-primary"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>
          {new Date(first.t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ·{" "}
          {first.v.toFixed(1)} {unit}
        </span>
        <span>
          {new Date(last.t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ·{" "}
          {last.v.toFixed(1)} {unit}
        </span>
      </div>
    </div>
  );
}
