import { supabase } from "@/integrations/supabase/client";
import type { CoachClient, CoachDashboardData, CoachLead } from "@/features/coach-dashboard/types";

type QueryError = { message?: string } | null;
type QueryResult<T> = { data: T[] | null; error: QueryError };

type RoleRow = { user_id: string };
type ProfileRow = { id: string; display_name: string | null };
type CheckinRow = { user_id: string; week_start: string; submitted_at: string | null };
type MeasurementRow = { user_id: string; weight_kg: number | null; measured_at: string };
type FoodRow = { user_id: string; name: string; created_at: string };
type TrainingRow = { client_id: string; performed_at: string };
type PlanRow = {
  id: string;
  client_id: string;
  plan_type: string;
  scheduled_end_date: string | null;
  status: string;
};
type TargetRow = { user_id: string; kcal: number | null; kcal_rest: number | null };
type PlanDayRow = { id: string; plan_id: string; name: string };
type PlanMealRow = { day_id: string; kcal: number | null };
type LeadRow = CoachLead;

async function readRows<T>(label: string, query: PromiseLike<QueryResult<T>>): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    console.error(`coach dashboard: ${label}`, error);
    return [];
  }
  return data ?? [];
}

function newestByKey<T, K>(rows: T[], keyOf: (row: T) => K): Map<K, T> {
  const map = new Map<K, T>();
  rows.forEach((row) => {
    const key = keyOf(row);
    if (!map.has(key)) map.set(key, row);
  });
  return map;
}

async function loadPlanMealsInBatches(dayIds: string[]): Promise<PlanMealRow[]> {
  if (dayIds.length === 0) return [];

  const batchSize = 50;
  const batches: string[][] = [];

  for (let index = 0; index < dayIds.length; index += batchSize) {
    batches.push(dayIds.slice(index, index + batchSize));
  }

  const rows = await Promise.all(
    batches.map((ids, index) =>
      readRows<PlanMealRow>(
        `nutrition plan meals ${index + 1}/${batches.length}`,
        supabase.from("nutrition_plan_meals").select("day_id, kcal").in("day_id", ids),
      ),
    ),
  );

  return rows.flat();
}

