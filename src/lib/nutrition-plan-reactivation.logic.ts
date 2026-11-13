const DAY = 86_400_000;
type Day = { id: string; day_date: string | null; sort_order: number };

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
  const days = ordered.map((d, index) => ({
    id: d.id,
    day_date: iso(d.day_date ? parse(d.day_date) + offset : start + index * DAY),
  }));
  const end = Math.max(
    start + (ordered.length - 1) * DAY,
    ...days.map((d) => parse(d.day_date)),
    input.scheduled_end_date && oldStart != null ? parse(input.scheduled_end_date) + offset : start,
  );
  if (end < parse(input.today)) throw new Error("Dieser Zeitraum ist bereits abgelaufen. Bitte ab nächster Woche starten.");
  return { scheduled_start_date: iso(start), scheduled_end_date: iso(end), days };
}