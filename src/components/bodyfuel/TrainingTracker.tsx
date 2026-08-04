import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Dumbbell,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import {
  parseTrainingPlan,
  logSet,
  deleteSetLog,
  completeTrainingSession,
  addOwnTrainingExercise,
  deleteOwnTrainingExercise,
} from "@/lib/training.functions";
import { ExerciseAnalytics } from "./ExerciseAnalytics";
import { normalizeExerciseName } from "@/lib/exercise-name-match";
import { AddTrainingSessionButton } from "./AddTrainingSessionDialog";
import { TrainingSessionsList } from "./TrainingSessionsList";
import { enqueue, flushQueue } from "@/lib/offline/queue";
import {
  clearTrainingTrackerSnapshot,
  readTrainingTrackerSnapshot,
  writeTrainingTrackerSnapshot,
  type CachedTrainingDay as Day,
  type CachedTrainingExercise as Exercise,
  type CachedTrainingPlan as Plan,
  type CachedTrainingSetLog as SetLog,
} from "@/lib/training/training-tracker-cache";
import {
  createEmptyTrainingExerciseDraft,
  createEmptyTrainingSessionDraft,
  getTrainingExerciseDraft,
} from "@/lib/training/training-session-state";
import { createSupabaseWorkoutDraftAdapter } from "@/lib/training/workout-session-draft.supabase";
import type {
  TrainingExerciseDraft,
  TrainingSessionDraftState,
} from "@/lib/training/workout-session-draft.types";
import { usePersistentWorkoutSession } from "@/lib/training/use-persistent-workout-session";
import { WorkoutSaveIndicator } from "./WorkoutSaveIndicator";

type HistoricalPlan = {
  training_days?: Array<{
    training_exercises?: Array<{ id?: string; name?: string }>;
  }>;
};
type TrainingDecision = {
  action: string;
  exercise_name: string;
  reason: string;
};

