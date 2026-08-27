import { remapHistoricLogs } from "@/lib/training/tracker-day-selection";
import { localTrainingDateKey } from "@/lib/training/training-set-log.logic";
import type {
  CachedTrainingDay,
  CachedTrainingExercise,
  CachedTrainingPlan,
  CachedTrainingSetLog,
} from "@/lib/training/training-tracker-cache";

/**
 * Transactional core load for the live training tracker.
 *
 * The tracker must NEVER write partial data into React state: a reload that
 * fails half way (e.g. the `training_set_logs` query errors on a flaky mobile
 * connection) previously blanked the visible workout even though every set was
 * safely stored in the database. Everything is therefore loaded into local
 * variables first and only committed atomically once the whole core load
 * succeeded.
 */

export type TrackerCoreSource = {
  fetchActivePlan: () => Promise<CachedTrainingPlan | null>;
  fetchDays: (planId: string) => Promise<CachedTrainingDay[]>;
  fetchExercises: (dayIds: string[]) => Promise<CachedTrainingExercise[]>;
  /** Analytics only — a failure here is tolerated and returns []. */
  fetchHistoricExercises: () => Promise<Array<{ id: string; name: string }>>;
  fetchLogs: (exerciseIds: string[]) => Promise<CachedTrainingSetLog[]>;
};

export type TrackerCoreResult =
  | { status: "no-plan" }
  | {
      status: "loaded";
      plan: CachedTrainingPlan;
      days: CachedTrainingDay[];
      exercises: CachedTrainingExercise[];
      logs: CachedTrainingSetLog[];
      activeWeek: number;
      weeksCount: number;
    };

export function resolveActiveWeek(
  plan: Pick<CachedTrainingPlan, "weeks_count" | "scheduled_start_date">,
  now: Date = new Date(),
): { activeWeek: number; weeksCount: number } {
  const weeksCount = plan.weeks_count ?? 1;
  const startStr = plan.scheduled_start_date ?? null;
  let activeWeek = 1;
  if (startStr && weeksCount > 1) {
    const start = new Date(`${startStr}T00:00:00`);
    const diffDays = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
    activeWeek = Math.max(1, Math.min(weeksCount, Math.floor(diffDays / 7) + 1));
  }
  return { activeWeek, weeksCount };
}

export async function loadTrainingTrackerCore(
  source: TrackerCoreSource,
  options: { now?: Date; todayKey?: string } = {},
): Promise<TrackerCoreResult> {
  const now = options.now ?? new Date();
  const todayKey = options.todayKey ?? localTrainingDateKey(now);

  const plan = await source.fetchActivePlan();
  if (!plan) return { status: "no-plan" };

  const allDays = await source.fetchDays(plan.id);
  const { activeWeek, weeksCount } = resolveActiveWeek(plan, now);
  const days = allDays.filter((day) => (day.week_number ?? 1) === activeWeek);

  if (!days.length) {
    return { status: "loaded", plan, days, exercises: [], logs: [], activeWeek, weeksCount };
  }

  const exercises = await source.fetchExercises(days.map((day) => day.id));
  if (!exercises.length) {
    return { status: "loaded", plan, days, exercises, logs: [], activeWeek, weeksCount };
  }

  let historicExercises: Array<{ id: string; name: string }> = [];
  try {
    historicExercises = await source.fetchHistoricExercises();
  } catch {
    historicExercises = [];
  }

  const allIds = Array.from(
    new Set(historicExercises.map((h) => h.id).concat(exercises.map((e) => e.id))),
  );
  // A failure here MUST propagate: silently treating it as "no logs" is what
  // wiped the visible workout.
  const logRows = await source.fetchLogs(allIds);

  const logs = remapHistoricLogs<CachedTrainingSetLog>({
    logs: logRows,
    currentExercises: exercises.map((e) => ({ id: e.id, name: e.name })),
    historicExercises,
    todayKey,
    dateKeyOf: localTrainingDateKey,
  });

  return { status: "loaded", plan, days, exercises, logs, activeWeek, weeksCount };
}

/**
 * Reloaded logs win for history/analytics, but optimistic offline sets of the
 * current day that the server has not confirmed yet are preserved.
 */
export function mergeReloadedTrainingLogs(
  previousLogs: readonly CachedTrainingSetLog[],
  reloadedLogs: readonly CachedTrainingSetLog[],
  exerciseIds: readonly string[],
  today: string,
): CachedTrainingSetLog[] {
  const exerciseIdSet = new Set(exerciseIds);
  const key = (log: CachedTrainingSetLog) => `${log.exercise_id}:${log.set_number}`;
  const reloadedKeys = new Set(
    reloadedLogs
      .filter(
        (log) =>
          exerciseIdSet.has(log.exercise_id) && localTrainingDateKey(log.performed_at) === today,
      )
      .map(key),
  );

  const preserved = previousLogs.filter(
    (log) =>
      log.id.startsWith("offline-") &&
      localTrainingDateKey(log.performed_at) === today &&
      !reloadedKeys.has(key(log)),
  );

  return [...reloadedLogs, ...preserved].sort(
    (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime(),
  );
}
