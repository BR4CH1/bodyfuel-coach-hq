// Reiner Helfer für das Aktivitätsfenster in der Kunden-Übersicht.
// Wird von der Serverfunktion (Datenfenster) und der UI (Überschrift, Auswahl)
// benutzt, damit beide immer dasselbe Fenster zeigen.

/** Tage, die in der Kunden-Übersicht immer angezeigt werden. */
export const RECENT_ACTIVITY_DAYS = 10;

/** Obergrenze, damit ein Aufrufer nicht unbegrenzt alte Tage zieht. */
export const MAX_RECENT_ACTIVITY_DAYS = 10;

export function clampRecentActivityDays(days?: number): number {
  if (days === undefined || days === null) return RECENT_ACTIVITY_DAYS;
  const requested = Math.floor(Number(days));
  if (!Number.isFinite(requested) || requested < 1) return 1;
  return Math.min(MAX_RECENT_ACTIVITY_DAYS, requested);
}

export type RecentActivityWindow = {
  /** Neuester Tag zuerst. */
  dateList: string[];
  fromDate: string;
  toDate: string;
  fromIso: string;
  toEndIso: string;
};

export function buildRecentActivityWindow(
  days: number,
  now: Date = new Date(),
): RecentActivityWindow {
  const dateList: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dateList.push(d.toISOString().slice(0, 10));
  }
  const fromDate = dateList[dateList.length - 1];
  const toDate = dateList[0];
  return {
    dateList,
    fromDate,
    toDate,
    fromIso: `${fromDate}T00:00:00.000Z`,
    toEndIso: `${toDate}T23:59:59.999Z`,
  };
}
