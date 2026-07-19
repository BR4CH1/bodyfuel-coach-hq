import type { ScheduleEntry, ScheduleRow } from "../types";

export const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
] as const;

export function buildScheduleRows(entries: ScheduleEntry[]): ScheduleRow[] {
  return WEEKDAYS.map((_, weekday) => {
    const entry = entries.find((item) => item.weekday === weekday);

    return {
      weekday,
      title: entry?.title ?? "Team Training",
      start_time: entry?.start_time?.slice(0, 5) ?? "",
      end_time: entry?.end_time?.slice(0, 5) ?? "",
      active: Boolean(entry?.active),
    };
  });
}

export function createScheduleKey(teamId: string | null, entries: ScheduleEntry[]): string {
  return `${teamId ?? "none"}::${entries
    .map((entry) =>
      [
        entry.id ?? "",
        entry.weekday,
        entry.start_time ?? "",
        entry.end_time ?? "",
        entry.title ?? "",
        Boolean(entry.active),
      ].join(":"),
    )
    .join("|")}`;
}

export function serializeScheduleRows(
  rows: ScheduleRow[],
  existingEntries: ScheduleEntry[],
): Array<{
  weekday: number;
  title: string;
  start_time: string | null;
  end_time: string | null;
  active: boolean;
}> {
  return rows
    .filter((row) => row.active || existingEntries.some((entry) => entry.weekday === row.weekday))
    .map((row) => ({
      weekday: row.weekday,
      title: row.title.trim() || "Team Training",
      start_time: row.start_time || null,
      end_time: row.end_time || null,
      active: row.active,
    }));
}
