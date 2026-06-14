import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { daysUntilNextShopping } from "./shopping-cycle";

export type PlanStatus = "draft" | "approved" | "published" | "active" | "archived";

export type PlanSummary = {
  id: string;
  title: string;
  status: PlanStatus;
  source: string;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  activated_at: string | null;
  archived_at: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
  days_count: number;
  meals_count: number;
  compliance: { score: number; tone: "green" | "yellow" | "red"; days_tracked: number } | null;
};

// Max daily check score = 15 (matches compute_daily_check_points trigger weights).
const MAX_DAILY_POINTS = 15;

async function computeCompliance(
  supabase: any,
  clientId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<PlanSummary["compliance"]> {
  if (!fromIso) return null;
  const from = fromIso.slice(0, 10);
  const to = (toIso ?? new Date().toISOString()).slice(0, 10);
  const { data: checks } = await supabase
    .from("daily_checks")
    .select("points, check_date")
    .eq("user_id", clientId)
    .gte("check_date", from)
    .lte("check_date", to);
  const rows = (checks ?? []) as any[];
  if (!rows.length) return { score: 0, tone: "red", days_tracked: 0 };
  const avg =
    rows.reduce((s, r) => s + (Number(r.points) || 0), 0) / rows.length;
  const score = Math.round(Math.min(100, (avg / MAX_DAILY_POINTS) * 100));
  const tone: "green" | "yellow" | "red" =
    score >= 75 ? "green" : score >= 50 ? "yellow" : "red";
  return { score, tone, days_tracked: rows.length };
}

async function requireCoach(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
  if (!data) throw new Error("Forbidden");
}

async function loadPlan(supabase: any, id: string): Promise<PlanSummary | null> {
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select(
      "id, client_id, title, status, source, scheduled_start_date, scheduled_end_date, activated_at, archived_at, kcal, protein_g, carbs_g, fat_g, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!plan) return null;
  const { data: days } = await supabase
    .from("nutrition_plan_days")
    .select("id")
    .eq("plan_id", id);
  const dayIds = (days ?? []).map((d: any) => d.id);
  let mealsCount = 0;
  if (dayIds.length) {
    const { count } = await supabase
      .from("nutrition_plan_meals")
      .select("id", { count: "exact", head: true })
      .in("day_id", dayIds);
    mealsCount = count ?? 0;
  }
  const p: any = plan;
  let compliance: PlanSummary["compliance"] = null;
  if (p.status === "active" || p.status === "archived") {
    compliance = await computeCompliance(
      supabase,
      p.client_id,
      p.activated_at,
      p.archived_at,
    );
  }
  return {
    ...p,
    days_count: dayIds.length,
    meals_count: mealsCount,
    compliance,
  };
}

export const getCustomerPlanOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id !== userId) await requireCoach(supabase, userId);

    const { data: rows } = await supabase
      .from("nutrition_plans")
      .select(
        "id, title, status, source, scheduled_start_date, scheduled_end_date, activated_at, archived_at, kcal, protein_g, carbs_g, fat_g, created_at",
      )
      .eq("client_id", data.user_id)
      .eq("plan_type", "nutrition")
      .order("created_at", { ascending: false });

    const all = (rows ?? []) as any[];
    const active = all.find((p) => p.status === "active") ?? null;
    const next =
      all.find((p) => ["draft", "approved", "published"].includes(p.status)) ?? null;
    const archive = all.filter((p) => p.status === "archived").slice(0, 25);

    const [activeFull, nextFull] = await Promise.all([
      active ? loadPlan(supabase, active.id) : Promise.resolve(null),
      next ? loadPlan(supabase, next.id) : Promise.resolve(null),
    ]);

    // also include shopping days for "next shopping" hint
    const { data: prof } = await supabase
      .from("smart_nutrition_profile")
      .select("shopping_days, auto_publish")
      .eq("user_id", data.user_id)
      .maybeSingle();

    return {
      active: activeFull,
      next: nextFull,
      archive: archive.map((p) => ({ ...p, days_count: 0, meals_count: 0 })),
      shopping_days: (prof as any)?.shopping_days ?? [],
      auto_publish: (prof as any)?.auto_publish ?? false,
      days_until_next_shopping: daysUntilNextShopping((prof as any)?.shopping_days),
    };
  });

export const transitionPlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_id: string; to: PlanStatus }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireCoach(supabase, userId);

    const { data: plan } = await supabase
      .from("nutrition_plans")
      .select("id, client_id, plan_type, status")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan nicht gefunden");

    // If transitioning to active, archive the currently active plan first
    if (data.to === "active") {
      await supabase
        .from("nutrition_plans")
        .update({ status: "archived" })
        .eq("client_id", (plan as any).client_id)
        .eq("plan_type", (plan as any).plan_type)
        .eq("status", "active")
        .neq("id", data.plan_id);
    }

    const { error } = await supabase
      .from("nutrition_plans")
      .update({ status: data.to })
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true, status: data.to };
  });

export const deletePlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireCoach(supabase, userId);
    const { data: plan } = await supabase
      .from("nutrition_plans")
      .select("status")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan nicht gefunden");
    if ((plan as any).status === "active")
      throw new Error("Aktiver Plan kann nicht gelöscht werden — erst archivieren.");
    const { error } = await supabase
      .from("nutrition_plans")
      .delete()
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePlanScheduling = createServerFn({ method: "POST" })
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
    const { supabase, userId } = context;
    await requireCoach(supabase, userId);
    const patch: any = {};
    if (data.scheduled_start_date !== undefined)
      patch.scheduled_start_date = data.scheduled_start_date;
    if (data.scheduled_end_date !== undefined)
      patch.scheduled_end_date = data.scheduled_end_date;
    if (data.title !== undefined) patch.title = data.title;
    const { error } = await supabase
      .from("nutrition_plans")
      .update(patch)
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAutoPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; auto_publish: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id !== userId) await requireCoach(supabase, userId);
    const { error } = await supabase
      .from("smart_nutrition_profile")
      .upsert(
        { user_id: data.user_id, auto_publish: data.auto_publish },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