function localDateKey(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clearLegacyTrainingExerciseDrafts(
  clientId: string,
  exerciseIds: string[],
  sessionDate: string,
) {
  if (typeof window === "undefined") return;
  try {
    for (const exerciseId of exerciseIds) {
      window.localStorage.removeItem(`bf.tt.overrides.${clientId}.${exerciseId}.${sessionDate}`);
      window.localStorage.removeItem(`bf.tt.extra.${clientId}.${exerciseId}.${sessionDate}`);
      window.localStorage.removeItem(`bf.tt.note.${clientId}.${exerciseId}.${sessionDate}`);
      window.localStorage.removeItem(`bf.tt.rest.${clientId}.${exerciseId}.${sessionDate}`);
    }
  } catch {
    // Legacy cleanup is optional; the versioned draft was already removed.
  }
}

function withTimeout<T>(work: PromiseLike<T>, timeoutMs = 12_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("Zeitüberschreitung beim Laden. Bitte Verbindung prüfen.")),
      timeoutMs,
    );
    Promise.resolve(work).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function TrainingTracker({ clientId }: { clientId: string }) {
  const { isCoach, supabaseUser } = useSession();
  const parseFn = useServerFn(parseTrainingPlan);
  const logFn = useServerFn(logSet);
  const deleteLogFn = useServerFn(deleteSetLog);
  const completeSessionFn = useServerFn(completeTrainingSession);
  const addOwnExFn = useServerFn(addOwnTrainingExercise);
  const deleteOwnExFn = useServerFn(deleteOwnTrainingExercise);
  const [completingDayId, setCompletingDayId] = useState<string | null>(null);
  const [completedDayIds, setCompletedDayIds] = useState<Set<string>>(new Set());
  const [savingOwnEx, setSavingOwnEx] = useState(false);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const openDayKey = `bf.tt.openDay.${clientId}`;
  const sessionDate = localDateKey();
  const initialSessionDraft = useMemo(() => {
    let legacyOpenDay: string | null = null;
    try {
      if (typeof window !== "undefined") legacyOpenDay = window.localStorage.getItem(openDayKey);
    } catch {
      legacyOpenDay = null;
    }
    return createEmptyTrainingSessionDraft(clientId, sessionDate, legacyOpenDay);
  }, [clientId, openDayKey, sessionDate]);
  const authenticatedUserId = supabaseUser?.id ?? null;
  const remoteDraftAdapter = useMemo(() => {
    if (isCoach || authenticatedUserId !== clientId) return undefined;
    return createSupabaseWorkoutDraftAdapter<TrainingSessionDraftState>(
      supabase as unknown as SupabaseClient,
      clientId,
    );
  }, [authenticatedUserId, clientId, isCoach]);
  const {
    workoutState: sessionDraft,
    restored: sessionDraftRestored,
    saveStatus,
    updateWorkout,
    clearAfterCompletion,
  } = usePersistentWorkoutSession<TrainingSessionDraftState>({
    draftKey: `${clientId}:${sessionDate}`,
    initialState: initialSessionDraft,
    remote: remoteDraftAdapter,
    autosaveMs: 800,
  });

  const openDay = sessionDraft.openDayId;
  const setOpenDay = useCallback(
    (v: string | null | ((p: string | null) => string | null)) => {
      updateWorkout((current) => {
        const next =
          typeof v === "function"
            ? (v as (p: string | null) => string | null)(current.openDayId)
            : v;
        try {
          if (typeof window !== "undefined" && clientId) {
            if (next) window.localStorage.setItem(openDayKey, next);
            else window.localStorage.removeItem(openDayKey);
          }
        } catch {
          /* local storage is optional */
        }
        if (current.openDayId === next) return current;
        return { ...current, openDayId: next };
      });
    },
    [clientId, openDayKey, updateWorkout],
  );
  const addingDayId = sessionDraft.addingDayId;
  const newExName = sessionDraft.newExercise.name;
  const newExSets = sessionDraft.newExercise.sets;
  const newExReps = sessionDraft.newExercise.reps;
  const setAddingDayId = useCallback(
    (value: string | null) =>
      updateWorkout((current) =>
        current.addingDayId === value ? current : { ...current, addingDayId: value },
      ),
    [updateWorkout],
  );
  const setNewExerciseField = useCallback(
    (field: "name" | "sets" | "reps", value: string) =>
      updateWorkout((current) => ({
        ...current,
        newExercise: { ...current.newExercise, [field]: value },
      })),
    [updateWorkout],
  );
  const updateExerciseDraft = useCallback(
    (
      exerciseId: string,
      durationSeconds: number,
      update: TrainingExerciseDraft | ((previous: TrainingExerciseDraft) => TrainingExerciseDraft),
    ) => {
      updateWorkout((current) => {
        const previous = getTrainingExerciseDraft(current, exerciseId, durationSeconds);
        const next = typeof update === "function" ? update(previous) : update;
        return {
          ...current,
          activeExerciseId: exerciseId,
          exercises: { ...current.exercises, [exerciseId]: next },
        };
      });
    },
    [updateWorkout],
  );
  const setActiveExercise = useCallback(
    (exerciseId: string) => {
      updateWorkout((current) =>
        current.activeExerciseId === exerciseId
          ? current
          : { ...current, activeExerciseId: exerciseId },
      );
    },
    [updateWorkout],
  );
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState(1);
  const [weeksCount, setWeeksCount] = useState(1);
  const reloadSequenceRef = useRef(0);

  const reload = async (cachedView = Boolean(plan)) => {
    if (!clientId) return;
    const requestId = ++reloadSequenceRef.current;
    const requestIsCurrent = () => reloadSequenceRef.current === requestId;
    setLoadError(null);
    setLoading(!cachedView);
    setRefreshing(cachedView);
    try {
      const { data: planRow, error: planError } = await withTimeout(
        supabase
          .from("nutrition_plans")
          .select("id, client_id, title, weeks_count, scheduled_start_date")
          .eq("client_id", clientId)
          .eq("plan_type", "training")
          .eq("is_active", true)
          .maybeSingle(),
      );
      if (planError) throw planError;
      if (!requestIsCurrent()) return;

      if (!planRow) {
        // A cached workout remains usable until the backend positively returns
        // a replacement. An auth/network wobble must never blank the screen.
        if (cachedView && plan) {
          throw new Error("Aktiver Trainingsplan konnte gerade nicht bestätigt werden.");
        }
        setPlan(null);
        setDays([]);
        setExercises([]);
        setLogs([]);
        clearTrainingTrackerSnapshot(clientId);
        return;
      }
      const currentPlan = planRow as Plan;
      setPlan(currentPlan);
      const { data: dayRows, error: dayError } = await withTimeout(
        supabase
          .from("training_days")
          .select("*")
          .eq("plan_id", planRow.id)
          .order("week_number")
          .order("sort_order"),
      );
      if (dayError) throw dayError;
      if (!requestIsCurrent()) return;
      const allDays = (dayRows as Day[]) ?? [];

      // For multi-week plans, only show the current week's days.
      const wc = currentPlan.weeks_count ?? 1;
      const startStr = currentPlan.scheduled_start_date ?? null;
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

      if (dayList.length) {
        const { data: exRows, error: exerciseError } = await withTimeout(
          supabase
            .from("training_exercises")
            .select("*")
            .in(
              "day_id",
              dayList.map((d) => d.id),
            )
            .order("sort_order"),
        );
        if (exerciseError) throw exerciseError;
        if (!requestIsCurrent()) return;
        const exList = (exRows as Exercise[]) ?? [];
        setExercises(exList);
        const today = localDateKey();
        const trainingDayIds = new Set(exList.map((exercise) => exercise.day_id));
        const todayTraining = dayList.find(
          (day) => day.day_date === today && trainingDayIds.has(day.id),
        );
        const firstTraining = dayList.find((day) => trainingDayIds.has(day.id));
        const preferredDay = todayTraining ?? firstTraining ?? dayList[0] ?? null;
        setOpenDay((current) =>
          current && trainingDayIds.has(current) ? current : (preferredDay?.id ?? null),
        );

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
          for (const p of (histPlans as HistoricalPlan[]) ?? []) {
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
          const allIds = Array.from(
            new Set(histExercises.map((h) => h.id).concat(exList.map((e) => e.id))),
          );
          const { data: logRows } = await supabase
            .from("training_set_logs")
            .select("*")
            .in("exercise_id", allIds)
            .eq("client_id", clientId)
            .order("performed_at", { ascending: false })
            .limit(2000);
          if (!requestIsCurrent()) return;
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
    } catch (error) {
      if (!requestIsCurrent()) return;
      const message =
        error instanceof Error ? error.message : "Trainingsdaten konnten nicht geladen werden.";
      setLoadError(message);
    } finally {
      if (requestIsCurrent()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    const cached = readTrainingTrackerSnapshot(clientId);
    if (cached) {
      setPlan(cached.plan);
      setDays(cached.days);
      setExercises(cached.exercises);
      setLogs(cached.logs);
      setActiveWeek(cached.activeWeek);
      setWeeksCount(cached.weeksCount);
      setLoading(false);
    }
    void reload(Boolean(cached));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    if (!sessionDraftRestored || !plan?.id || sessionDraft.planId === plan.id) return;
    updateWorkout((current) =>
      current.planId === plan.id ? current : { ...current, planId: plan.id },
    );
  }, [plan?.id, sessionDraft.planId, sessionDraftRestored, updateWorkout]);

  // Every meaningful tracker change is persisted. This includes optimistic
  // offline logs and exercises the athlete adds during the session.
  useEffect(() => {
    if (!clientId || !plan || loading) return;
    const timer = window.setTimeout(
      () =>
        writeTrainingTrackerSnapshot({
          clientId,
          plan,
          days,
          exercises,
          logs,
          activeWeek,
          weeksCount,
        }),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [activeWeek, clientId, days, exercises, loading, logs, plan, weeksCount]);

  // Heute bereits abgeschlossene Trainingstage nachladen (für UI-State des Buttons)
  useEffect(() => {
    if (!clientId || !days.length) return;
    let alive = true;
    (async () => {
      const today = localDateKey();
      const { data } = await supabase
        .from("training_day_completions")
        .select("day_id")
        .eq("client_id", clientId)
        .eq("completion_date", today)
        .in(
          "day_id",
          days.map((d) => d.id),
        );
      if (!alive) return;
      const completionRows = (data ?? []) as Array<{ day_id: string }>;
      setCompletedDayIds(new Set(completionRows.map((row) => String(row.day_id))));
    })();
    return () => {
      alive = false;
    };
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
        (d) =>
          d.name.trim().toLowerCase() === norm ||
          norm.includes(d.name.trim().toLowerCase()) ||
          d.name.trim().toLowerCase().includes(norm),
      );
      if (hit) setOpenDay(hit.id);
    };
    try {
      applyName(localStorage.getItem(key));
    } catch {
      /* local storage is optional */
    }
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
  }, [days, clientId, setOpenDay]);

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
  if (loading) return <div className="text-sm text-muted-foreground">Lade Übungen...</div>;
  if (!plan && loadError)
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-5 text-sm">
        <div className="font-semibold">Training konnte gerade nicht geladen werden.</div>
        <div className="mt-1 text-muted-foreground">{loadError}</div>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-3 rounded-lg border border-amber-500/35 px-3 py-2 text-xs font-semibold text-amber-500"
        >
          Erneut versuchen
        </button>
      </div>
    );
  if (!plan)
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Noch kein aktiver Trainingsplan vorhanden.
      </div>
    );

  const trackableDays = days.filter((day) =>
    exercises.some((exercise) => exercise.day_id === day.id),
  );
  const activeDay = trackableDays.find((day) => day.id === openDay) ?? trackableDays[0] ?? null;
  const activeDayExercises = activeDay
    ? exercises.filter((exercise) => exercise.day_id === activeDay.id)
    : [];
  const today = localDateKey();
  const completedExercises = activeDayExercises.filter((exercise) => {
    const completedSets = logs.filter(
      (log) => log.exercise_id === exercise.id && localDateKey(log.performed_at) === today,
    ).length;
    return completedSets >= Math.max(1, exercise.target_sets ?? 1);
  }).length;
  const workoutProgress =
    activeDayExercises.length > 0
      ? Math.round((completedExercises / activeDayExercises.length) * 100)
      : 0;
  const visibleDays = isCoach ? trackableDays : activeDay ? [activeDay] : [];

  return (
    <div className="space-y-4">
      {(refreshing || loadError) && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[11px] ${
            loadError
              ? "border-amber-500/30 bg-amber-500/8 text-amber-500"
              : "border-primary/20 bg-primary/5 text-muted-foreground"
          }`}
        >
          <span>
            {loadError
              ? "Letzter sicherer Stand – Verbindung wird beim nächsten Versuch aktualisiert."
              : "Aktualisiere Trainingsdaten im Hintergrund …"}
          </span>
          {loadError && (
            <button type="button" onClick={() => void reload()} className="font-bold">
              Neu laden
            </button>
          )}
        </div>
      )}
      <section className="overflow-hidden rounded-3xl border border-primary/20 bg-[linear-gradient(145deg,rgba(17,28,25,0.98),rgba(12,18,17,0.98))] text-white shadow-[0_24px_70px_-38px_rgba(0,0,0,0.85)]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                Heutiges Training
              </p>
              <h2 className="mt-1 font-sans text-2xl font-black tracking-tight">
                {activeDay?.name ?? plan.title}
              </h2>
              <p className="mt-1 text-xs text-white/55">
                {completedExercises} von {activeDayExercises.length} Übungen abgeschlossen
              </p>
            </div>
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <Dumbbell className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-[10px] font-bold">
              <span className="text-white/55">Fortschritt</span>
              <span className="text-primary">{workoutProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${workoutProgress}%` }}
              />
            </div>
          </div>

          {trackableDays.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {trackableDays.map((day) => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => setOpenDay(day.id)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-[10px] font-black transition ${
                    activeDay?.id === day.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-white/10 bg-white/5 text-white/60"
                  }`}
                >
                  {day.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            {plan.title}
          </p>
          <h3 className="font-display text-lg font-bold">Workout protokollieren</h3>
          {!isCoach && (
            <div className="mt-2">
              <WorkoutSaveIndicator status={saveStatus} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCoach && (
            <AddTrainingSessionButton
              onLogged={() => {
                /* list auto-refreshes via query */
              }}
            />
          )}
          {isCoach && (
            <button
              onClick={extract}
              disabled={parsing}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {parsing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {days.length ? "Neu aus PDF extrahieren" : "Übungen aus PDF extrahieren"}
            </button>
          )}
        </div>
      </div>

      {isCoach && <TrainingSessionsList clientId={clientId} selfEdit={false} days={14} />}

      {weeksCount > 1 &&
        trackableDays.length > 0 &&
        (() => {
          const phase =
            activeWeek === 1
              ? "Anpassung"
              : activeWeek === weeksCount
                ? "Deload"
                : activeWeek === weeksCount - 1
                  ? "Belastungsspitze"
                  : "Aufbau";
          return (
            <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-primary">
                    Trainingsphase
                  </div>
                  <div className="font-display text-base font-bold">
                    Woche {activeWeek} von {weeksCount} · {phase}
                  </div>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: weeksCount }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-6 rounded-full ${i + 1 === activeWeek ? "bg-primary" : i + 1 < activeWeek ? "bg-primary/40" : "bg-border"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

      {!trackableDays.length && (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {isCoach
            ? "Klick auf „Übungen extrahieren“, damit Tage und Übungen aus dem PDF gelesen werden."
            : "Dein Coach hat die Übungen noch nicht freigeschaltet."}
        </div>
      )}

      {visibleDays.map((d) => {
        const open = !isCoach || openDay === d.id;
        const dayEx = exercises.filter((e) => e.day_id === d.id);
        const dayCompletedExercises = dayEx.filter((exercise) => {
          const setCount = logs.filter(
            (log) => log.exercise_id === exercise.id && localDateKey(log.performed_at) === today,
          ).length;
          return setCount >= Math.max(1, exercise.target_sets ?? 1);
        }).length;
        return (
          <div
            key={d.id}
            className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_22px_65px_-48px_rgba(0,0,0,0.8)]"
          >
            <button
              type="button"
              onClick={() => {
                if (isCoach) setOpenDay(open ? null : d.id);
              }}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Dumbbell className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                    Trainingstag
                  </div>
                  <div className="truncate font-display text-base font-bold">{d.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {dayCompletedExercises} von {dayEx.length} Übungen fertig
                  </div>
                </div>
              </div>
              {isCoach &&
                (open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />)}
            </button>
            {open && (
              <div className="space-y-3 border-t border-border p-3 sm:p-4">
                {dayEx.length === 0 && (
                  <div className="text-xs text-muted-foreground">Keine Übungen.</div>
                )}
                {dayEx.map((ex) => {
                  const isOwn = !isCoach && !!supabaseUser && ex.added_by_user === supabaseUser.id;
                  const plannedRestSeconds = Math.max(15, Math.min(600, ex.rest_seconds ?? 90));
                  const exerciseDraft = getTrainingExerciseDraft(
                    sessionDraft,
                    ex.id,
                    plannedRestSeconds,
                  );
                  return (
                    <div
                      key={ex.id}
                      className={`relative rounded-2xl transition ${
                        sessionDraft.activeExerciseId === ex.id ? "ring-1 ring-primary/25" : ""
                      }`}
                      data-training-exercise-id={ex.id}
                      onPointerDown={() => setActiveExercise(ex.id)}
                      onFocusCapture={() => setActiveExercise(ex.id)}
                    >
                      {isOwn && (
                        <div className="mb-1 flex items-center justify-between rounded-md border border-gold/30 bg-gold/5 px-3 py-1.5 text-[11px] text-gold">
                          <span className="uppercase tracking-[0.15em]">Von dir ergänzt</span>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Übung „${ex.name}“ entfernen?`)) return;
                              try {
                                await deleteOwnExFn({ data: { exercise_id: ex.id } });
                                setExercises((cur) => cur.filter((e) => e.id !== ex.id));
                                toast.success("Übung entfernt");
                              } catch (e: unknown) {
                                toast.error(e instanceof Error ? e.message : "Fehler");
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded p-1 text-gold hover:bg-gold/10"
                            aria-label="Eigene Übung löschen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <ExerciseCard
                        ex={ex}
                        clientId={clientId}
                        logs={logs.filter((l) => l.exercise_id === ex.id)}
                        draft={exerciseDraft}
                        draftRestored={sessionDraftRestored}
                        hasPersistedDraft={Boolean(sessionDraft.exercises[ex.id])}
                        onDraftChange={(update) =>
                          updateExerciseDraft(ex.id, plannedRestSeconds, update)
                        }
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
                              return true;
                            } catch (e: unknown) {
                              toast.error(e instanceof Error ? e.message : "Fehler");
                              return false;
                            }
                          }
                          try {
                            const row = await logFn({
                              data: { exercise_id: ex.id, set_number, weight_kg, reps },
                            });
                            setLogs((cur) => [row as SetLog, ...cur]);
                            // Auto-check the daily "Training" task
                            try {
                              const date = localDateKey();
                              const { data: existing } = await supabase
                                .from("daily_checks")
                                .select("id, tasks, points")
                                .eq("user_id", clientId)
                                .eq("check_date", date)
                                .maybeSingle();
                              const tasks: Record<string, boolean> = {
                                ...((existing?.tasks as Record<string, boolean>) ?? {}),
                                training: true,
                              };
                              const { TASKS } = await import("@/lib/bodyfuel/data");
                              const points = TASKS.reduce(
                                (s, t) => s + (tasks[t.key] ? t.points : 0),
                                0,
                              );
                              await supabase
                                .from("daily_checks")
                                .upsert(
                                  { user_id: clientId, check_date: date, tasks, points },
                                  { onConflict: "user_id,check_date" },
                                );
                            } catch {
                              /* daily task sync is best effort */
                            }
                            // opportunistic flush of any prior offline writes
                            void flushQueue();
                            return true;
                          } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : "Fehler");
                            return false;
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
                    </div>
                  );
                })}
                {!isCoach && (
                  <div className="rounded-xl border border-dashed border-primary/30 bg-background/40 p-3">
                    {addingDayId === d.id ? (
                      <div className="space-y-2">
                        <input
                          value={newExName}
                          onChange={(e) => setNewExerciseField("name", e.target.value)}
                          placeholder="Übungsname (z.B. Waden stehend)"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          autoFocus
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={newExSets}
                            onChange={(e) => setNewExerciseField("sets", e.target.value)}
                            inputMode="numeric"
                            placeholder="Sätze"
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                          <input
                            value={newExReps}
                            onChange={(e) => setNewExerciseField("reps", e.target.value)}
                            placeholder="Wdh. (z.B. 8 oder 8-12)"
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAddingDayId(null);
                              setNewExerciseField("name", "");
                            }}
                            className="rounded-md border border-border px-3 py-1.5 text-xs"
                          >
                            Abbrechen
                          </button>
                          <button
                            type="button"
                            disabled={savingOwnEx || !newExName.trim()}
                            onClick={async () => {
                              setSavingOwnEx(true);
                              try {
                                const row = await addOwnExFn({
                                  data: {
                                    day_id: d.id,
                                    name: newExName.trim(),
                                    target_sets: Number(newExSets) || 3,
                                    target_reps: newExReps.trim() || "8",
                                  },
                                });
                                setExercises((cur) => [...cur, row as Exercise]);
                                setAddingDayId(null);
                                setNewExerciseField("name", "");
                                setNewExerciseField("sets", "3");
                                setNewExerciseField("reps", "8");
                                toast.success("Übung ergänzt");
                              } catch (e: unknown) {
                                toast.error(
                                  e instanceof Error ? e.message : "Konnte Übung nicht speichern",
                                );
                              } finally {
                                setSavingOwnEx(false);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            {savingOwnEx ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            Speichern
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingDayId(d.id)}
                        className="flex w-full items-center justify-center gap-2 text-xs font-semibold text-primary"
                      >
                        <Plus className="h-4 w-4" /> Eigene Übung hinzufügen
                      </button>
                    )}
                  </div>
                )}
                {!isCoach && (
                  <Link
                    to="/check-in"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2 text-xs font-bold text-muted-foreground transition hover:border-destructive/25 hover:bg-destructive/5 hover:text-destructive"
                  >
                    <AlertTriangle className="h-4 w-4" /> Schmerzen oder Einschränkungen melden
                  </Link>
                )}
                {!isCoach &&
                  dayEx.length > 0 &&
                  (() => {
                    const todayStr = localDateKey();
                    const isCompleted = completedDayIds.has(d.id);
                    const hasTodayLog = logs.some(
                      (l) =>
                        dayEx.some((e) => e.id === l.exercise_id) &&
                        localDateKey(l.performed_at) === todayStr,
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
                                data: {
                                  day_id: d.id,
                                  session_date: todayStr,
                                  timezone_offset_minutes: new Date().getTimezoneOffset(),
                                },
                              });
                              const decisions = (res.decisions ?? []) as TrainingDecision[];
                              const changed = decisions.filter((decision) =>
                                [
                                  "increase_load",
                                  "reduce_load",
                                  "increase_reps_target",
                                  "reduce_volume",
                                ].includes(decision.action),
                              );
                              toast.success(
                                `Einheit abgeschlossen · ${decisions.length} Übungen ausgewertet${changed.length ? ` · ${changed.length} Anpassung${changed.length === 1 ? "" : "en"}` : ""}.`,
                              );
                              // "PLAN UPDATE" — pro geänderter Übung eine nachvollziehbare Toast-Nachricht
                              for (const c of changed.slice(0, 4)) {
                                const arrow =
                                  c.action === "increase_load"
                                    ? "⬆︎ Gewicht"
                                    : c.action === "reduce_load"
                                      ? "⬇︎ Gewicht"
                                      : c.action === "increase_reps_target"
                                        ? "⬆︎ Wiederholungen"
                                        : "⬇︎ Volumen";
                                toast(`PLAN UPDATE · ${c.exercise_name}`, {
                                  description: `${arrow} — ${c.reason}`,
                                  duration: 7000,
                                });
                              }
                              setCompletedDayIds((cur) => new Set(cur).add(d.id));
                              try {
                                await clearAfterCompletion();
                                clearLegacyTrainingExerciseDrafts(
                                  clientId,
                                  dayEx.map((exercise) => exercise.id),
                                  todayStr,
                                );
                              } catch {
                                // The completed workout is already confirmed.
                                // Keeping a local draft is safer than reporting
                                // the whole completion as failed.
                              }
                            } catch (e: unknown) {
                              toast.error(
                                e instanceof Error ? e.message : "Abschluss fehlgeschlagen",
                              );
                            } finally {
                              setCompletingDayId(null);
                            }
                          }}
                          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-black transition ${
                            isCompleted
                              ? "border border-primary/40 bg-primary/10 text-primary"
                              : hasTodayLog
                                ? "bg-primary text-primary-foreground shadow-[0_14px_30px_-18px_rgba(16,185,90,0.9)] hover:brightness-95"
                                : "border border-border bg-muted text-muted-foreground"
                          } disabled:opacity-60`}
                        >
                          {isBusy ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" /> Werte Session aus…
                            </>
                          ) : isCompleted ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" /> Einheit abgeschlossen
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              {hasTodayLog ? "Einheit abschließen" : "Erst Sätze loggen"}
                            </>
                          )}
                        </button>
                        {!hasTodayLog && !isCompleted && (
                          <p className="mt-1 text-center text-[10px] text-muted-foreground">
                            Nach dem Loggen deiner Sätze wertet die Smart-Progression alle Übungen
                            auf einmal aus.
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
    .split(/[,|;/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstNumber(s: string | undefined): string {
  if (!s) return "";
  const m = s.match(/\d+(?:[.,]\d+)?/);
  return m ? m[0].replace(".", ",") : "";
}

function formatRestTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function ExerciseCard({
  ex,
  clientId,
  logs,
  draft,
  draftRestored,
  hasPersistedDraft,
  onDraftChange,
  onLog,
  onDelete,
}: {
  ex: Exercise;
  clientId: string;
  logs: SetLog[];
  draft: TrainingExerciseDraft;
  draftRestored: boolean;
  hasPersistedDraft: boolean;
  onDraftChange: (
    update: TrainingExerciseDraft | ((previous: TrainingExerciseDraft) => TrainingExerciseDraft),
  ) => void;
  onLog: (
    set_number: number,
    weight_kg: number | null,
    reps: number | null,
  ) => boolean | Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const targetSets = ex.target_sets ?? 3;
  const todayStr = localDateKey();
  const todaysLogs = logs.filter((log) => localDateKey(log.performed_at) === todayStr);
  const previousLogs = logs.filter((log) => localDateKey(log.performed_at) !== todayStr);
  const lastSession = previousLogs[0] ? localDateKey(previousLogs[0].performed_at) : null;
  const lastPerformance = previousLogs[0] ?? null;
  const plannedRestSeconds = Math.max(15, Math.min(600, ex.rest_seconds ?? 90));
  const restTimerKey = `bf.tt.rest.${clientId}.${ex.id}.${todayStr}`;
  const overridesKey = `bf.tt.overrides.${clientId}.${ex.id}.${todayStr}`;
  const extraKey = `bf.tt.extra.${clientId}.${ex.id}.${todayStr}`;
  const noteKey = `bf.tt.note.${clientId}.${ex.id}.${todayStr}`;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  const remainingFromDraft = (value: TrainingExerciseDraft) =>
    value.restTimer.running && value.restTimer.endsAt
      ? Math.max(0, Math.ceil((value.restTimer.endsAt - Date.now()) / 1000))
      : Math.max(0, value.restTimer.remainingSeconds);
  const [restRemaining, setRestRemaining] = useState(() => remainingFromDraft(draft));
  const [restRunning, setRestRunning] = useState(
    () => draft.restTimer.running && remainingFromDraft(draft) > 0,
  );
  const [restDeadline, setRestDeadline] = useState<number | null>(draft.restTimer.endsAt);
  const [savingSet, setSavingSet] = useState<number | null>(null);
  const legacyMigratedRef = useRef(false);

  // Move the previous localStorage-only fields into the versioned whole-workout
  // draft once. This keeps an in-progress workout alive across this deployment.
  useEffect(() => {
    if (!draftRestored || hasPersistedDraft || legacyMigratedRef.current) return;
    legacyMigratedRef.current = true;
    if (typeof window === "undefined") return;

    const migrated = createEmptyTrainingExerciseDraft(plannedRestSeconds);
    let changed = false;
    try {
      const rawOverrides = window.localStorage.getItem(overridesKey);
      if (rawOverrides) {
        const parsed = JSON.parse(rawOverrides) as Record<string, { w?: string; r?: string }>;
        migrated.overrides = Object.fromEntries(
          Object.entries(parsed).map(([setNumber, value]) => [
            setNumber,
            { weight: value.w ?? "", reps: value.r ?? "" },
          ]),
        );
        changed = Object.keys(migrated.overrides).length > 0;
      }

      const rawExtra = window.localStorage.getItem(extraKey);
      if (rawExtra !== null) {
        migrated.extraSets = Math.max(0, Number(rawExtra) || 0);
        changed ||= migrated.extraSets > 0;
      }

      const rawNote = window.localStorage.getItem(noteKey);
      if (rawNote !== null) {
        migrated.note = rawNote;
        migrated.noteTouched = true;
        changed = true;
      }

      const rawTimer = window.localStorage.getItem(restTimerKey);
      if (rawTimer) {
        const parsed = JSON.parse(rawTimer) as {
          remaining?: number;
          running?: boolean;
          deadline?: number | null;
        };
        const endsAt =
          parsed.running && typeof parsed.deadline === "number" ? parsed.deadline : null;
        const remainingSeconds = endsAt
          ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
          : Math.max(0, Number(parsed.remaining) || plannedRestSeconds);
        migrated.restTimer = {
          durationSeconds: plannedRestSeconds,
          remainingSeconds,
          endsAt,
          running: Boolean(endsAt && remainingSeconds > 0),
        };
        changed ||= Boolean(endsAt) || remainingSeconds !== plannedRestSeconds;
      }
    } catch {
      // Malformed legacy values are ignored; the new draft remains valid.
    }

    if (changed) onDraftChangeRef.current(migrated);
  }, [
    draftRestored,
    extraKey,
    hasPersistedDraft,
    noteKey,
    overridesKey,
    plannedRestSeconds,
    restTimerKey,
  ]);

  useEffect(() => {
    const remaining = remainingFromDraft(draft);
    setRestRemaining(remaining);
    setRestRunning(draft.restTimer.running && remaining > 0);
    setRestDeadline(draft.restTimer.endsAt);
    // The individual primitive dependencies intentionally avoid resetting the
    // visible countdown on unrelated set/note edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.restTimer.endsAt, draft.restTimer.remainingSeconds, draft.restTimer.running]);

  useEffect(() => {
    if (!restRunning || !restDeadline) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((restDeadline - Date.now()) / 1000));
      setRestRemaining(next);
      if (next === 0) {
        setRestRunning(false);
        setRestDeadline(null);
        onDraftChangeRef.current((current) => ({
          ...current,
          restTimer: {
            ...current.restTimer,
            remainingSeconds: 0,
            endsAt: null,
            running: false,
          },
        }));
      }
    };
    tick();
    const timer = window.setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [restDeadline, restRunning]);

  const startRestTimer = () => {
    const deadline = Date.now() + plannedRestSeconds * 1000;
    setRestRemaining(plannedRestSeconds);
    setRestDeadline(deadline);
    setRestRunning(true);
    onDraftChange((current) => ({
      ...current,
      restTimer: {
        durationSeconds: plannedRestSeconds,
        remainingSeconds: plannedRestSeconds,
        endsAt: deadline,
        running: true,
      },
    }));
  };

  const isPerSide = /kurzhantel|dumbbell|\bkh\b|\bdb\b|einarmig|one[- ]?arm|single[- ]?arm/i.test(
    ex.name,
  );
  // Nur am Übungsnamen erkennen — Notizen können Worte wie "halten" enthalten
  // (z.B. "Handgelenke stabil halten"), ohne dass die Übung zeitbasiert ist.
  const isTimeBased =
    /\bplank\b|unterarmst(ü|ue)tz|isometr|wandsitz|wall[- ]?sit|hollow|dead[- ]?hang|h(ä|ae)ngen|l[- ]?sit|side ?bridge|seitst(ü|ue)tz|bridge halten|stat(ic|isch)|halten\b/i.test(
      ex.name,
    );
  const weightHint = isPerSide ? "pro Seite" : "Gesamtgewicht";

  // Per-set targets (from coach's plan); fall back to single value or last log.
  const repList = parsePlanList(ex.target_reps);
  const wList = parsePlanList(
    (ex as unknown as { target_weights?: string | null }).target_weights ?? null,
  );

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

  // Every keystroke enters the whole-workout draft immediately. localStorage
  // is synchronous; IndexedDB and Supabase follow in the persistence hook.
  const overrides = draft.overrides;
  const setOverride = (n: number, key: "w" | "r", val: string) =>
    onDraftChange((current) => {
      const setNumber = String(n);
      const previous = current.overrides[setNumber] ?? { weight: "", reps: "" };
      return {
        ...current,
        overrides: {
          ...current.overrides,
          [setNumber]: {
            ...previous,
            [key === "w" ? "weight" : "reps"]: val,
          },
        },
      };
    });

  // Zusätzliche Sätze, die der Kunde spontan dranhängt (über den Plan hinaus).
  const extraSets = draft.extraSets;
  const changeExtraSets = (delta: number) =>
    onDraftChange((current) => ({
      ...current,
      extraSets: Math.max(0, current.extraSets + delta),
    }));

  const renderedSetCount = Math.max(targetSets + extraSets, todaysLogs.length);
  const nextIncompleteSet =
    Array.from({ length: renderedSetCount }, (_, index) => index + 1).find(
      (setNumber) => !todaysLogs.some((log) => log.set_number === setNumber),
    ) ?? null;

  const valueFor = (n: number, key: "w" | "r"): string => {
    const current = overrides[String(n)];
    const o = key === "w" ? current?.weight : current?.reps;
    if (o !== undefined && o !== "") return o;
    return key === "w" ? defaultWeightFor(n) : defaultRepsFor(n);
  };

  const logSetFor = async (n: number) => {
    const wStr = isTimeBased ? "" : valueFor(n, "w");
    const rStr = valueFor(n, "r");
    const w = wStr === "" ? null : Number(wStr.replace(",", "."));
    const r = rStr === "" ? null : Number(rStr);
    if (w !== null && (Number.isNaN(w) || w < 0)) return toast.error("Gewicht ungültig");
    if (r !== null && (Number.isNaN(r) || r < 0))
      return toast.error(isTimeBased ? "Sek. ungültig" : "Wdh. ungültig");
    setSavingSet(n);
    try {
      const saved = await onLog(n, w, r);
      if (saved) {
        onDraftChange((current) => {
          const nextOverrides = { ...current.overrides };
          delete nextOverrides[String(n)];
          return { ...current, overrides: nextOverrides };
        });
        startRestTimer();
      }
    } finally {
      setSavingSet(null);
    }
  };

  // Notes per exercise per day
  const [noteLoaded, setNoteLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const note = draft.note;

  useEffect(() => {
    if (!draftRestored) return;
    if (draftRef.current.noteTouched) {
      setNoteLoaded(true);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("training_exercise_notes")
          .select("note")
          .eq("exercise_id", ex.id)
          .eq("client_id", clientId)
          .eq("note_date", todayStr)
          .maybeSingle();
        if (!alive || draftRef.current.noteTouched) return;
        const serverNote = (data?.note as string | undefined) ?? "";
        if (serverNote) {
          onDraftChangeRef.current((current) =>
            current.noteTouched ? current : { ...current, note: serverNote },
          );
        }
      } finally {
        if (alive) setNoteLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [clientId, draftRestored, ex.id, todayStr]);

  const onNoteChange = (val: string) => {
    onDraftChange((current) => ({
      ...current,
      note: val,
      noteTouched: true,
    }));
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

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-background/45 shadow-[0_18px_45px_-38px_rgba(0,0,0,0.75)]">
      <header className="flex items-start justify-between gap-2 border-b border-border p-3 sm:gap-3 sm:p-4">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMediaOpen(true)}
            aria-label={`Ausführung von ${ex.name} ansehen`}
            className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExerciseMediaThumb media={exerciseMedia} name={ex.name} muscle={ex.name} size={44} />
          </button>
          <div className="min-w-0 flex-1">
            <h4 className="break-words font-sans text-base font-black leading-tight tracking-tight sm:text-lg">
              {ex.name}
            </h4>

            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {lastPerformance
                ? `Letztes Mal: ${
                    isTimeBased
                      ? `${lastPerformance.reps ?? "—"} Sek.`
                      : `${lastPerformance.weight_kg ?? "—"} kg × ${lastPerformance.reps ?? "—"}`
                  }`
                : "Noch keine vorherige Leistung"}
            </p>
            <p className="mt-1 text-[10px] font-bold text-primary">
              {isTimeBased ? "Zeit in Sekunden" : `Gewicht ${weightHint}`}
              {ex.notes ? ` · ${ex.notes}` : ""}
            </p>
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-lg bg-muted px-2 py-1 text-[10px] font-black text-muted-foreground sm:px-2.5 sm:py-1.5">
          {ex.target_sets ?? "?"} × {ex.target_reps ?? "?"}
        </span>
      </header>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          <div
            className={`grid items-center gap-2 px-2 text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground ${
              isTimeBased ? "grid-cols-[2rem_1fr_2.5rem]" : "grid-cols-[2rem_1fr_1fr_2.5rem_2.5rem]"
            }`}
          >
            <div>Satz</div>
            {isTimeBased ? (
              <div>Sek.</div>
            ) : (
              <>
                <div>{isPerSide ? "kg/Seite" : "kg"}</div>
                <div>Wdh.</div>
                <div>RIR</div>
              </>
            )}
            <div className="text-right">✓</div>
          </div>

          {Array.from({ length: renderedSetCount }).map((_, index) => {
            const setNum = index + 1;
            const log = todaysLogs.find((item) => item.set_number === setNum);
            const done = !!log;
            const weightValue = done
              ? String(log!.weight_kg ?? "")
              : (overrides[String(setNum)]?.weight ?? "");
            const repsValue = done
              ? String(log!.reps ?? "")
              : (overrides[String(setNum)]?.reps ?? "");
            const weightPlaceholder = defaultWeightFor(setNum);
            const repsPlaceholder = defaultRepsFor(setNum);

            return (
              <div
                key={setNum}
                className={`grid items-center gap-2 rounded-xl border px-2 py-2 ${
                  isTimeBased
                    ? "grid-cols-[2rem_1fr_2.5rem]"
                    : "grid-cols-[2rem_1fr_1fr_2.5rem_2.5rem]"
                } ${done ? "border-primary/35 bg-primary/5" : "border-border bg-card/65"}`}
              >
                <div className="text-center text-sm font-black text-muted-foreground">{setNum}</div>

                {!isTimeBased && (
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.,]*"
                    value={weightValue}
                    placeholder={weightPlaceholder}
                    disabled={done}
                    aria-label={`Gewicht Satz ${setNum}`}
                    onChange={(event) =>
                      setOverride(setNum, "w", event.target.value.replace(/[^0-9.,]/g, ""))
                    }
                    onFocus={(event) => {
                      if (!overrides[String(setNum)]?.weight && weightPlaceholder) {
                        setOverride(setNum, "w", weightPlaceholder);
                        requestAnimationFrame(() => {
                          event.target.setSelectionRange(
                            event.target.value.length,
                            event.target.value.length,
                          );
                        });
                      }
                    }}
                    className="w-full rounded-lg border border-input bg-background px-2 py-2 text-center text-sm font-bold outline-none placeholder:text-muted-foreground/45 focus:border-primary disabled:opacity-100"
                  />
                )}

                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={repsValue}
                  placeholder={repsPlaceholder}
                  disabled={done}
                  aria-label={`${isTimeBased ? "Sekunden" : "Wiederholungen"} Satz ${setNum}`}
                  onChange={(event) =>
                    setOverride(setNum, "r", event.target.value.replace(/[^0-9]/g, ""))
                  }
                  onFocus={(event) => {
                    if (!overrides[String(setNum)]?.reps && repsPlaceholder) {
                      setOverride(setNum, "r", repsPlaceholder);
                      requestAnimationFrame(() => {
                        event.target.setSelectionRange(
                          event.target.value.length,
                          event.target.value.length,
                        );
                      });
                    }
                  }}
                  className="w-full rounded-lg border border-input bg-background px-2 py-2 text-center text-sm font-bold outline-none placeholder:text-muted-foreground/45 focus:border-primary disabled:opacity-100"
                />

                {!isTimeBased && (
                  <div className="rounded-lg border border-border bg-muted/60 px-1 py-2 text-center text-xs font-black text-muted-foreground">
                    {ex.target_rir ?? "—"}
                  </div>
                )}

                <div className="flex justify-end">
                  {done ? (
                    <button
                      type="button"
                      onClick={() => onDelete(log!.id)}
                      className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground transition hover:bg-destructive"
                      aria-label="Gespeicherten Satz löschen"
                      title="Satz löschen"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void logSetFor(setNum)}
                      disabled={savingSet !== null}
                      className="grid h-8 w-8 place-items-center rounded-full border-2 border-primary text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                      aria-label={`Satz ${setNum} speichern`}
                    >
                      {savingSet === setNum ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => changeExtraSets(1)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-2 py-2 text-[10px] font-bold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Satz hinzufügen
            </button>
            {extraSets > 0 && (
              <button
                type="button"
                onClick={() => changeExtraSets(-1)}
                className="rounded-xl border border-border px-3 py-2 text-[10px] font-bold text-muted-foreground transition hover:text-destructive"
              >
                Zusatzsatz entfernen
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
              restRunning ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            <Clock3 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              Satzpause
            </div>
            <div className="font-sans text-2xl font-black tabular-nums">
              {formatRestTime(restRemaining)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (restRunning) {
                  const remaining = restDeadline
                    ? Math.max(0, Math.ceil((restDeadline - Date.now()) / 1000))
                    : restRemaining;
                  setRestRemaining(remaining);
                  setRestRunning(false);
                  setRestDeadline(null);
                  onDraftChange((current) => ({
                    ...current,
                    restTimer: {
                      ...current.restTimer,
                      remainingSeconds: remaining,
                      endsAt: null,
                      running: false,
                    },
                  }));
                  return;
                }
                const seconds = restRemaining === 0 ? plannedRestSeconds : restRemaining;
                const deadline = Date.now() + seconds * 1000;
                setRestRemaining(seconds);
                setRestDeadline(deadline);
                setRestRunning(true);
                onDraftChange((current) => ({
                  ...current,
                  restTimer: {
                    durationSeconds: plannedRestSeconds,
                    remainingSeconds: seconds,
                    endsAt: deadline,
                    running: true,
                  },
                }));
              }}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-primary/35 hover:text-primary"
              aria-label={restRunning ? "Pausentimer anhalten" : "Pausentimer starten"}
            >
              {restRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setRestRemaining(plannedRestSeconds);
                setRestRunning(false);
                setRestDeadline(null);
                onDraftChange((current) => ({
                  ...current,
                  restTimer: {
                    durationSeconds: plannedRestSeconds,
                    remainingSeconds: plannedRestSeconds,
                    endsAt: null,
                    running: false,
                  },
                }));
              }}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-primary/35 hover:text-primary"
              aria-label="Pausentimer zurücksetzen"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {nextIncompleteSet !== null ? (
          <button
            type="button"
            onClick={() => void logSetFor(nextIncompleteSet)}
            disabled={savingSet !== null}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-black text-primary-foreground shadow-[0_14px_30px_-18px_rgba(16,185,90,0.9)] transition hover:brightness-95 disabled:opacity-50"
          >
            {savingSet === nextIncompleteSet ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Satz {nextIncompleteSet} speichern
          </button>
        ) : (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-black text-primary">
            <CheckCircle2 className="h-4 w-4" /> Alle Sätze abgeschlossen
          </div>
        )}

        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={
            noteLoaded
              ? "Notiz zur Übung: Gefühl, Technik oder Einschränkung …"
              : "Notiz wird geladen …"
          }
          rows={2}
          className="mt-3 w-full resize-none rounded-xl border border-input bg-card/60 px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-primary"
        />

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {previousLogs.length > 0 && (
            <details className="rounded-xl border border-border bg-card p-3">
              <summary className="cursor-pointer text-[11px] font-bold text-muted-foreground">
                Verlauf ({previousLogs.length}) · zuletzt {lastSession}
              </summary>
              <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto text-[11px]">
                {previousLogs.slice(0, 20).map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      {localDateKey(log.performed_at)} · Satz {log.set_number}
                    </span>
                    <span className="font-bold">
                      {isTimeBased
                        ? `${log.reps ?? "—"} Sek.`
                        : `${log.weight_kg ?? "—"} kg × ${log.reps ?? "—"}`}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <details className="rounded-xl border border-border bg-card p-3">
            <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-primary">
              <BarChart3 className="h-3.5 w-3.5" /> Fortschrittsanalyse
            </summary>
            <div className="mt-2">
              <ExerciseAnalytics logs={logs} />
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}
