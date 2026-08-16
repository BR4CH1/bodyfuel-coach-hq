export type TrackerPlanDay = {
  id: string;
  name: string | null;
  day_type?: string | null;
  target_kcal?: number | null;
  target_protein_g?: number | null;
  target_carbs_g?: number | null;
  target_fat_g?: number | null;
};

export type TrackerPlanMeal = {
  day_id: string;
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
};

export type TrackerTargetSet = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type TrackerPlanTargets = TrackerTargetSet & {
  kcal_rest: number | null;
  protein_g_rest: number | null;
  carbs_g_rest: number | null;
  fat_g_rest: number | null;
};

type DayTotals = TrackerTargetSet & { kind: "training" | "rest" };

function asPositiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function roundKcal(value: number): number {
  return Math.max(50, Math.round(value / 50) * 50);
}

export function resolveNutritionPlanDayType(
  day: Pick<TrackerPlanDay, "name" | "day_type">,
): "training" | "rest" {
  const explicit = String(day.day_type ?? "").trim().toLowerCase();
  if (explicit) {
    if (/rest|regen|off|frei|pause|ruhe/.test(explicit)) return "rest";
    if (/train|workout|gym|football|sport/.test(explicit)) return "training";
  }

  // Legacy imported plans did not always persist day_type. Keep name matching
  // only as a fallback; current plans should use the explicit DB field.
  return /rest|regen|off|frei|pause|ruhe/i.test(String(day.name ?? "")) ? "rest" : "training";
}

function totalsForDay(day: TrackerPlanDay, meals: TrackerPlanMeal[]): TrackerTargetSet | null {
  const explicitKcal = asPositiveNumber(day.target_kcal);
  if (explicitKcal) {
    return {
      kcal: explicitKcal,
      protein_g: asPositiveNumber(day.target_protein_g) ?? 0,
      carbs_g: asPositiveNumber(day.target_carbs_g) ?? 0,
      fat_g: asPositiveNumber(day.target_fat_g) ?? 0,
    };
  }

  const dayMeals = meals.filter((meal) => meal.day_id === day.id);
  if (!dayMeals.length) return null;

  const totals = dayMeals.reduce(
    (sum, meal) => ({
      kcal: sum.kcal + (asPositiveNumber(meal.kcal) ?? 0),
      protein_g: sum.protein_g + (asPositiveNumber(meal.protein_g) ?? 0),
      carbs_g: sum.carbs_g + (asPositiveNumber(meal.carbs_g) ?? 0),
      fat_g: sum.fat_g + (asPositiveNumber(meal.fat_g) ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return totals.kcal > 0 ? totals : null;
}

function average(rows: DayTotals[]): TrackerTargetSet | null {
  if (!rows.length) return null;
  const count = rows.length;
  return {
    kcal: roundKcal(rows.reduce((sum, row) => sum + row.kcal, 0) / count),
    protein_g: Math.round(rows.reduce((sum, row) => sum + row.protein_g, 0) / count),
    carbs_g: Math.round(rows.reduce((sum, row) => sum + row.carbs_g, 0) / count),
    fat_g: Math.round(rows.reduce((sum, row) => sum + row.fat_g, 0) / count),
  };
}

export function computeTrackerTargetsFromPlan(
  days: TrackerPlanDay[],
  meals: TrackerPlanMeal[],
): TrackerPlanTargets | null {
  const rows: DayTotals[] = [];

  for (const day of days) {
    const totals = totalsForDay(day, meals);
    if (!totals) continue;
    rows.push({ ...totals, kind: resolveNutritionPlanDayType(day) });
  }

  if (!rows.length) return null;

  const trainingRows = rows.filter((row) => row.kind === "training");
  const restRows = rows.filter((row) => row.kind === "rest");
  const base = average(trainingRows.length ? trainingRows : rows);
  if (!base) return null;
  const rest = trainingRows.length ? average(restRows) : null;

  return {
    ...base,
    kcal_rest: rest?.kcal ?? null,
    protein_g_rest: rest?.protein_g ?? null,
    carbs_g_rest: rest?.carbs_g ?? null,
    fat_g_rest: rest?.fat_g ?? null,
  };
}

export function isNutritionPlanActiveOnDate(
  date: string,
  scheduledStartDate?: string | null,
  scheduledEndDate?: string | null,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const start = scheduledStartDate?.slice(0, 10) ?? null;
  const end = scheduledEndDate?.slice(0, 10) ?? null;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}
