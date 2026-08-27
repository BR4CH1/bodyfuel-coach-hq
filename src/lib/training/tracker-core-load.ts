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
  /**
   * The LIVE workout: a small, error-checked query restricted to the currently
   * visible exercise ids. This is the only log query the tracker depends on.
   */
  fetchCurrentLogs: (exerciseIds: string[]) => Promise<CachedTrainingSetLog[]>;
  /** Analytics only — a failure here is tolerated and returns []. */
  fetchHistoricExercises: () => Promise<Array<{ id: string; name: string }>>;
  /** Analytics/PR only — best effort, chunked, never blocks the live state. */
  fetchHistoricLogs: (exerciseIds: string[]) => Promise<CachedTrainingSetLog[]>;
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
      /** True when the best-effort history could not be loaded. */
      historyDegraded: boolean;
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

export function chunkIds(ids: readonly string[], size = 150): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
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

  const base = { plan, days, activeWeek, weeksCount } as const;
  if (!days.length) {
    return { status: "loaded", ...base, exercises: [], logs: [], historyDegraded: false };
  }

  const exercises = await source.fetchExercises(days.map((day) => day.id));
  if (!exercises.length) {
    return { status: "loaded", ...base, exercises, logs: [], historyDegraded: false };
  }

  const currentIds = exercises.map((exercise) => exercise.id);
  // Required: small query for the visible workout. A failure MUST propagate;
  // silently treating it as "no logs" is what wiped the live workout.
  const currentLogs = await source.fetchCurrentLogs(currentIds);

  // Everything below is analytics/PR history. It may be huge (several old
  // 4-week plans) and must never be able to break or blank the live tracker.
  let historicExercises: Array<{ id: string; name: string }> = [];
  let historicLogs: CachedTrainingSetLog[] = [];
  let historyDegraded = false;
  try {
    historicExercises = await source.fetchHistoricExercises();
    const historicIds = historicExercises
      .map((h) => h.id)
      .filter((id) => !currentIds.includes(id));
    if (historicIds.length) historicLogs = await source.fetchHistoricLogs(historicIds);
  } catch {
    historicExercises = [];
    historicLogs = [];
    historyDegraded = true;
  }

  const seen = new Set<string>();
  const logRows = [...currentLogs, ...historicLogs].filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });

  const logs = remapHistoricLogs<CachedTrainingSetLog>({
    logs: logRows,
    currentExercises: exercises.map((e) => ({ id: e.id, name: e.name })),
    historicExercises,
    todayKey,
    dateKeyOf: localTrainingDateKey,
  });

  return { status: "loaded", ...base, exercises, logs, historyDegraded };
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
