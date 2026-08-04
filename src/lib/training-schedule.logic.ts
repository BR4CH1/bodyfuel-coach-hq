/**
 * Ableitung des Wochen-Trainingsplans (Wochentag → Trainingstag/Ruhetag + Split).
 *
 * Wichtige Konventionen:
 * - Wochentagsindex ist durchgängig JS-Style: 0 = Sonntag … 6 = Samstag.
 *   ISO (Mo=1…So=7) wird nur an den Rändern konvertiert.
 * - Datumsangaben sind reine Kalendertage ("YYYY-MM-DD") und werden IMMER
 *   in UTC-Mitternacht interpretiert. Dadurch verrutscht der Wochentag weder
 *   in Europe/Berlin noch bei UTC-Zeitpunkten kurz vor/nach Mitternacht.
 * - Mehrere Einheiten an einem Wochentag: Trainingseinheiten haben Vorrang vor
 *   Ruhetagen; die Splitbezeichnungen werden in Reihenfolge (week/sort_order)
 *   dedupliziert mit " + " kombiniert, z. B. "Push + Beine".
 */

export type TrainingDayType = "training" | "rest";

export type TrainingWeekdayEntry = {
  type: TrainingDayType;
  /** Splitbezeichnung ohne Wochentagspräfix, null bei Ruhetag/unbekannt. */
  split: string | null;
};

/** Wochentagsindex (0=So … 6=Sa) → Eintrag. */
export type TrainingWeekSchedule = Record<number, TrainingWeekdayEntry>;

export type TrainingScheduleSourceDay = {
  name?: string | null;
  day_date?: string | null;
  sort_order?: number | null;
  week_number?: number | null;
  /** Anzahl Übungen; 0 bedeutet Ruhetag, auch ohne "Rest" im Namen. */
  exercise_count?: number | null;
};

const WEEKDAY_TOKENS: Record<string, number> = {
  so: 0,
  son: 0,
  sonntag: 0,
  sun: 0,
  sunday: 0,
  mo: 1,
  mon: 1,
  montag: 1,
  monday: 1,
  di: 2,
  die: 2,
  dienstag: 2,
  tue: 2,
  tues: 2,
  tuesday: 2,
  mi: 3,
  mit: 3,
  mittwoch: 3,
  wed: 3,
  wednesday: 3,
  do: 4,
  don: 4,
  donnerstag: 4,
  thu: 4,
  thurs: 4,
  thursday: 4,
  fr: 5,
  fre: 5,
  freitag: 5,
  fri: 5,
  friday: 5,
  sa: 6,
  sam: 6,
  samstag: 6,
  sat: 6,
  saturday: 6,
};

/** Reihenfolge der sort_order-Fallbacks: 0→Mo … 6→So. */
const SORT_ORDER_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

/** Wochentag (0=So…6=Sa) eines reinen Kalendertages, UTC-stabil. */
export function weekdayFromIsoDate(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.getUTCDay();
}

/** ISO-Wochentag (Mo=1…So=7) → JS-Index (So=0…Sa=6). */
export function isoWeekdayToJs(isoWeekday: number): number {
  return isoWeekday % 7;
}

/** JS-Index (So=0…Sa=6) → ISO-Wochentag (Mo=1…So=7). */
export function jsWeekdayToIso(jsWeekday: number): number {
  return jsWeekday === 0 ? 7 : jsWeekday;
}

/** Liest den Wochentag aus einem Tagesnamen wie "Di - Gym - Pull — Rücken". */
export function weekdayFromDayName(name: string | null | undefined): number | null {
  if (!name) return null;
  const first = name
    .trim()
    .split(/[\s\-–—.,:|]+/)
    .filter(Boolean)[0];
  if (!first) return null;
  const key = first.toLowerCase().replace(/\./g, "");
  return key in WEEKDAY_TOKENS ? WEEKDAY_TOKENS[key] : null;
}

const REST_RE = /(ruhetag|ruhe|rest\b|off\b|erholung|pause)/i;

/**
 * Splitbezeichnung aus dem Tagesnamen extrahieren.
 * "Di - Gym - Pull — Rücken, Bizeps" → "Pull · Rücken, Bizeps"
 */
