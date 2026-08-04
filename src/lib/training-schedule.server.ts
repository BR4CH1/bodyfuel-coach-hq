/**
 * Serverseitiges Laden des aktuell gültigen Trainingsplans eines Athleten
 * und Ableitung der Wochentagszuordnung (Trainingstag/Ruhetag + Split).
 */
import {
  buildTrainingWeekSchedule,
  type TrainingWeekSchedule,
} from "@/lib/training-schedule.logic";

export async function loadTrainingWeekSchedule(
  supabaseAdmin: any,
  userId: string,
  todayIso: string = new Date().toISOString().slice(0, 10),
): Promise<TrainingWeekSchedule | null> {
  const { data: plans } = await supabaseAdmin
    .from("nutrition_plans")
    .select("id, status, is_active, scheduled_start_date, scheduled_end_date, created_at")
    .eq("client_id", userId)
    .eq("plan_type", "training")
    .order("created_at", { ascending: false })
    .limit(30);

  const rows = (plans ?? []) as any[];
  if (!rows.length) return null;

  const notArchived = rows.filter((p) => p.status !== "archived");
  const inRange = (p: any) =>
    (!p.scheduled_start_date || p.scheduled_start_date <= todayIso) &&
    (!p.scheduled_end_date || p.scheduled_end_date >= todayIso);

  const plan =
    notArchived.find((p) => p.is_active && inRange(p)) ??
    notArchived.find((p) => inRange(p)) ??
    notArchived.find((p) => p.is_active) ??
    notArchived[0] ??
    rows.find(inRange) ??
    rows[0];
  if (!plan) return null;

  const { data: dayRows } = await supabaseAdmin
    .from("training_days")
    .select("id, name, day_date, sort_order, week_number")
    .eq("plan_id", plan.id)
    .order("week_number")
    .order("sort_order");

  const days = (dayRows ?? []) as any[];
  if (!days.length) return null;

  const { data: exRows } = await supabaseAdmin
    .from("training_exercises")
    .select("day_id")
    .in(
      "day_id",
      days.map((d) => d.id),
    );
  const counts = new Map<string, number>();
  for (const ex of (exRows ?? []) as any[]) {
    counts.set(ex.day_id, (counts.get(ex.day_id) ?? 0) + 1);
  }

  // Nur die erste Woche bestimmt die Wochenstruktur; Folgewochen wiederholen sie.
  const firstWeek = Math.min(...days.map((d) => Number(d.week_number ?? 1)));
  const weekDays = days.filter((d) => Number(d.week_number ?? 1) === firstWeek);

  return buildTrainingWeekSchedule(
    weekDays.map((d) => ({
      name: d.name,
      day_date: d.day_date,
      sort_order: d.sort_order,
      week_number: d.week_number,
      exercise_count: counts.get(d.id) ?? 0,
    })),
  );
}
