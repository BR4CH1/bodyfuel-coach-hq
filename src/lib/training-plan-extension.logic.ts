/**
 * Zentrale, reine Logik für das Verlängern bestehender Trainingspläne.
 *
 * Grundsatz: Neue Wochen spiegeln das bestehende Wochenmuster relativ zur
 * Planstruktur (4-Wochen-Plan + 2 Wochen -> Woche 5 = Woche 1, Woche 6 = Woche 2)
 * mit korrekt verschobenen Kalenderdaten. Ruhetage bleiben Ruhetage,
 * Trainingstage übernehmen exakt die Übungen ihres Quelltags.
 */

export type ExtensionSourceDay = {
  id: string;
  name: string;
  week_number: number;
  sort_order: number;
  day_date: string | null;
};

export type PlannedExtensionDay = {
  source_day_id: string;
  source_week: number;
  week_number: number;
  sort_order: number;
  name: string;
  day_date: string | null;
};

export type ExtensionBlueprint = {
  baseWeeks: number;
  targetWeeks: number;
  days: PlannedExtensionDay[];
  /** Neues Planende (ISO) — null, wenn keine Tage datiert sind. */
  endDate: string | null;
  /** Wochen, die bereits existierten und daher übersprungen wurden. */
  skippedWeeks: number[];
};

export function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Erzeugt den Plan für die anzuhängenden Wochen.
 *
 * Idempotent: Der Aufrufer gibt die Ziel-Laufzeit (`targetWeeks`) an — ein
 * Wiederholen derselben Operation erzeugt daher keine Duplikate. Alternativ
 * kann `addWeeks` relativ zur vorhandenen Struktur genutzt werden.
 */
export function buildExtensionBlueprint(input: {
  existingDays: ExtensionSourceDay[];
  addWeeks?: number;
  targetWeeks?: number;
}): ExtensionBlueprint {
  const { existingDays } = input;
  if (!existingDays.length) {
    throw new Error("Der Plan enthält keine Trainingstage, die verlängert werden könnten.");
  }

  const weeks = existingDays.map((d) => Math.max(1, Number(d.week_number || 1)));
  const baseWeeks = Math.max(...weeks);
  const existingWeeks = new Set(weeks);
  const maxSort = Math.max(...existingDays.map((d) => Number(d.sort_order ?? 0)));

  const targetWeeks =
    input.targetWeeks != null
      ? Math.trunc(input.targetWeeks)
      : baseWeeks + Math.trunc(input.addWeeks ?? 0);
  if (targetWeeks < baseWeeks) {
    throw new Error("Die Ziel-Laufzeit darf nicht kürzer als der bestehende Plan sein.");
  }
  if (targetWeeks > 24) {
    throw new Error("Die Laufzeit darf maximal 24 Wochen betragen.");
  }
  if (input.targetWeeks == null && (!input.addWeeks || input.addWeeks < 1)) {
    throw new Error("Bitte mindestens eine zusätzliche Woche wählen.");
  }

  const days: PlannedExtensionDay[] = [];
  const skippedWeeks: number[] = [];
  let sortCursor = maxSort;

  for (let targetWeek = baseWeeks + 1; targetWeek <= targetWeeks; targetWeek++) {
    if (existingWeeks.has(targetWeek)) {
      skippedWeeks.push(targetWeek);
      continue;
    }
    const sourceWeek = ((targetWeek - 1) % baseWeeks) + 1;
    const sourceDays = existingDays
      .filter((d) => Math.max(1, Number(d.week_number || 1)) === sourceWeek)
      .slice()
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    if (!sourceDays.length) {
      throw new Error(`Woche ${sourceWeek} enthält keine Tage und kann nicht kopiert werden.`);
    }
    const weekShift = (targetWeek - sourceWeek) * 7;
    for (const src of sourceDays) {
      days.push({
        source_day_id: src.id,
        source_week: sourceWeek,
        week_number: targetWeek,
        sort_order: ++sortCursor,
        name: src.name,
        day_date: src.day_date ? shiftIsoDate(src.day_date.slice(0, 10), weekShift) : null,
      });
    }
  }

  const allDates = [
    ...existingDays.map((d) => (d.day_date ? d.day_date.slice(0, 10) : null)),
    ...days.map((d) => d.day_date),
  ].filter((v): v is string => !!v);
  const endDate = allDates.length ? allDates.sort().at(-1)! : null;

  return { baseWeeks, targetWeeks, days, endDate, skippedWeeks };
}

/**
 * Gleiche Spiegel-Logik für den Builder-State (Laufzeit erhöhen/verkürzen),
 * damit die manuelle Verlängerung im Builder keine Inhalte verliert.
 */
export function mirrorBuilderWeeks<T extends { week_number: number }>(
  days: T[],
  nextWeeks: number,
): T[] {
  if (!days.length) return days;
  const baseWeeks = Math.max(...days.map((d) => Math.max(1, Number(d.week_number || 1))));
  if (nextWeeks <= baseWeeks) {
    return days.filter((d) => Math.max(1, Number(d.week_number || 1)) <= nextWeeks);
  }
  const out = [...days];
  for (let target = baseWeeks + 1; target <= nextWeeks; target++) {
    const sourceWeek = ((target - baseWeeks - 1) % baseWeeks) + 1;
    for (const d of days.filter(
      (x) => Math.max(1, Number(x.week_number || 1)) === sourceWeek,
    )) {
      out.push({
        ...(structuredClone(d) as T),
        week_number: target,
      });
    }
  }
  return out;
}
