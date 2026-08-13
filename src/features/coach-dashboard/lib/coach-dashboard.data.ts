import type { SupabaseClient } from "@supabase/supabase-js";

import type { CoachClient, CoachDashboardData, CoachLead } from "@/features/coach-dashboard/types";
import { coachDateKey } from "@/features/coach-dashboard/lib/coach-dashboard.logic";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type QueryError = { message?: string } | null;
type QueryResult<T> = { data: T[] | null; error: QueryError };

type CoachDataClient = SupabaseClient<Database>;
type ActivePackageRow = {
  user_id: string;
  package: string;
  source: string | null;
  end_date: string | null;
  status: string | null;
};
type ProfileRow = { id: string; display_name: string | null };
type CheckinRow = {
  user_id: string;
  week_start: string;
  submitted_at: string | null;
  coach_notes: string | null;
};
type MeasurementRow = { user_id: string; weight_kg: number | null; measured_at: string };
type LatestActivityRow = {
  user_id: string;
  last_nutrition_at: string | null;
  last_nutrition_name: string | null;
  last_training_at: string | null;
};
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

export function countActiveProductCustomers(
  rows: ActivePackageRow[],
  today = coachDateKey(new Date()),
) {
  const coaching = new Set<string>();
  const smart = new Set<string>();

  rows.forEach((row) => {
    const status = row.status?.toLowerCase();
    const isEnded = ["canceled", "cancelled", "expired", "inactive"].includes(status ?? "");
    const isCurrent = !row.end_date || row.end_date >= today;
    if (isEnded || !isCurrent) return;

    if (["starter", "coaching", "premium"].includes(row.package)) {
      coaching.add(row.user_id);
    }

    if (row.package === "smart" && row.source !== "trial" && isCurrent) {
      smart.add(row.user_id);
    }
  });

  return {
    coachingIds: [...coaching],
    productCounts: { coaching: coaching.size, smart: smart.size },
  };
}

async function readRows<T>(
  label: string,
  query: PromiseLike<QueryResult<T>>,
  strict = false,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    if (strict) throw new Error(`coach dashboard: ${label}: ${error.message ?? "query failed"}`);
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

async function loadPlanMealsInBatches(
  client: CoachDataClient,
  dayIds: string[],
  strict: boolean,
): Promise<PlanMealRow[]> {
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
        client.from("nutrition_plan_meals").select("day_id, kcal").in("day_id", ids),
        strict,
      ),
    ),
  );

  return rows.flat();
}

async function loadClients(
  client: CoachDataClient,
  clientIds: string[],
  strict: boolean,
): Promise<CoachClient[]> {
  if (clientIds.length === 0) return [];

  const [profiles, checkins, measurements, latestActivities, plans] = await Promise.all([
    readRows<ProfileRow>(
      "profiles",
      client.from("profiles").select("id, display_name").in("id", clientIds),
      strict,
    ),
    readRows<CheckinRow>(
      "weekly checkins",
      client
        .from("weekly_checkins")
        .select("user_id, week_start, submitted_at, coach_notes")
        .in("user_id", clientIds)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false }),
      strict,
    ),
    readRows<MeasurementRow>(
      "measurements",
      client
        .from("body_measurements")
        .select("user_id, weight_kg, measured_at")
        .in("user_id", clientIds)
        .order("measured_at", { ascending: false }),
      strict,
    ),
    readRows<LatestActivityRow>(
      "latest client activity",
      client.rpc("coach_latest_client_activity", { _client_ids: clientIds }),
      strict,
    ),
    readRows<PlanRow>(
      "active plans",
      client
        .from("nutrition_plans")
        .select("id, client_id, plan_type, scheduled_end_date, status")
        .in("client_id", clientIds)
        .eq("status", "active"),
      strict,
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
      client.from("nutrition_targets").select("user_id, kcal, kcal_rest").in("user_id", clientIds),
      strict,
    ),
    nutritionPlanIds.length > 0
      ? readRows<PlanDayRow>(
          "nutrition plan days",
          client
            .from("nutrition_plan_days")
            .select("id, plan_id, name")
            .in("plan_id", nutritionPlanIds),
          strict,
        )
      : Promise.resolve([]),
  ]);

  const planDayIds = planDays.map((day) => day.id);
  const planMeals = await loadPlanMealsInBatches(client, planDayIds, strict);

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
  const pendingCutoff = Date.now() - 7 * 86_400_000;
  const pendingCheckin = newestByKey(
    checkins.filter(
      (row) =>
        row.submitted_at !== null &&
        new Date(row.submitted_at).getTime() >= pendingCutoff &&
        !row.coach_notes?.trim(),
    ),
    (row) => row.user_id,
  );
  const lastWeight = newestByKey(measurements, (row) => row.user_id);
  const latestActivityByUser = new Map(
    latestActivities.map((activity) => [activity.user_id, activity] as const),
  );

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
    last_checkin_submitted_at: lastCheckin.get(profile.id)?.submitted_at ?? null,
    pending_checkin_week_start: pendingCheckin.get(profile.id)?.week_start ?? null,
    pending_checkin_submitted_at: pendingCheckin.get(profile.id)?.submitted_at ?? null,
    last_weight: lastWeight.get(profile.id)?.weight_kg ?? null,
    last_weight_at: lastWeight.get(profile.id)?.measured_at ?? null,
    last_nutrition_at: latestActivityByUser.get(profile.id)?.last_nutrition_at ?? null,
    last_nutrition_name: latestActivityByUser.get(profile.id)?.last_nutrition_name ?? null,
    last_training_at: latestActivityByUser.get(profile.id)?.last_training_at ?? null,
    nutrition_plan_end: nutritionEnd.get(profile.id) ?? null,
    training_plan_end: trainingEnd.get(profile.id) ?? null,
    kcal_dev: kcalDeviation.get(profile.id)?.dev ?? null,
    kcal_dev_dir: kcalDeviation.get(profile.id)?.dir ?? null,
    plateau_days: plateauByUser.get(profile.id) ?? null,
  }));
}

export async function loadCoachDashboardDataForClient(
  client: CoachDataClient,
  options: { strict?: boolean } = {},
): Promise<CoachDashboardData> {
  const strict = options.strict ?? false;
  // "Mein BODYFUEL" is the personal coaching workspace. A global client role
  // alone only means that somebody registered at some point; it does not mean
  // that Manuel is actively coaching that person.
  const activePackages = await readRows<ActivePackageRow>(
    "active customer packages",
    client
      .from("customer_packages")
      .select("user_id, package, source, end_date, status")
      .eq("is_active", true),
    strict,
  );
  const { coachingIds: clientIds, productCounts } = countActiveProductCustomers(activePackages);

  const [clients, leads] = await Promise.all([
    loadClients(client, clientIds, strict),
    readRows<LeadRow>(
      "leads",
      client
        .from("leads")
        .select("id, name, email, goal, created_at")
        .eq("status", "new")
        .order("created_at", { ascending: false }),
      strict,
    ),
  ]);

  return { clients, leads, productCounts };
}

export async function loadCoachDashboardData(): Promise<CoachDashboardData> {
  return loadCoachDashboardDataForClient(supabase);
}