async function loadClients(clientIds: string[]): Promise<CoachClient[]> {
  if (clientIds.length === 0) return [];

  const [profiles, checkins, measurements, foods, trainingSets, plans] = await Promise.all([
    readRows<ProfileRow>(
      "profiles",
      supabase.from("profiles").select("id, display_name").in("id", clientIds),
    ),
    readRows<CheckinRow>(
      "weekly checkins",
      supabase
        .from("weekly_checkins")
        .select("user_id, week_start, submitted_at")
        .in("user_id", clientIds)
        .order("week_start", { ascending: false }),
    ),
    readRows<MeasurementRow>(
      "measurements",
      supabase
        .from("body_measurements")
        .select("user_id, weight_kg, measured_at")
        .in("user_id", clientIds)
        .order("measured_at", { ascending: false }),
    ),
    readRows<FoodRow>(
      "food entries",
      supabase
        .from("food_entries")
        .select("user_id, name, created_at")
        .in("user_id", clientIds)
        .order("created_at", { ascending: false })
        .limit(200),
    ),
    readRows<TrainingRow>(
      "training logs",
      supabase
        .from("training_set_logs")
        .select("client_id, performed_at")
        .in("client_id", clientIds)
        .order("performed_at", { ascending: false })
        .limit(200),
    ),
    readRows<PlanRow>(
      "active plans",
      supabase
        .from("nutrition_plans")
        .select("id, client_id, plan_type, scheduled_end_date, status")
        .in("client_id", clientIds)
        .eq("status", "active"),
    ),
  ]);

  const activeNutritionPlans = plans.filter((plan) => plan.plan_type === "nutrition");
  const nutritionPlanIds = activeNutritionPlans.map((plan) => plan.id);
  const planToClient = new Map(
    activeNutritionPlans.map((plan) => [plan.id, plan.client_id] as const),
  );

  const [targets, planDays] = await Promise.all([
    readRows<TargetRow>(
      "nutrition targets",
      supabase
        .from("nutrition_targets")
        .select("user_id, kcal, kcal_rest")
        .in("user_id", clientIds),
    ),
    nutritionPlanIds.length > 0
      ? readRows<PlanDayRow>(
          "nutrition plan days",
          supabase
            .from("nutrition_plan_days")
            .select("id, plan_id, name")
            .in("plan_id", nutritionPlanIds),
        )
      : Promise.resolve([]),
  ]);

  const planDayIds = planDays.map((day) => day.id);
  const planMeals = await loadPlanMealsInBatches(planDayIds);

  const caloriesByDay = new Map<string, number>();
  planMeals.forEach((meal) => {
    if (meal.kcal == null) return;
    caloriesByDay.set(meal.day_id, (caloriesByDay.get(meal.day_id) ?? 0) + Number(meal.kcal));
  });

  const targetByUser = new Map(
    targets.map(
      (target) =>
        [
          target.user_id,
          {
            training: target.kcal,
            rest: target.kcal_rest ?? target.kcal,
          },
        ] as const,
    ),
  );

  const kcalDeviation = new Map<string, { dev: number; dir: "over" | "under" }>();
  planDays.forEach((day) => {
    const clientId = planToClient.get(day.plan_id);
    const targetsForClient = clientId ? targetByUser.get(clientId) : null;
    const calories = caloriesByDay.get(day.id);
    if (!clientId || !targetsForClient || calories == null) return;

    const isRestDay = /(rest|ruhe|pause)/i.test(day.name || "");
    const target = isRestDay ? targetsForClient.rest : targetsForClient.training;
    if (!target) return;

    const difference = calories - target;
    const absoluteDifference = Math.abs(difference);
    const previous = kcalDeviation.get(clientId);
    if (!previous || absoluteDifference > previous.dev) {
      kcalDeviation.set(clientId, {
        dev: absoluteDifference,
        dir: difference >= 0 ? "over" : "under",
      });
    }
  });

  const lastCheckin = newestByKey(checkins, (row) => row.user_id);
  const lastWeight = newestByKey(measurements, (row) => row.user_id);
  const lastFood = newestByKey(foods, (row) => row.user_id);
  const lastTraining = newestByKey(trainingSets, (row) => row.client_id);

  const measurementsByUser = new Map<string, MeasurementRow[]>();
  measurements.forEach((measurement) => {
    if (measurement.weight_kg == null) return;
    const list = measurementsByUser.get(measurement.user_id) ?? [];
    list.push(measurement);
    measurementsByUser.set(measurement.user_id, list);
  });

  const nowMs = Date.now();
  const plateauByUser = new Map<string, number>();
  measurementsByUser.forEach((series, userId) => {
    if (series.length < 2 || series[0].weight_kg == null) return;
    const latest = series[0];
    const reference = series.find((measurement) => {
      const age = (nowMs - new Date(measurement.measured_at).getTime()) / 86_400_000;
      return age >= 10 && age <= 21;
    });

    if (
      reference?.weight_kg != null &&
      Math.abs(Number(latest.weight_kg) - Number(reference.weight_kg)) <= 0.3
    ) {
      plateauByUser.set(
        userId,
        Math.round((nowMs - new Date(reference.measured_at).getTime()) / 86_400_000),
      );
    }
  });

  const nutritionEnd = new Map<string, string>();
  const trainingEnd = new Map<string, string>();
  plans.forEach((plan) => {
    if (!plan.scheduled_end_date) return;
    const targetMap = plan.plan_type === "training" ? trainingEnd : nutritionEnd;
    const current = targetMap.get(plan.client_id);
    if (!current || plan.scheduled_end_date > current) {
      targetMap.set(plan.client_id, plan.scheduled_end_date);
    }
  });

  return profiles.map((profile) => ({
    id: profile.id,
    display_name: profile.display_name,
    last_checkin: lastCheckin.get(profile.id)?.week_start ?? null,
    last_weight: lastWeight.get(profile.id)?.weight_kg ?? null,
    last_weight_at: lastWeight.get(profile.id)?.measured_at ?? null,
    last_nutrition_at: lastFood.get(profile.id)?.created_at ?? null,
    last_nutrition_name: lastFood.get(profile.id)?.name ?? null,
    last_training_at: lastTraining.get(profile.id)?.performed_at ?? null,
    nutrition_plan_end: nutritionEnd.get(profile.id) ?? null,
    training_plan_end: trainingEnd.get(profile.id) ?? null,
    kcal_dev: kcalDeviation.get(profile.id)?.dev ?? null,
    kcal_dev_dir: kcalDeviation.get(profile.id)?.dir ?? null,
    plateau_days: plateauByUser.get(profile.id) ?? null,
  }));
}

export async function loadCoachDashboardData(): Promise<CoachDashboardData> {
  const roles = await readRows<RoleRow>(
    "client roles",
    supabase.from("user_roles").select("user_id").eq("role", "client"),
  );
  const clientIds = [...new Set(roles.map((role) => role.user_id).filter(Boolean))];

  const [clients, leads] = await Promise.all([
    loadClients(clientIds),
    readRows<LeadRow>(
      "leads",
      supabase
        .from("leads")
        .select("id, name, email, goal, created_at")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(10),
    ),
  ]);

  return { clients, leads };
}
