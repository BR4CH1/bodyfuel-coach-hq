const DAY = 86_400_000;
type Day = { id: string; day_date: string | null; sort_order: number; name?: string | null };
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const DATED_NAME = /^(Tag\s+\d+)\s*·\s*(Mo|Di|Mi|Do|Fr|Sa|So)\s+\d{1,2}\.\d{1,2}\.?(\d{2,4})?/;

/** Rewrites generated day names like "Tag 2 · Di 17.11" to the new date; other names stay untouched. */
export function relabelDatedDayName(name: string | null | undefined, isoDate: string): string | null | undefined {
  if (!name) return name;
  const m = DATED_NAME.exec(name);
  if (!m) return name;
  const d = new Date(`${isoDate}T00:00:00Z`);
  const label = `${m[1]} · ${WD[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return label + name.slice(m[0].length);
}

export function buildNutritionReactivationSchedule(input: {
  start: "this_week" | "next_week";
  today: string;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  days: Day[];
}) {
  const parse = (value: string) => {
    const ms = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(ms)) throw new Error("Ungültiges Plandatum.");
    return ms;
  };
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const monday = (ms: number) => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY;
  if (!input.days.length) throw new Error("Ein Plan ohne Tage kann nicht reaktiviert werden.");
  const ordered = [...input.days].sort((a, b) => a.sort_order - b.sort_order);
  const dated = ordered.flatMap((d) => d.day_date ? [parse(d.day_date)] : []);
  const oldStart = input.scheduled_start_date
    ? parse(input.scheduled_start_date)
    : dated.length ? Math.min(...dated) : null;
  const targetMonday = monday(parse(input.today)) + (input.start === "next_week" ? 7 * DAY : 0);
  const start = oldStart == null ? targetMonday : targetMonday + (oldStart - monday(oldStart));
  const offset = oldStart == null ? 0 : start - oldStart;
  const days = ordered.map((d, index) => {
    const day_date = iso(d.day_date ? parse(d.day_date) + offset : start + index * DAY);
    return d.name === undefined ? { id: d.id, day_date } : { id: d.id, day_date, name: relabelDatedDayName(d.name, day_date) ?? null };
  });
  const end = Math.max(
    start + (ordered.length - 1) * DAY,
    ...days.map((d) => parse(d.day_date)),
    input.scheduled_end_date && oldStart != null ? parse(input.scheduled_end_date) + offset : start,
  );
  if (end < parse(input.today)) throw new Error("Dieser Zeitraum ist bereits abgelaufen. Bitte ab nächster Woche starten.");
  return { scheduled_start_date: iso(start), scheduled_end_date: iso(end), days };
}