import { normalizeExerciseName } from "@/lib/exercise-name-match";

/**
 * Live-Tracker day selection is ID-based only. Day NAMES must never be used to
 * switch the currently open training day, because several days of the same plan
 * can share (or fuzzily match) a name, which caused the tracker to jump between
 * days while the athlete was logging sets.
 */
export function resolveOpenDayId(input: {
  current: string | null;
  visibleDayIds: readonly string[];
  preferredDayId: string | null;
}): string | null {
  const visible = new Set(input.visibleDayIds);
  if (input.current && visible.has(input.current)) return input.current;
  if (input.preferredDayId && visible.has(input.preferredDayId)) return input.preferredDayId;
  return input.preferredDayId ?? null;
}

/**
 * Storage / custom events may only carry an explicit, still-existing day_id.
 * Anything else (names, unknown ids, empty values) is ignored.
 */
export function resolveExternalDaySelection(input: {
  requestedDayId: unknown;
  visibleDayIds: readonly string[];
  current: string | null;
}): string | null {
  const requested = typeof input.requestedDayId === "string" ? input.requestedDayId.trim() : "";
  if (!requested) return input.current;
  if (!input.visibleDayIds.includes(requested)) return input.current;
  return requested;
}

export type RemappableLog = {
  exercise_id: string;
  performed_at?: string | null;
  training_date?: string | null;
};

/**
 * Historic name matching is for analytics / PR comparison only. Logs belonging
 * to the current training day (today) are NEVER rewritten onto another
 * exercise_id.
 */
export function remapHistoricLogs<T extends RemappableLog>(input: {
  logs: readonly T[];
  currentExercises: ReadonlyArray<{ id: string; name: string }>;
  historicExercises: ReadonlyArray<{ id: string; name: string }>;
  todayKey: string;
  dateKeyOf: (value: string | number | Date) => string;
}): T[] {
  const currentIds = new Set(input.currentExercises.map((e) => e.id));
  const currentByName = new Map<string, string>();
  for (const e of input.currentExercises) currentByName.set(normalizeExerciseName(e.name), e.id);
  const historicById = new Map(input.historicExercises.map((e) => [e.id, e.name]));

  return input.logs.map((log) => {
    if (currentIds.has(log.exercise_id)) return log;
    const logDate = log.training_date
      ? String(log.training_date).slice(0, 10)
      : log.performed_at
        ? input.dateKeyOf(log.performed_at)
        : null;
    // Today's logs stay on their own exercise_id, always.
    if (logDate === input.todayKey) return log;
    const historicName = historicById.get(log.exercise_id);
    if (!historicName) return log;
    const target = currentByName.get(normalizeExerciseName(historicName));
    return target ? { ...log, exercise_id: target } : log;
  });
}
