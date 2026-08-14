import {
  resolveTrainingDay,
  weekdayFromIsoDate,
  type TrainingWeekSchedule,
} from "@/lib/training-schedule.logic";

export type EffectiveDayType = "training" | "rest";

const WEEKDAY_ALIASES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  so: 0,
  sonntag: 0,
  "0": 0,
  "7": 0,
  monday: 1,
  mon: 1,
  mo: 1,
  montag: 1,
  "1": 1,
  tuesday: 2,
  tue: 2,
  di: 2,
  dienstag: 2,
  "2": 2,
  wednesday: 3,
  wed: 3,
  mi: 3,
  mittwoch: 3,
  "3": 3,
  thursday: 4,
  thu: 4,
  do: 4,
  donnerstag: 4,
  "4": 4,
  friday: 5,
  fri: 5,
  fr: 5,
  freitag: 5,
  "5": 5,
  saturday: 6,
  sat: 6,
  sa: 6,
  samstag: 6,
  "6": 6,
};

export function normalizeConfiguredTrainingWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const weekdays = new Set<number>();
  for (const raw of value) {
    const key = String(raw ?? "").trim().toLowerCase();
    if (key in WEEKDAY_ALIASES) weekdays.add(WEEKDAY_ALIASES[key]);
  }
  return [...weekdays];
}

/**
 * The active training plan is authoritative. The Smart-profile weekdays are a
 * compatibility fallback only for users who do not yet have a readable plan.
 */
export function resolveConfiguredDayType(input: {
  date: string;
  trainingSchedule: TrainingWeekSchedule | null;
  configuredTrainingWeekdays?: unknown;
}): EffectiveDayType | null {
  if (input.trainingSchedule) {
    return resolveTrainingDay(input.trainingSchedule, input.date).type;
  }

  const weekdays = normalizeConfiguredTrainingWeekdays(input.configuredTrainingWeekdays);
  if (!weekdays.length) return null;
  return weekdays.includes(weekdayFromIsoDate(input.date)) ? "training" : "rest";
}