export function splitFromDayName(name: string | null | undefined): string | null {
  if (!name) return null;
  let rest = name.trim();
  // Wochentagspräfix entfernen
  const parts = rest.split(/\s*[-–—]\s*/).filter((p) => p.trim().length > 0);
  const cleaned: string[] = [];
  for (const part of parts) {
    const key = part.trim().toLowerCase().replace(/\./g, "");
    if (cleaned.length === 0 && key in WEEKDAY_TOKENS) continue; // "Di"
    if (/^(gym|studio|home|zuhause|training)$/i.test(part.trim())) continue;
    cleaned.push(part.trim());
  }
  rest = cleaned.join(" · ").trim();
  if (!rest) return null;
  if (REST_RE.test(rest) && cleaned.length <= 2 && /^(rest|ruhetag|ruhe|off)/i.test(cleaned[0] ?? ""))
    return null;
  return rest;
}

function isRestDay(day: TrainingScheduleSourceDay): boolean {
  const count = day.exercise_count;
  if (typeof count === "number" && count <= 0) return true;
  const name = day.name ?? "";
  return /^(\s*\S+\s*[-–—]\s*)?(rest|ruhetag|ruhe|off)\b/i.test(name.replace(/^\s*\S{2,10}\s*[-–—]\s*/, "$&"))
    ? /(^|[-–—]\s*)(rest|ruhetag|ruhe|off)\b/i.test(name)
    : /(^|[-–—]\s*)(rest|ruhetag|ruhe|off)\b/i.test(name);
}

/** Wochentag eines Quell-Tages bestimmen (Datum > Name > sort_order). */
export function weekdayForSourceDay(
  day: TrainingScheduleSourceDay,
  index: number,
): number {
  if (day.day_date) return weekdayFromIsoDate(day.day_date);
  const fromName = weekdayFromDayName(day.name);
  if (fromName != null) return fromName;
  const order = typeof day.sort_order === "number" ? day.sort_order : index;
  return SORT_ORDER_WEEKDAYS[((order % 7) + 7) % 7];
}

/**
 * Baut aus den Tagen eines Trainingsplans die Wochentagszuordnung.
 * Es werden alle Wochen zusammengeführt; identische Splits pro Wochentag
 * werden dedupliziert.
 */
export function buildTrainingWeekSchedule(
  days: TrainingScheduleSourceDay[],
): TrainingWeekSchedule {
  const schedule: TrainingWeekSchedule = {};
  const splitsByWeekday = new Map<number, string[]>();

  const ordered = [...days].sort((a, b) => {
    const wa = Number(a.week_number ?? 1);
    const wb = Number(b.week_number ?? 1);
    if (wa !== wb) return wa - wb;
    return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
  });

  ordered.forEach((day, index) => {
    const weekday = weekdayForSourceDay(day, index);
    const rest = isRestDay(day);
    if (rest) {
      if (!schedule[weekday]) schedule[weekday] = { type: "rest", split: null };
      return;
    }
    const split = splitFromDayName(day.name);
    const list = splitsByWeekday.get(weekday) ?? [];
    if (split && !list.includes(split)) list.push(split);
    splitsByWeekday.set(weekday, list);
    schedule[weekday] = { type: "training", split: list.length ? list.join(" + ") : null };
  });

  return schedule;
}

/** Fallback-Schedule aus reinen Trainings-Wochentagen (alte Pläne ohne Split). */
export function scheduleFromWeekdays(weekdays: number[]): TrainingWeekSchedule {
  const schedule: TrainingWeekSchedule = {};
  for (const wd of weekdays) {
    if (wd >= 0 && wd <= 6) schedule[wd] = { type: "training", split: null };
  }
  return schedule;
}

/** Auflösung für einen konkreten Kalendertag. */
export function resolveTrainingDay(
  schedule: TrainingWeekSchedule | null | undefined,
  iso: string,
): TrainingWeekdayEntry {
  const weekday = weekdayFromIsoDate(iso);
  const entry = schedule?.[weekday];
  if (!entry) return { type: "rest", split: null };
  if (entry.type === "rest") return { type: "rest", split: null };
  return { type: "training", split: entry.split ?? null };
}
