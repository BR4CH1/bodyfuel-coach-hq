import { useEffect, useMemo, useState } from "react";
import { Sparkles, Trophy, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TASKS, MAX_DAILY_POINTS, type CheckTaskKey } from "@/lib/bodyfuel/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Range = "today" | "yesterday" | "week";

type DCRow = { check_date: string; points: number; tasks: Record<string, boolean> | null };
type PPRow = { training_date: string; kind: string; points: number; exercise_name: string | null };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const KIND_LABEL: Record<string, string> = {
  pr_weight: "PR Gewicht",
  pr_e1rm: "PR e1RM",
  pr_volume: "PR Volumen",
  pr_reps: "PR Reps",
  improvement: "Steigerung",
  streak_7: "7-Tage Streak",
  streak_30: "30-Tage Streak",
};

export function PointsBreakdownCard({ userId }: { userId: string }) {
  const [range, setRange] = useState<Range>("today");
  const [checks, setChecks] = useState<DCRow[]>([]);
  const [perf, setPerf] = useState<PPRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      const startStr = isoDay(start);
      const endStr = isoDay(today);
      const [{ data: dc }, { data: pp }] = await Promise.all([
        supabase
          .from("daily_checks")
          .select("check_date, points, tasks")
          .eq("user_id", userId)
          .gte("check_date", startStr)
          .lte("check_date", endStr),
        supabase
          .from("performance_points")
          .select("training_date, kind, points, exercise_name")
          .eq("user_id", userId)
          .eq("approved", true)
          .gte("training_date", startStr)
          .lte("training_date", endStr),
      ]);
      if (cancelled) return;
      setChecks((dc ?? []) as DCRow[]);
      setPerf((pp ?? []) as PPRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const { dailyPts, perfPts, totalPts, taskState, perfRows, rangeMax } = useMemo(() => {
    const today = new Date();
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);

    let inRange: (d: string) => boolean;
    let rMax: number;
    if (range === "today") {
      const t = isoDay(today);
      inRange = (d) => d === t;
      rMax = MAX_DAILY_POINTS + 10;
    } else if (range === "yesterday") {
      const t = isoDay(yest);
      inRange = (d) => d === t;
      rMax = MAX_DAILY_POINTS + 10;
    } else {
      const s = isoDay(weekStart);
      const e = isoDay(today);
      inRange = (d) => d >= s && d <= e;
      rMax = (MAX_DAILY_POINTS + 10) * 7;
    }

    const dailyRows = checks.filter((c) => inRange(c.check_date));
    const perfInRange = perf.filter((p) => inRange(p.training_date));

    const dPts = dailyRows.reduce((s, r) => s + (r.points || 0), 0);
    const pPts = perfInRange.reduce((s, r) => s + (r.points || 0), 0);

    // Task aggregation (for today/yesterday show booleans, for week show count)
    const state: Record<CheckTaskKey, { done: number; total: number }> = {} as any;
    for (const t of TASKS) state[t.key] = { done: 0, total: dailyRows.length || (range === "week" ? 7 : 1) };
    for (const row of dailyRows) {
      for (const t of TASKS) {
        if (row.tasks && (row.tasks as any)[t.key]) state[t.key].done += 1;
      }
    }

    return {
      dailyPts: dPts,
      perfPts: pPts,
      totalPts: dPts + pPts,
      taskState: state,
      perfRows: perfInRange,
      rangeMax: rMax,
    };
  }, [checks, perf, range]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3.5 w-3.5" /> Punkte-Aufschlüsselung
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-gradient-gold">
              {loading ? "—" : totalPts}
            </span>
            <span className="text-xs text-muted-foreground">/ max {rangeMax}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Tagescheck {dailyPts} · Training {perfPts}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-gold/60 hover:text-gold">
              <Info className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 text-xs">
              <div className="font-display text-sm font-bold">Maximal pro Tag</div>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>Tagescheck: <span className="text-foreground">15 Pkt</span> (alle 7 Aufgaben)</li>
                <li>Training: <span className="text-foreground">10 Pkt</span> (PRs ≤ 6, Steigerung ≤ 4)</li>
                <li className="text-foreground font-semibold pt-1">Regulär max: 25 Pkt / Tag</li>
              </ul>
              <div className="mt-3 border-t border-border pt-2 text-muted-foreground">
                Streak-Boni einmalig: +5 (7-Tage), +15 (30-Tage). Wochen-Cap Training: 25.
              </div>
            </PopoverContent>
          </Popover>

          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="h-8 w-[148px] rounded-lg border-border bg-background/40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Heute</SelectItem>
              <SelectItem value="yesterday">Gestern</SelectItem>
              <SelectItem value="week">Diese Woche</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {/* Tagescheck */}
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Tagescheck</div>
            <div className="text-xs font-semibold text-foreground">
              {dailyPts} <span className="text-muted-foreground">/ {range === "week" ? 105 : 15}</span>
            </div>
          </div>
          <ul className="space-y-1.5">
            {TASKS.map((t) => {
              const s = taskState[t.key];
              const earned = range === "week" ? s.done * t.points : (s.done > 0 ? t.points : 0);
              const max = range === "week" ? 7 * t.points : t.points;
              const pct = max ? (earned / max) * 100 : 0;
              const fully = range === "week" ? s.done === 7 : s.done > 0;
              return (
                <li key={t.key} className="flex items-center gap-2 text-xs">
                  <span className="w-5 text-center">{t.emoji}</span>
                  <span className={"flex-1 truncate " + (fully ? "text-foreground" : "text-muted-foreground")}>
                    {t.label}
                  </span>
                  <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-secondary sm:inline-block">
                    <span
                      className="block h-full bg-gradient-gold transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="tabular-nums text-[11px] font-semibold text-foreground">
                    {earned}
                    <span className="text-muted-foreground">/{max}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Performance */}
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Training</div>
            <div className="text-xs font-semibold text-foreground">
              {perfPts} <span className="text-muted-foreground">/ {range === "week" ? 25 : 10}</span>
            </div>
          </div>
          {perfRows.length === 0 ? (
            <div className="flex h-[calc(100%-2rem)] min-h-[120px] flex-col items-center justify-center gap-1 text-center">
              <Trophy className="h-5 w-5 text-muted-foreground/60" />
              <div className="text-xs text-muted-foreground">Noch keine Trainings-Punkte</div>
              <div className="text-[10px] text-muted-foreground/70">PRs & Steigerungen werden hier gezählt</div>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {perfRows.slice(0, 6).map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-gold/15 text-[10px] text-gold">
                    +{r.points}
                  </span>
                  <span className="flex-1 truncate text-foreground">
                    {KIND_LABEL[r.kind] ?? r.kind}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {r.exercise_name ?? ""}
                  </span>
                </li>
              ))}
              {perfRows.length > 6 && (
                <li className="pt-1 text-[11px] text-muted-foreground">
                  + {perfRows.length - 6} weitere
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
