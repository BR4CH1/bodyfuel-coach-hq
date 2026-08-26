export type TrainingSetLogInput = {
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  training_date?: string | null;
  performed_at?: string | null;
};

export type TrainingSetLogRow = {
  exercise_id: string;
  client_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  training_date: string;
  performed_at: string;
};

export const TRAINING_SET_LOG_UPSERT_CONFLICT = "client_id,exercise_id,training_date,set_number";

export function localTrainingDateKey(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeTrainingDate(value: string | null | undefined, fallback: Date | string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return localTrainingDateKey(fallback);
}

export function buildTrainingSetLogUpsert(
  input: TrainingSetLogInput,
  clientId: string,
  fallbackDate: Date | string = new Date(),
): TrainingSetLogRow {
  const performedAt = input.performed_at ?? new Date().toISOString();
  return {
    exercise_id: input.exercise_id,
    client_id: clientId,
    set_number: input.set_number,
    weight_kg: input.weight_kg,
    reps: input.reps,
    training_date: normalizeTrainingDate(input.training_date, fallbackDate),
    performed_at: performedAt,
  };
}

export function mergeTodaysTrainingLogs<TLog extends { id: string; exercise_id: string; set_number: number; performed_at: string }>(
  currentLogs: TLog[],
  remoteTodaysLogs: TLog[],
  exerciseIds: string[],
  today: string,
): TLog[] {
  const exerciseIdSet = new Set(exerciseIds);
  const remoteKeys = new Set(
    remoteTodaysLogs.map((log) => `${log.exercise_id}:${log.set_number}`),
  );

  const preserved = currentLogs.filter((log) => {
    if (!exerciseIdSet.has(log.exercise_id)) return true;
    if (localTrainingDateKey(log.performed_at) !== today) return true;
    if (log.id.startsWith("offline-")) {
      return !remoteKeys.has(`${log.exercise_id}:${log.set_number}`);
    }
    return false;
  });

  return [...remoteTodaysLogs, ...preserved].sort(
    (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime(),
  );
}