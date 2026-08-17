import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type CoachTrainingPlanWriteClient = SupabaseClient<Database>;

export type CoachTrainingPlanWriteRow = {
  id: string;
  client_id: string;
  title: string;
  plan_type: string;
  performance_context: boolean | null;
  status: string;
  is_active: boolean | null;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  activated_at: string | null;
  archived_at: string | null;
};

const PLAN_SELECT =
  "id, client_id, title, plan_type, performance_context, status, is_active, scheduled_start_date, scheduled_end_date, activated_at, archived_at";

export function assertIsoDate(value: string, label = "Date"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} is not a valid calendar date.`);
  }

  return value;
}

export function berlinDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function assertPersonalTrainingPlan(plan: CoachTrainingPlanWriteRow): void {
  if (plan.plan_type !== "training") throw new Error("Plan is not a training plan.");
  if (plan.performance_context === true) {
    throw new Error("Performance/team training plans cannot be changed through this MCP action.");
  }
}

async function loadPlan(
  client: CoachTrainingPlanWriteClient,
  planId: string,
): Promise<CoachTrainingPlanWriteRow> {
  const { data, error } = await client
    .from("nutrition_plans")
    .select(PLAN_SELECT)
    .eq("id", planId)
    .maybeSingle();

  if (error) throw new Error(`Training plan lookup failed: ${error.message}`);
  if (!data) throw new Error("Training plan not found.");

  const plan = data as unknown as CoachTrainingPlanWriteRow;
  assertPersonalTrainingPlan(plan);
  return plan;
}

export async function updateCoachTrainingPlanEndDate(
  client: CoachTrainingPlanWriteClient,
  input: { planId: string; scheduledEndDate: string },
): Promise<CoachTrainingPlanWriteRow> {
  const endDate = assertIsoDate(input.scheduledEndDate, "scheduled_end_date");
  const plan = await loadPlan(client, input.planId);

  if (plan.scheduled_start_date && endDate < plan.scheduled_start_date) {
    throw new Error("scheduled_end_date cannot be before scheduled_start_date.");
  }

  const { data, error } = await client
    .from("nutrition_plans")
    .update({ scheduled_end_date: endDate })
    .eq("id", plan.id)
    .select(PLAN_SELECT)
    .single();

  if (error) throw new Error(`Training plan end date update failed: ${error.message}`);
  return data as unknown as CoachTrainingPlanWriteRow;
}

export async function reactivateCoachTrainingPlan(
  client: CoachTrainingPlanWriteClient,
  input: { planId: string; replaceActive?: boolean },
): Promise<CoachTrainingPlanWriteRow> {
  const target = await loadPlan(client, input.planId);

  if (target.status === "active" && target.is_active === true) return target;
  if (target.status !== "archived") {
    throw new Error(`Only archived training plans can be reactivated (current status: ${target.status}).`);
  }
  if (target.scheduled_end_date && target.scheduled_end_date < berlinDateKey()) {
    throw new Error("Training plan end date is in the past. Update the end date before reactivating it.");
  }

  const { data: activeData, error: activeError } = await client
    .from("nutrition_plans")
    .select(PLAN_SELECT)
    .eq("client_id", target.client_id)
    .eq("plan_type", "training")
    .eq("status", "active")
    .neq("id", target.id)
    .maybeSingle();

  if (activeError) throw new Error(`Active training plan lookup failed: ${activeError.message}`);

  const active = activeData as unknown as CoachTrainingPlanWriteRow | null;
  if (active) {
    assertPersonalTrainingPlan(active);
    if (!input.replaceActive) {
      throw new Error(
        `Customer already has an active training plan (${active.id}). Set replace_active=true only if it should be archived and replaced.`,
      );
    }
  }

  const activatedAt = new Date().toISOString();
  let archivedExisting = false;

  try {
    if (active) {
      const { error } = await client
        .from("nutrition_plans")
        .update({ status: "archived", is_active: false, archived_at: activatedAt })
        .eq("id", active.id);
      if (error) throw new Error(`Existing active training plan could not be archived: ${error.message}`);
      archivedExisting = true;
    }

    const { data, error } = await client
      .from("nutrition_plans")
      .update({
        status: "active",
        is_active: true,
        activated_at: activatedAt,
        archived_at: null,
      })
      .eq("id", target.id)
      .select(PLAN_SELECT)
      .single();

    if (error) throw new Error(`Training plan reactivation failed: ${error.message}`);
    return data as unknown as CoachTrainingPlanWriteRow;
  } catch (error) {
    if (active && archivedExisting) {
      const { error: rollbackError } = await client
        .from("nutrition_plans")
        .update({
          status: "active",
          is_active: true,
          activated_at: active.activated_at,
          archived_at: active.archived_at,
        })
        .eq("id", active.id);
      if (rollbackError) {
        throw new Error(
          `${error instanceof Error ? error.message : "Training plan reactivation failed."} Rollback also failed: ${rollbackError.message}`,
        );
      }
    }
    throw error;
  }
}
