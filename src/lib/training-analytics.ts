// Pure helpers for training analytics: e1RM, PR, trend classification.

export type SetLog = {
  id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  performed_at: string;
};

export type Metric = "weight" | "e1rm" | "volume";

export type SessionPoint = {
  date: string; // YYYY-MM-DD
  weight: number; // best set weight that day
  reps: number; // reps of that best set
  e1rm: number;
  volume: number; // sum of weight*reps across all sets that day
  sets: number;
};

export const epley = (weight: number, reps: number) =>
  reps > 0 ? weight * (1 + reps / 30) : weight;

export function groupByDay(logs: SetLog[]): SessionPoint[] {
  const byDay = new Map<string, SetLog[]>();
  for (const l of logs) {
    if (l.weight_kg == null || l.reps == null) continue;
    const d = l.performed_at.slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(l);
  }
  const out: SessionPoint[] = [];
  for (const [date, daily] of byDay) {
    let bestE = 0;
    let bestW = 0;
    let bestReps = 0;
    let volume = 0;
    for (const s of daily) {
      const w = Number(s.weight_kg);
      const r = Number(s.reps);
      volume += w * r;
      const e = epley(w, r);
      if (e > bestE) {
        bestE = e;
        bestW = w;
        bestReps = r;
      }
    }
    out.push({
      date,
      weight: bestW,
      reps: bestReps,
      e1rm: Math.round(bestE * 10) / 10,
      volume: Math.round(volume),
      sets: daily.length,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export type WindowKey = "4w" | "12w" | "6m" | "all";
export const WINDOWS: { key: WindowKey; label: string; days: number | null }[] = [
  { key: "4w", label: "4 Wochen", days: 28 },
  { key: "12w", label: "12 Wochen", days: 84 },
  { key: "6m", label: "6 Monate", days: 183 },
  { key: "all", label: "Gesamt", days: null },
];

export function filterByWindow(points: SessionPoint[], win: WindowKey): SessionPoint[] {
  const cfg = WINDOWS.find((w) => w.key === win)!;
  if (cfg.days == null) return points;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cfg.days);
  const c = cutoff.toISOString().slice(0, 10);
  return points.filter((p) => p.date >= c);
}

export type PRs = {
  maxWeight: SessionPoint | null;
  maxE1rm: SessionPoint | null;
  maxVolume: SessionPoint | null;
  maxReps: SessionPoint | null;
};
export function computePRs(points: SessionPoint[]): PRs {
  if (!points.length) return { maxWeight: null, maxE1rm: null, maxVolume: null, maxReps: null };
  const by = (k: keyof SessionPoint) =>
    points.reduce((best, p) => ((p[k] as number) > (best[k] as number) ? p : best), points[0]);
  return {
    maxWeight: by("weight"),
    maxE1rm: by("e1rm"),
    maxVolume: by("volume"),
    maxReps: by("reps"),
  };
}

export type Trend = "improving" | "stagnating" | "regressing" | "insufficient";

// Compare avg e1RM of latest half vs earlier half within window.
export function classifyTrend(points: SessionPoint[]): Trend {
  if (points.length < 2) return "insufficient";
  const half = Math.max(1, Math.floor(points.length / 2));
  const earlier = points.slice(0, points.length - half);
  const recent = points.slice(points.length - half);
  if (!earlier.length || !recent.length) return "insufficient";
  const avg = (a: SessionPoint[]) => a.reduce((s, p) => s + p.e1rm, 0) / a.length;
  const e0 = avg(earlier);
  const e1 = avg(recent);
  if (e0 <= 0) return "insufficient";
  const pct = (e1 - e0) / e0;
  if (pct > 0.02) return "improving";
  if (pct < -0.02) return "regressing";
  return "stagnating";
}

export const TREND_META: Record<
  Trend,
  { label: string; color: string; emoji: string }
> = {
  improving: { label: "Verbessert", color: "text-emerald-500", emoji: "✅" },
  stagnating: { label: "Unverändert", color: "text-amber-500", emoji: "⚠️" },
  regressing: { label: "Rückläufig", color: "text-red-500", emoji: "🔻" },
  insufficient: { label: "Zu wenig Daten", color: "text-muted-foreground", emoji: "·" },
};
