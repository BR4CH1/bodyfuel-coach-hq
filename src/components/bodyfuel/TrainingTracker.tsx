import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, ChevronDown, ChevronRight, Trash2, Loader2, BarChart3, Check, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { parseTrainingPlan, logSet, deleteSetLog, completeTrainingSession, addOwnTrainingExercise, deleteOwnTrainingExercise } from "@/lib/training.functions";
import { ExerciseAnalytics } from "./ExerciseAnalytics";
import { normalizeExerciseName } from "@/lib/exercise-name-match";
import { AddTrainingSessionButton } from "./AddTrainingSessionDialog";
import { TrainingSessionsList } from "./TrainingSessionsList";
import { enqueue, flushQueue } from "@/lib/offline/queue";


type Plan = { id: string; client_id: string; title: string; weeks_count?: number | null; scheduled_start_date?: string | null };
type Day = { id: string; name: string; sort_order: number; week_number?: number | null };
type Exercise = {
  id: string;
  day_id: string;
  name: string;
  target_sets: number | null;
  target_reps: string | null;
  notes: string | null;
  sort_order: number;
  added_by_user?: string | null;
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
  const completeSessionFn = useServerFn(completeTrainingSession);
  const [completingDayId, setCompletingDayId] = useState<string | null>(null);
  const [completedDayIds, setCompletedDayIds] = useState<Set<string>>(new Set());

  const [plan, setPlan] = useState<Plan | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const openDayKey = `bf.tt.openDay.${clientId}`;
  const [openDay, setOpenDayState] = useState<string | null>(() => {
    if (typeof window === "undefined" || !clientId) return null;
    try { return window.localStorage.getItem(openDayKey); } catch { return null; }
  });
  const setOpenDay = (v: string | null | ((p: string | null) => string | null)) => {
    setOpenDayState((cur) => {
      const next = typeof v === "function" ? (v as (p: string | null) => string | null)(cur) : v;
      try {
        if (typeof window !== "undefined" && clientId) {
          if (next) window.localStorage.setItem(openDayKey, next);
          else window.localStorage.removeItem(openDayKey);
        }
      } catch { /* ignore */ }
      return next;
    });
  };
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeWeek, setActiveWeek] = useState(1);
  const [weeksCount, setWeeksCount] = useState(1);

  const reload = async () => {
    if (!clientId) return;
    setLoading(true);
    const { data: planRow } = await supabase
      .from("nutrition_plans")
      .select("id, client_id, title, weeks_count, scheduled_start_date")
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
      .order("week_number")
      .order("sort_order");
    const allDays = (dayRows as Day[]) ?? [];

    // For multi-week plans, only show the current week's days.
    const wc = (planRow as any).weeks_count ?? 1;
    const startStr = (planRow as any).scheduled_start_date as string | null;
    let aw = 1;
    if (startStr && wc > 1) {
      const start = new Date(startStr + "T00:00:00");
      const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
      aw = Math.max(1, Math.min(wc, Math.floor(diffDays / 7) + 1));
    }
    setActiveWeek(aw);
    setWeeksCount(wc);
    const dayList = allDays.filter((d) => (d.week_number ?? 1) === aw);
    setDays(dayList);
    setOpenDay((cur) => (cur && dayList.some((d) => d.id === cur) ? cur : dayList[0]?.id ?? null));

    if (dayList.length) {
      const { data: exRows } = await supabase
        .from("training_exercises")
        .select("*")
        .in("day_id", dayList.map((d) => d.id))
        .order("sort_order");
      const exList = (exRows as Exercise[]) ?? [];
      setExercises(exList);

      if (exList.length) {
        // Pull historic exercises across ALL of this client's training plans,
        // so logs from previous plans still feed into PRs / trend analysis
        // when names match (e.g. "Bankdrücken Langhantel" from a prior plan).
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
        // name-group → all exercise ids that share that normalized name
        const idsByName = new Map<string, string[]>();
        for (const h of histExercises) {
          const k = normalizeExerciseName(h.name);
          if (!k) continue;
          const arr = idsByName.get(k) ?? [];
          arr.push(h.id);
          idsByName.set(k, arr);
        }
        const allIds = Array.from(new Set(histExercises.map((h) => h.id).concat(exList.map((e) => e.id))));
        const { data: logRows } = await supabase
          .from("training_set_logs")
          .select("*")
          .in("exercise_id", allIds)
          .eq("client_id", clientId)
          .order("performed_at", { ascending: false })
          .limit(2000);
        // Rewrite log.exercise_id to a current-plan exercise id when the
        // historic log belongs to a name-matched exercise. That lets the
        // existing `logs.filter(l => l.exercise_id === ex.id)` keep working
        // unchanged for both display and analytics.
        const currentByName = new Map<string, string>();
        for (const e of exList) currentByName.set(normalizeExerciseName(e.name), e.id);
        const remapped = ((logRows as SetLog[]) ?? []).map((l) => {
          // already current? keep.
          if (exList.some((e) => e.id === l.exercise_id)) return l;
          // find name of the historic exercise this log belongs to
          const h = histExercises.find((x) => x.id === l.exercise_id);
          if (!h) return l;
          const target = currentByName.get(normalizeExerciseName(h.name));
          return target ? { ...l, exercise_id: target } : l;
        });
        setLogs(remapped);
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

  // Heute bereits abgeschlossene Trainingstage nachladen (für UI-State des Buttons)
  useEffect(() => {
    if (!clientId || !days.length) return;
    let alive = true;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("training_day_completions")
        .select("day_id")
        .eq("client_id", clientId)
        .eq("completion_date", today)
        .in("day_id", days.map((d) => d.id));
      if (!alive) return;
      setCompletedDayIds(new Set(((data as any[]) ?? []).map((r) => String(r.day_id))));
    })();
    return () => { alive = false; };
  }, [clientId, days]);

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
        <div className="flex items-center gap-2">
          {!isCoach && (
            <AddTrainingSessionButton onLogged={() => { /* list auto-refreshes via query */ }} />
          )}
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
      </div>

      <TrainingSessionsList clientId={clientId} selfEdit={!isCoach} days={14} />

      {weeksCount > 1 && days.length > 0 && (() => {
        const phase =
          activeWeek === 1 ? "Anpassung"
          : activeWeek === weeksCount ? "Deload"
          : activeWeek === weeksCount - 1 ? "Belastungsspitze"
          : "Aufbau";
        return (
          <div className="rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-gold">Trainingsphase</div>
                <div className="font-display text-base font-bold">
                  Woche {activeWeek} von {weeksCount} · {phase}
                </div>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: weeksCount }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-6 rounded-full ${i + 1 === activeWeek ? "bg-gold" : i + 1 < activeWeek ? "bg-gold/40" : "bg-border"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })()}

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
                    clientId={clientId}
                    logs={logs.filter((l) => l.exercise_id === ex.id)}
                    onLog={async (set_number, weight_kg, reps) => {
                      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
                      if (isOffline) {
                        try {
                          await enqueue({
                            kind: "set_log",
                            client_id: clientId,
                            exercise_id: ex.id,
                            set_number,
                            weight_kg,
                            reps,
                            logged_at: new Date().toISOString(),
                          });
                          const optimistic: SetLog = {
                            id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            exercise_id: ex.id,
                            client_id: clientId,
                            set_number,
                            weight_kg,
                            reps,
                            performed_at: new Date().toISOString(),
                          };
                          setLogs((cur) => [optimistic, ...cur]);
                          toast.success("Offline gespeichert · synct beim Wieder-Online");
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : "Fehler");
                        }
                        return;
                      }
                      try {
                        const row = await logFn({
                          data: { exercise_id: ex.id, set_number, weight_kg, reps },
                        });
                        setLogs((cur) => [row as SetLog, ...cur]);
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
                        // opportunistic flush of any prior offline writes
                        void flushQueue();
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
                {!isCoach && dayEx.length > 0 && (() => {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const isCompleted = completedDayIds.has(d.id);
                  const hasTodayLog = logs.some(
                    (l) =>
                      dayEx.some((e) => e.id === l.exercise_id) &&
                      l.performed_at.slice(0, 10) === todayStr,
                  );
                  const isBusy = completingDayId === d.id;
                  return (
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={isBusy || isCompleted || !hasTodayLog}
                        onClick={async () => {
                          if (isCompleted || isBusy) return;
                          setCompletingDayId(d.id);
                          try {
                            const res = await completeSessionFn({
                              data: { day_id: d.id, session_date: todayStr },
                            });
                            const decisions = (res as any)?.decisions ?? [];
                            const changed = decisions.filter((x: any) =>
                              ["increase_load", "reduce_load", "increase_reps_target", "reduce_volume"].includes(x.action),
                            );
                            toast.success(
                              `Einheit abgeschlossen · ${decisions.length} Übungen ausgewertet${changed.length ? ` · ${changed.length} Anpassung${changed.length === 1 ? "" : "en"}` : ""}.`,
                            );
                            // "PLAN UPDATE" — pro geänderter Übung eine nachvollziehbare Toast-Nachricht
                            for (const c of changed.slice(0, 4)) {
                              const arrow =
                                c.action === "increase_load" ? "⬆︎ Gewicht"
                                : c.action === "reduce_load" ? "⬇︎ Gewicht"
                                : c.action === "increase_reps_target" ? "⬆︎ Wiederholungen"
                                : "⬇︎ Volumen";
                              toast(`PLAN UPDATE · ${c.exercise_name}`, {
                                description: `${arrow} — ${c.reason}`,
                                duration: 7000,
                              });
                            }
                            setCompletedDayIds((cur) => new Set(cur).add(d.id));
                          } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : "Abschluss fehlgeschlagen");
                          } finally {
                            setCompletingDayId(null);
                          }
                        }}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                          isCompleted
                            ? "border border-gold/40 bg-gold/10 text-gold"
                            : hasTodayLog
                            ? "bg-gradient-gold text-primary-foreground hover:opacity-90"
                            : "border border-border bg-muted text-muted-foreground"
                        } disabled:opacity-60`}
                      >
                        {isBusy ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Werte Session aus…
                          </>
                        ) : isCompleted ? (
                          <>
                            <Check className="h-4 w-4" /> Einheit abgeschlossen
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            {hasTodayLog ? "Einheit abschließen" : "Erst Sätze loggen"}
                          </>
                        )}
                      </button>
                      {!hasTodayLog && !isCompleted && (
                        <p className="mt-1 text-center text-[10px] text-muted-foreground">
                          Nach dem Loggen deiner Sätze wertet die Smart-Progression alle Übungen auf einmal aus.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        );
      })}
    </div>
  );
}

function parsePlanList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return String(raw)
    .split(/[,|;\/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstNumber(s: string | undefined): string {
  if (!s) return "";
  const m = s.match(/\d+(?:[.,]\d+)?/);
  return m ? m[0].replace(".", ",") : "";
}

function ExerciseCard({
  ex,
  clientId,
  logs,
  onLog,
  onDelete,
}: {
  ex: Exercise;
  clientId: string;
  logs: SetLog[];
  onLog: (set_number: number, weight_kg: number | null, reps: number | null) => void;
  onDelete: (id: string) => void;
}) {
  const targetSets = ex.target_sets ?? 3;
  const todayStr = new Date().toISOString().slice(0, 10);
  const lastSession = logs[0]?.performed_at?.slice(0, 10);
  const todaysLogs = logs.filter((l) => l.performed_at.slice(0, 10) === todayStr);
  const previousLogs = logs.filter((l) => l.performed_at.slice(0, 10) !== todayStr);

  const isPerSide = /kurzhantel|dumbbell|\bkh\b|\bdb\b|einarmig|one[- ]?arm|single[- ]?arm/i.test(
    ex.name,
  );
  // Nur am Übungsnamen erkennen — Notizen können Worte wie "halten" enthalten
  // (z.B. "Handgelenke stabil halten"), ohne dass die Übung zeitbasiert ist.
  const isTimeBased = /\bplank\b|unterarmst(ü|ue)tz|isometr|wandsitz|wall[- ]?sit|hollow|dead[- ]?hang|h(ä|ae)ngen|l[- ]?sit|side ?bridge|seitst(ü|ue)tz|bridge halten|stat(ic|isch)|halten\b/i.test(
    ex.name,
  );
  const weightHint = isPerSide ? "pro Seite" : "Gesamtgewicht";

  // Per-set targets (from coach's plan); fall back to single value or last log.
  const repList = parsePlanList(ex.target_reps);
  const wList = parsePlanList((ex as unknown as { target_weights?: string | null }).target_weights ?? null);

  const defaultRepsFor = (n: number): string => {
    const planned = repList[Math.min(n - 1, repList.length - 1)] ?? ex.target_reps ?? "";
    return firstNumber(planned);
  };
  const defaultWeightFor = (n: number): string => {
    const planned = wList[Math.min(n - 1, wList.length - 1)];
    if (planned) return firstNumber(planned);
    // fall back to last session's same-set weight, then most recent log
    const lastSame = previousLogs.find((l) => l.set_number === n && l.weight_kg != null);
    if (lastSame?.weight_kg != null) return String(lastSame.weight_kg).replace(".", ",");
    const anyLast = logs.find((l) => l.weight_kg != null);
    if (anyLast?.weight_kg != null) return String(anyLast.weight_kg).replace(".", ",");
    return "";
  };

  // Per-set editable values (user overrides). Persisted locally so a phone-lock /
  // PWA reload doesn't wipe values the user typed before tapping the check.
  const overridesKey = `bf.tt.overrides.${clientId}.${ex.id}.${todayStr}`;
  const [overrides, setOverrides] = useState<Record<number, { w: string; r: string }>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(overridesKey);
      return raw ? (JSON.parse(raw) as Record<number, { w: string; r: string }>) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(overridesKey, JSON.stringify(overrides));
    } catch {
      /* ignore */
    }
  }, [overrides, overridesKey]);
  const setOverride = (n: number, key: "w" | "r", val: string) =>
    setOverrides((cur) => ({ ...cur, [n]: { w: cur[n]?.w ?? "", r: cur[n]?.r ?? "", [key]: val } }));

  // Zusätzliche Sätze, die der Kunde spontan dranhängt (über den Plan hinaus).
  const extraKey = `bf.tt.extra.${clientId}.${ex.id}.${todayStr}`;
  const [extraSets, setExtraSets] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      const raw = window.localStorage.getItem(extraKey);
      return raw ? Math.max(0, Number(raw) || 0) : 0;
    } catch {
      return 0;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(extraKey, String(extraSets));
    } catch {
      /* ignore */
    }
  }, [extraSets, extraKey]);

  const valueFor = (n: number, key: "w" | "r"): string => {
    const o = overrides[n]?.[key];
    if (o !== undefined && o !== "") return o;
    return key === "w" ? defaultWeightFor(n) : defaultRepsFor(n);
  };

  const logSetFor = (n: number) => {
    const wStr = isTimeBased ? "" : valueFor(n, "w");
    const rStr = valueFor(n, "r");
    const w = wStr === "" ? null : Number(wStr.replace(",", "."));
    const r = rStr === "" ? null : Number(rStr);
    if (w !== null && (Number.isNaN(w) || w < 0)) return toast.error("Gewicht ungültig");
    if (r !== null && (Number.isNaN(r) || r < 0))
      return toast.error(isTimeBased ? "Sek. ungültig" : "Wdh. ungültig");
    onLog(n, w, r);
  };

  // Notes per exercise per day
  const [note, setNote] = useState("");
  const [noteLoaded, setNoteLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("training_exercise_notes")
        .select("note")
        .eq("exercise_id", ex.id)
        .eq("client_id", clientId)
        .eq("note_date", todayStr)
        .maybeSingle();
      if (!alive) return;
      setNote((data?.note as string | undefined) ?? "");
      setNoteLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [ex.id, clientId, todayStr]);

  const onNoteChange = (val: string) => {
    setNote(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (isOffline) {
        try {
          await enqueue({
            kind: "exercise_note",
            exercise_id: ex.id,
            client_id: clientId,
            note_date: todayStr,
            note: val,
          });
        } catch {
          /* silent */
        }
        return;
      }
      try {
        await supabase
          .from("training_exercise_notes")
          .upsert(
            { exercise_id: ex.id, client_id: clientId, note_date: todayStr, note: val },
            { onConflict: "exercise_id,client_id,note_date" },
          );
      } catch {
        /* silent */
      }
    }, 600);
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
          <div className={`mt-0.5 text-[10px] font-medium ${isTimeBased ? "text-primary" : isPerSide ? "text-primary" : "text-muted-foreground/80"}`}>
            {isTimeBased ? "⏱️ Zeit in Sekunden" : `⚖️ Gewicht ${weightHint}`}
          </div>
        </div>
      </div>

      {/* Per-set rows: pre-filled greyed defaults, tap to overwrite, check to log */}
      <div className="mt-3 space-y-2">
        <div
          className={`grid items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${
            isTimeBased
              ? "grid-cols-[2.25rem_1fr_2.25rem]"
              : "grid-cols-[2.25rem_1fr_1fr_2.25rem]"
          }`}
        >
          <div>Satz</div>
          {isTimeBased ? (
            <div>Sek.</div>
          ) : (
            <>
              <div>Wdh.</div>
              <div>{isPerSide ? "kg/Seite" : "kg"}</div>
            </>
          )}
          <div className="text-right">✓</div>
        </div>
        {Array.from({ length: Math.max(targetSets + extraSets, todaysLogs.length) }).map((_, i) => {
          const setNum = i + 1;
          const log = todaysLogs.find((l) => l.set_number === setNum);
          const done = !!log;
          const wVal = done ? String(log!.weight_kg ?? "") : overrides[setNum]?.w ?? "";
          const rVal = done ? String(log!.reps ?? "") : overrides[setNum]?.r ?? "";
          const wPh = defaultWeightFor(setNum);
          const rPh = defaultRepsFor(setNum);
          return (
            <div
              key={setNum}
              className={`grid items-center gap-2 rounded-lg border px-2 py-1.5 ${
                isTimeBased
                  ? "grid-cols-[2.25rem_1fr_2.25rem]"
                  : "grid-cols-[2.25rem_1fr_1fr_2.25rem]"
              } ${done ? "border-gold/40 bg-gold/5" : "border-border/60 bg-background/60"}`}
            >
              <div className="text-center text-sm font-bold text-muted-foreground">{setNum}</div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={rVal}
                placeholder={rPh}
                disabled={done}
                onChange={(e) => setOverride(setNum, "r", e.target.value.replace(/[^0-9]/g, ""))}
                onFocus={(e) => {
                  if (!overrides[setNum]?.r && rPh) {
                    setOverride(setNum, "r", rPh);
                    requestAnimationFrame(() => {
                      const el = e.target as HTMLInputElement;
                      el.setSelectionRange(el.value.length, el.value.length);
                    });
                  }
                }}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-center text-sm placeholder:text-muted-foreground/50 disabled:opacity-100"
              />
              {!isTimeBased && (
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  value={wVal}
                  placeholder={wPh}
                  disabled={done}
                  onChange={(e) => setOverride(setNum, "w", e.target.value.replace(/[^0-9.,]/g, ""))}
                  onFocus={(e) => {
                    if (!overrides[setNum]?.w && wPh) {
                      setOverride(setNum, "w", wPh);
                      requestAnimationFrame(() => {
                        const el = e.target as HTMLInputElement;
                        el.setSelectionRange(el.value.length, el.value.length);
                      });
                    }
                  }}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-center text-sm placeholder:text-muted-foreground/50 disabled:opacity-100"
                />
              )}
              <div className="flex justify-end">
                {done ? (
                  <button
                    onClick={() => onDelete(log!.id)}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Satz löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => logSetFor(setNum)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-gold text-gold hover:bg-gold hover:text-primary-foreground"
                    aria-label={`Satz ${setNum} abhaken`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setExtraSets((n) => n + 1)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 px-2 py-2 text-[11px] font-semibold text-muted-foreground hover:border-gold/50 hover:text-gold"
        >
          <Plus className="h-3.5 w-3.5" /> Satz hinzufügen
        </button>
        {extraSets > 0 && (
          <button
            type="button"
            onClick={() => setExtraSets((n) => Math.max(0, n - 1))}
            className="mx-auto block text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            Letzten Zusatzsatz entfernen
          </button>
        )}
      </div>

      {/* Per-exercise note for today */}
      <div className="mt-3">
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={noteLoaded ? "Notiz zur Übung (z. B. Gefühl, Technik, Pause)…" : "Lade Notiz…"}
          rows={2}
          className="w-full resize-none rounded-md border border-input bg-background/60 px-2 py-1.5 text-xs placeholder:text-muted-foreground/60"
        />
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
                  {isTimeBased ? `${l.reps ?? "—"} Sek.` : `${l.weight_kg ?? "—"} kg × ${l.reps ?? "—"}`}
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


