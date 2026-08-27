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

/**
 * Selection AFTER the remote draft has been restored.
 *
 * A still-valid `current` day_id always wins — a plan reload must never move
 * the athlete to another day while they are logging sets. When there is no
 * valid current day (fresh session), an extended multi-week plan whose last
 * week is being reused is matched by WEEKDAY of `day_date`, not by "first
 * training day", so e.g. a Thursday maps back onto the plan's Thursday.
 */
export function resolveRestoredOpenDayId(input: {
  current: string | null;
  trackableDays: ReadonlyArray<{ id: string; day_date?: string | null }>;
  todayDateKey: string;
}): string | null {
  const days = input.trackableDays;
  if (!days.length) return input.current;
  if (input.current && days.some((d) => d.id === input.current)) return input.current;

  const exact = days.find((d) => d.day_date === input.todayDateKey);
  if (exact) return exact.id;

  const weekdayOf = (value: string) => new Date(`${value}T12:00:00Z`).getUTCDay();
  const todayWd = weekdayOf(input.todayDateKey);
  const weekdayMatches = days.filter((d) => d.day_date && weekdayOf(d.day_date) === todayWd);
  if (weekdayMatches.length) {
    // Latest dated match — the reused week is the most recent one.
    return weekdayMatches.reduce((a, b) => ((a.day_date ?? "") >= (b.day_date ?? "") ? a : b)).id;
  }

  return days[0]?.id ?? null;
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
