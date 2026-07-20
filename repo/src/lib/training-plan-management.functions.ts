import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";

export type TrainingPlanStatus =
  | "draft"
  | "approved"
  | "published"
  | "active"
  | "archived";

export type TrainingPlanSummary = {
  id: string;
  title: string;
  status: TrainingPlanStatus;
  source: string;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  activated_at: string | null;
  archived_at: string | null;
  created_at: string;
  days_count: number;
  exercises_count: number;
};

async function loadTrainingPlan(
  supabase: any,
  id: string,
): Promise<TrainingPlanSummary | null> {
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select(
      "id, client_id, title, status, source, scheduled_start_date, scheduled_end_date, activated_at, archived_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!plan) return null;
  const { data: days } = await supabase
    .from("training_days")
    .select("id")
    .eq("plan_id", id);
  const dayIds = (days ?? []).map((d: any) => d.id);
  let exerciseCount = 0;
  if (dayIds.length) {
    const { count } = await supabase
      .from("training_exercises")
      .select("id", { count: "exact", head: true })
      .in("day_id", dayIds);
    exerciseCount = count ?? 0;
  }
  return {
    ...(plan as any),
    days_count: dayIds.length,
    exercises_count: exerciseCount,
  };
}

export const getCustomerTrainingPlanOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let db = supabase;
    if (data.user_id !== userId) {
      await assertCoachOrOrgStaffForAthlete(context, data.user_id, "training");
      db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    }

    const { data: rows } = await db
      .from("nutrition_plans")
      .select(
        "id, title, status, source, scheduled_start_date, scheduled_end_date, activated_at, archived_at, created_at",
      )
      .eq("client_id", data.user_id)
      .eq("plan_type", "training")
      .order("created_at", { ascending: false });

    const all = (rows ?? []) as any[];
    const active = all.find((p) => p.status === "active") ?? null;
    const next =
      all.find((p) => ["draft", "approved", "published"].includes(p.status)) ??
      null;
    const archive = all.filter((p) => p.status === "archived").slice(0, 25);

    const [activeFull, nextFull] = await Promise.all([
      active ? loadTrainingPlan(db, active.id) : Promise.resolve(null),
      next ? loadTrainingPlan(db, next.id) : Promise.resolve(null),
    ]);

    const { data: prof } = await db
      .from("smart_nutrition_profile")
      .select("auto_publish_training, training_weekdays")
      .eq("user_id", data.user_id)
      .maybeSingle();

    return {
      active: activeFull,
      next: nextFull,
      archive,
      auto_publish: (prof as any)?.auto_publish_training ?? false,
      training_weekdays: (prof as any)?.training_weekdays ?? [],
    };
  });

export const transitionTrainingPlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { plan_id: string; to: TrainingPlanStatus }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan } = await supabaseAdmin
      .from("nutrition_plans")
      .select("id, client_id, plan_type, status")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan || (plan as any).plan_type !== "training")
      throw new Error("Trainingsplan nicht gefunden");
    await assertCoachOrOrgStaffForAthlete(context, (plan as any).client_id, "training");

    if (data.to === "active") {
      await supabaseAdmin
        .from("nutrition_plans")
        .update({ status: "archived" })
        .eq("client_id", (plan as any).client_id)
        .eq("plan_type", "training")
        .eq("status", "active")
        .neq("id", data.plan_id);
    }

    const { error } = await supabaseAdmin
      .from("nutrition_plans")
      .update({ status: data.to })
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true, status: data.to };
  });

export const deleteTrainingPlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("nutrition_plans")
      .select("client_id, status, plan_type")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan nicht gefunden");
    await assertCoachOrOrgStaffForAthlete(context, (plan as any).client_id, "training");
    if ((plan as any).status === "active")
      throw new Error("Aktiver Plan kann nicht gelöscht werden — erst archivieren.");
    const { error } = await supabaseAdmin
      .from("nutrition_plans")
      .delete()
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTrainingPlanScheduling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      plan_id: string;
      scheduled_start_date?: string | null;
      scheduled_end_date?: string | null;
      title?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("nutrition_plans")
      .select("client_id, plan_type")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan || (plan as any).plan_type !== "training") throw new Error("Trainingsplan nicht gefunden");
    await assertCoachOrOrgStaffForAthlete(context, (plan as any).client_id, "training");
    const patch: any = {};
    if (data.scheduled_start_date !== undefined)
      patch.scheduled_start_date = data.scheduled_start_date;
    if (data.scheduled_end_date !== undefined)
      patch.scheduled_end_date = data.scheduled_end_date;
    if (data.title !== undefined) patch.title = data.title;
    const { error } = await supabaseAdmin
      .from("nutrition_plans")
      .update(patch)
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAutoPublishTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; auto_publish: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = data.user_id === userId
      ? supabase
      : (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    if (data.user_id !== userId) await assertCoachOrOrgStaffForAthlete(context, data.user_id, "training");
    const { error } = await db
      .from("smart_nutrition_profile")
      .upsert(
        { user_id: data.user_id, auto_publish_training: data.auto_publish },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
