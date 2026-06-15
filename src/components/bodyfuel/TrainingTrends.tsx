import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Minus, Dumbbell, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  classifyTrend,
  filterByWindow,
  groupByDay,
  type SetLog,
  type Trend,
  type WindowKey,
  WINDOWS,
} from "@/lib/training-analytics";
import { normalizeExerciseName } from "@/lib/exercise-name-match";

type ExerciseRow = { id: string; name: string; day_id: string };
type DayRow = { id: string; name: string };

export type ExerciseTrend = {
  exercise: ExerciseRow;
  day: DayRow | null;
  trend: Trend;
};

async function fetchTrends(clientId: string, win: WindowKey): Promise<ExerciseTrend[]> {
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("client_id", clientId)
    .eq("plan_type", "training")
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return [];
  const { data: days } = await supabase
    .from("training_days")
    .select("id, name")
    .eq("plan_id", plan.id);
  const dayList = (days as DayRow[]) ?? [];
  if (!dayList.length) return [];
  const { data: exes } = await supabase
    .from("training_exercises")
    .select("id, name, day_id")
    .in("day_id", dayList.map((d) => d.id));
  const exList = (exes as ExerciseRow[]) ?? [];
  if (!exList.length) return [];

  // Include historic exercises across all of this client's training plans
  // so trend analysis covers data from prior plans when names match.
  const { data: histPlans } = await supabase
    .from("nutrition_plans")
    .select("id, training_days(id, training_exercises(id, name))")
    .eq("client_id", clientId)
    .eq("plan_type", "training");
  const histExercises: { id: string; name: string }[] = [];
  for (const p of (histPlans as any[]) ?? []) {
    for (const d of p?.training_days ?? []) {
      for (const e of d?.training_exercises ?? []) {
        if (e?.id && e?.name) histExercises.push({ id: e.id, name: e.name });
      }
    }
  }
  const allIds = Array.from(new Set(histExercises.map((h) => h.id).concat(exList.map((e) => e.id))));
  const { data: logs } = await supabase
    .from("training_set_logs")
    .select("id, exercise_id, set_number, weight_kg, reps, performed_at")
    .in("exercise_id", allIds)
    .eq("client_id", clientId);
  const logList = (logs as SetLog[]) ?? [];

  const dayMap = new Map(dayList.map((d) => [d.id, d]));
  // For each current exercise, collect logs whose exercise_id matches OR
  // whose historic exercise normalizes to the same name.
  const histById = new Map(histExercises.map((h) => [h.id, normalizeExerciseName(h.name)]));
  return exList.map((e) => {
    const targetName = normalizeExerciseName(e.name);
    const exLogs = logList.filter(
      (l) => l.exercise_id === e.id || histById.get(l.exercise_id) === targetName,
    );
    const pts = filterByWindow(groupByDay(exLogs), win);
    return { exercise: e, day: dayMap.get(e.day_id) ?? null, trend: classifyTrend(pts) };
  });
}

export function useExerciseTrends(clientId: string | undefined, win: WindowKey = "12w") {
  const [data, setData] = useState<ExerciseTrend[] | null>(null);
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    fetchTrends(clientId, win).then((r) => {
      if (!cancelled) setData(r);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, win]);
  return data;
}

export function TrainingDevelopmentCard({ clientId }: { clientId: string }) {
  const trends = useExerciseTrends(clientId, "12w");
  if (!trends) return null;
  if (trends.length === 0) return null;

  const improving = trends.filter((t) => t.trend === "improving").length;
  const stagnating = trends.filter((t) => t.trend === "stagnating").length;
  const regressing = trends.filter((t) => t.trend === "regressing").length;
  const insufficient = trends.filter((t) => t.trend === "insufficient").length;

  return (
    <Link
      to="/training"
      className="block rounded-2xl border border-border bg-card p-5 transition hover:border-gold/40"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gold">
          <Dumbbell className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Trainingsentwicklung</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Mini icon={<TrendingUp className="h-4 w-4" />} color="text-emerald-500" n={improving} label="verbessert" />
        <Mini icon={<Minus className="h-4 w-4" />} color="text-amber-500" n={stagnating} label="unverändert" />
        <Mini icon={<TrendingDown className="h-4 w-4" />} color="text-red-500" n={regressing} label="rückläufig" />
      </div>
      {insufficient > 0 && (
        <div className="mt-2 text-[10px] text-muted-foreground">
          {insufficient} Übungen mit zu wenig Daten
        </div>
      )}
    </Link>
  );
}

function Mini({
  icon,
  color,
  n,
  label,
}: {
  icon: React.ReactNode;
  color: string;
  n: number;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-2">
      <div className={`flex items-center justify-center gap-1 ${color}`}>
        {icon}
        <span className="font-display text-lg font-bold">{n}</span>
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function CoachTrainingSummary({ clientId }: { clientId: string }) {
  const [win, setWin] = useState<WindowKey>("12w");
  const trends = useExerciseTrends(clientId, win);
  if (!trends) return null;
  if (trends.length === 0)
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Noch keine Trainingsdaten für die Auswertung.
      </div>
    );

  const groups: { key: Trend; title: string; color: string; emoji: string }[] = [
    { key: "improving", title: "Verbessert", color: "text-emerald-500", emoji: "✅" },
    { key: "stagnating", title: "Stagniert", color: "text-amber-500", emoji: "⚠️" },
    { key: "regressing", title: "Rückläufig", color: "text-red-500", emoji: "🔻" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold">Trainingsanalyse</h3>
        <div className="flex gap-1 rounded-md border border-border bg-background p-0.5 text-[10px]">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWin(w.key)}
              className={`rounded px-2 py-1 ${
                win === w.key ? "bg-secondary font-semibold" : "text-muted-foreground"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {groups.map((g) => {
          const items = trends.filter((t) => t.trend === g.key);
          return (
            <div key={g.key}>
              <div className={`flex items-center gap-1 text-xs font-semibold ${g.color}`}>
                <span>{g.emoji}</span> {g.title} ({items.length})
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {items.length === 0 && <li className="text-muted-foreground">—</li>}
                {items.map((t) => (
                  <li key={t.exercise.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{t.exercise.name}</span>
                    {t.day && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {t.day.name}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
