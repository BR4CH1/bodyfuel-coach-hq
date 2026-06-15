import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Plus, ChevronDown, ChevronRight, Trash2, Loader2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { parseTrainingPlan, logSet, deleteSetLog } from "@/lib/training.functions";
import { ExerciseAnalytics } from "./ExerciseAnalytics";


type Plan = { id: string; client_id: string; title: string };
type Day = { id: string; name: string; sort_order: number };
type Exercise = {
  id: string;
  day_id: string;
  name: string;
  target_sets: number | null;
  target_reps: string | null;
  notes: string | null;
  sort_order: number;
};
type SetLog = {
  id: string;
  exercise_id: string;
  client_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  performed_at: string;
};

export function TrainingTracker({ clientId }: { clientId: string }) {
  const { isCoach, supabaseUser } = useSession();
  const parseFn = useServerFn(parseTrainingPlan);
  const logFn = useServerFn(logSet);
  const deleteLogFn = useServerFn(deleteSetLog);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data: planRow } = await supabase
      .from("nutrition_plans")
      .select("id, client_id, title")
      .eq("client_id", clientId)
      .eq("plan_type", "training")
      .eq("is_active", true)
      .maybeSingle();
    setPlan((planRow as Plan) ?? null);

    if (!planRow) {
      setDays([]);
      setExercises([]);
      setLogs([]);
      setLoading(false);
      return;
    }
    const { data: dayRows } = await supabase
      .from("training_days")
      .select("*")
      .eq("plan_id", planRow.id)
      .order("sort_order");
    const dayList = (dayRows as Day[]) ?? [];
    setDays(dayList);
    setOpenDay((cur) => cur ?? dayList[0]?.id ?? null);

    if (dayList.length) {
      const { data: exRows } = await supabase
        .from("training_exercises")
        .select("*")
        .in("day_id", dayList.map((d) => d.id))
        .order("sort_order");
      const exList = (exRows as Exercise[]) ?? [];
      setExercises(exList);

      if (exList.length) {
        const { data: logRows } = await supabase
          .from("training_set_logs")
          .select("*")
          .in("exercise_id", exList.map((e) => e.id))
          .eq("client_id", clientId)
          .order("performed_at", { ascending: false })
          .limit(500);
        setLogs((logRows as SetLog[]) ?? []);
      } else {
        setLogs([]);
      }
    } else {
      setExercises([]);
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Sync open day with PlanContentView selection (top of /training page).
  // PlanContentView writes the active virtual-day NAME to localStorage and
  // dispatches "bf:training-active-day" when the user picks a day.
  useEffect(() => {
    if (!days.length) return;
    const key = `bf:training:active-day-name:${clientId}`;
    const applyName = (name: string | null) => {
      if (!name) return;
      const norm = name.trim().toLowerCase();
      const hit = days.find(
        (d) => d.name.trim().toLowerCase() === norm || norm.includes(d.name.trim().toLowerCase()) || d.name.trim().toLowerCase().includes(norm),
      );
      if (hit) setOpenDay(hit.id);
    };
    try { applyName(localStorage.getItem(key)); } catch {}
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent<{ clientId: string; name: string }>).detail;
      if (detail?.clientId === clientId) applyName(detail.name);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) applyName(e.newValue);
    };
    window.addEventListener("bf:training-active-day", onEvt as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("bf:training-active-day", onEvt as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [days, clientId]);


  const extract = async () => {
    if (!plan) return;
    setParsing(true);
    try {
      const res = await parseFn({ data: { plan_id: plan.id } });
      toast.success(`${res.exercises} Übungen aus ${res.days} Tagen extrahiert.`);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Extraktion fehlgeschlagen");
    } finally {
      setParsing(false);
    }
  };

  if (!supabaseUser) return null;
  if (loading)
    return <div className="text-sm text-muted-foreground">Lade Übungen...</div>;
  if (!plan)
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Noch kein aktiver Trainingsplan vorhanden.
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Übungen tracken</h2>
        {isCoach && (
          <button
            onClick={extract}
            disabled={parsing}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {days.length ? "Neu aus PDF extrahieren" : "Übungen aus PDF extrahieren"}
          </button>
        )}
      </div>

      {!days.length && (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {isCoach
            ? "Klick auf „Übungen extrahieren“, damit Tage und Übungen aus dem PDF gelesen werden."
            : "Dein Coach hat die Übungen noch nicht freigeschaltet."}
        </div>

      )}

      {days.map((d) => {
        const open = openDay === d.id;
        const dayEx = exercises.filter((e) => e.day_id === d.id);
        return (
          <div key={d.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            <button
              onClick={() => setOpenDay(open ? null : d.id)}
              className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
            >
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-gold">Trainingstag</div>
                <div className="font-display text-base font-bold">{d.name}</div>
                <div className="text-[11px] text-muted-foreground">{dayEx.length} Übungen</div>
              </div>
              {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
            {open && (
              <div className="border-t border-border p-4 space-y-3">
                {dayEx.length === 0 && (
                  <div className="text-xs text-muted-foreground">Keine Übungen.</div>
                )}
                {dayEx.map((ex) => (
                  <ExerciseCard
                    key={ex.id}
                    ex={ex}
                    logs={logs.filter((l) => l.exercise_id === ex.id)}
                    onLog={async (set_number, weight_kg, reps) => {
                      try {
                        const row = await logFn({
                          data: { exercise_id: ex.id, set_number, weight_kg, reps },
                        });
                        setLogs((cur) => [row as SetLog, ...cur]);
                        toast.success("Gespeichert");
                        // Auto-check the daily "Training" task
                        try {
                          const date = new Date().toISOString().slice(0, 10);
                          const { data: existing } = await supabase
                            .from("daily_checks")
                            .select("id, tasks, points")
                            .eq("user_id", clientId)
                            .eq("check_date", date)
                            .maybeSingle();
                          const tasks: Record<string, boolean> = { ...((existing?.tasks as Record<string, boolean>) ?? {}), training: true };
                          const { TASKS } = await import("@/lib/bodyfuel/data");
                          const points = TASKS.reduce((s, t) => s + (tasks[t.key] ? t.points : 0), 0);
                          await supabase.from("daily_checks").upsert(
                            { user_id: clientId, check_date: date, tasks, points },
                            { onConflict: "user_id,check_date" },
                          );
                        } catch {}
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "Fehler");
                      }
                    }}

                    onDelete={async (id) => {
                      try {
                        await deleteLogFn({ data: { id } });
                        setLogs((cur) => cur.filter((l) => l.id !== id));
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "Fehler");
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExerciseCard({
  ex,
  logs,
  onLog,
  onDelete,
}: {
  ex: Exercise;
  logs: SetLog[];
  onLog: (set_number: number, weight_kg: number | null, reps: number | null) => void;
  onDelete: (id: string) => void;
}) {
  const targetSets = ex.target_sets ?? 3;
  const lastSession = logs[0]?.performed_at?.slice(0, 10);
  const todaysLogs = logs.filter(
    (l) => l.performed_at.slice(0, 10) === new Date().toISOString().slice(0, 10),
  );
  const previousLogs = logs.filter(
    (l) => l.performed_at.slice(0, 10) !== new Date().toISOString().slice(0, 10),
  );

  const nextSet = (todaysLogs.length ?? 0) + 1;
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const isPerSide = /kurzhantel|dumbbell|\bkh\b|\bdb\b|einarmig|one[- ]?arm|single[- ]?arm/i.test(
    `${ex.name} ${ex.notes ?? ""}`,
  );
  const weightHint = isPerSide ? "pro Seite" : "Gesamtgewicht";

  // Suggest last weight + planned reps as defaults — only when inputs are empty
  // and only when the previous suggestion changes (no stale traps).
  useEffect(() => {
    if (!weight && logs[0]?.weight_kg != null) {
      setWeight(String(logs[0].weight_kg).replace(".", ","));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs[0]?.id]);
  useEffect(() => {
    if (!reps) {
      const planned = ex.target_reps?.split(/[,|]/)[Math.min(nextSet - 1, (ex.target_reps?.split(/[,|]/).length ?? 1) - 1)]?.trim() ?? ex.target_reps?.split(/[-–]/)[0];
      const n = planned ? planned.match(/\d+/)?.[0] : "";
      if (n) setReps(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextSet, ex.target_reps]);

  const save = () => {
    const w = weight.trim() === "" ? null : Number(weight.replace(",", "."));
    const r = reps.trim() === "" ? null : Number(reps);
    if (w !== null && (Number.isNaN(w) || w < 0)) return toast.error("Gewicht ungültig");
    if (r !== null && (Number.isNaN(r) || r < 0)) return toast.error("Wdh. ungültig");
    onLog(nextSet, w, r);
    // Clear so the next set starts fresh and prefill logic refills cleanly.
    setReps("");
  };


  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{ex.name}</div>
          <div className="text-[11px] text-muted-foreground">
            Soll: {ex.target_sets ?? "?"} × {ex.target_reps ?? "?"}
            {ex.notes ? ` · ${ex.notes}` : ""}
          </div>
          <div className={`mt-0.5 text-[10px] font-medium ${isPerSide ? "text-primary" : "text-muted-foreground/80"}`}>
            ⚖️ Gewicht {weightHint}
          </div>
        </div>
      </div>

      {/* Today's sets */}
      <div className="mt-3 grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 text-xs">
        {Array.from({ length: Math.max(targetSets, todaysLogs.length) }).map((_, i) => {
          const setNum = i + 1;
          const log = todaysLogs.find((l) => l.set_number === setNum);
          return (
            <div key={setNum} className="contents">
              <div className="text-muted-foreground">Satz {setNum}</div>
              <div>
                {log ? (
                  <span className="rounded bg-secondary px-2 py-1 font-medium">
                    {log.weight_kg ?? "—"} kg
                  </span>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </div>
              <div>
                {log ? (
                  <span className="rounded bg-secondary px-2 py-1 font-medium">
                    {log.reps ?? "—"} Wdh.
                  </span>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </div>
              <div>
                {log && (
                  <button
                    onClick={() => onDelete(log.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick add */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">+ Satz {nextSet}</span>
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9.,]*"
          value={weight}
          onChange={(e) => setWeight(e.target.value.replace(/[^0-9.,]/g, ""))}
          placeholder="kg"
          className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={reps}
          onChange={(e) => setReps(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Wdh."
          className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />

        <button
          onClick={save}
          className="inline-flex items-center gap-1 rounded-md bg-gradient-gold px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Eintrag
        </button>
      </div>

      {previousLogs.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] text-muted-foreground">
            Verlauf ({previousLogs.length}) · zuletzt {lastSession}
          </summary>
          <ul className="mt-2 space-y-1 text-[11px]">
            {previousLogs.slice(0, 20).map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {l.performed_at.slice(0, 10)} · Satz {l.set_number}
                </span>
                <span className="font-medium">
                  {l.weight_kg ?? "—"} kg × {l.reps ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="mt-3">
        <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-gold">
          <BarChart3 className="h-3.5 w-3.5" /> Fortschrittsanalyse
        </summary>
        <div className="mt-2">
          <ExerciseAnalytics logs={logs} />
        </div>
      </details>
    </div>
  );
}

