import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ernährungsplan-Historie & Konflikt-Check für den Coach.
 * - Listet alle Ernährungspläne eines Kunden, gebucketed nach current/upcoming/past.
 * - Prüft Datumsüberlappungen für den Import-Flow.
 * - Erlaubt Status-Änderungen (aktivieren / archivieren) ohne andere Pläne anzurühren.
 */

async function assertCoach(ctx: { supabase: any; userId: string }) {
  const { data: isCoach } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "coach",
  });
  if (!isCoach) throw new Error("Nur für Coaches.");
}

export type CoachPlanRow = {
  id: string;
  title: string | null;
  status: string | null;
  source: string | null;
  generated_by: string | null;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  weeks_count: number | null;
  created_at: string | null;
};

export type CoachPlanBuckets = {
  current: CoachPlanRow[];
  upcoming: CoachPlanRow[];
  past: CoachPlanRow[];
  drafts: CoachPlanRow[];
  all: CoachPlanRow[];
};

const SELECT_COLS =
  "id,title,status,source,generated_by,scheduled_start_date,scheduled_end_date,weeks_count,created_at";

function bucketPlans(rows: CoachPlanRow[]): CoachPlanBuckets {
  const today = new Date().toISOString().slice(0, 10);
  const current: CoachPlanRow[] = [];
  const upcoming: CoachPlanRow[] = [];
  const past: CoachPlanRow[] = [];
  const drafts: CoachPlanRow[] = [];
  for (const p of rows) {
    if (p.status === "draft") {
      drafts.push(p);
      continue;
    }
    if (p.status === "archived") {
      past.push(p);
      continue;
    }
    const s = p.scheduled_start_date;
    const e = p.scheduled_end_date;
    if (s && e && s <= today && e >= today) current.push(p);
    else if (s && s > today) upcoming.push(p);
    else past.push(p);
  }
  return { current, upcoming, past, drafts, all: rows };
}

export const listCustomerNutritionPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("nutrition_plans")
      .select(SELECT_COLS)
      .eq("client_id", data.client_id)
      .eq("plan_type", "nutrition")
      .order("scheduled_start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return bucketPlans((rows ?? []) as CoachPlanRow[]);
  });

export const checkNutritionPlanConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { client_id: string; start_date: string; end_date: string; exclude_plan_id?: string }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    const { supabase } = context;
    let q = supabase
      .from("nutrition_plans")
      .select(SELECT_COLS)
      .eq("client_id", data.client_id)
      .eq("plan_type", "nutrition")
      .neq("status", "archived")
      .lte("scheduled_start_date", data.end_date)
      .gte("scheduled_end_date", data.start_date);
    if (data.exclude_plan_id) q = q.neq("id", data.exclude_plan_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { conflicts: (rows ?? []) as CoachPlanRow[] };
  });

export const setNutritionPlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      plan_id: string;
      status: "draft" | "approved" | "published" | "active" | "archived";
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { status: data.status };
    if (data.status === "archived") patch.archived_at = new Date().toISOString();
    if (data.status === "active" || data.status === "published") {
      patch.activated_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin
      .from("nutrition_plans")
      .update(patch)
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Kunden-seitig: alle für den Kunden sichtbaren, veröffentlichten Ernährungspläne.
 * Nützlich für die spätere Wochen-Übersicht in der App.
 */
export const listMyPublishedNutritionPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("nutrition_plans")
      .select(SELECT_COLS)
      .eq("client_id", userId)
      .eq("plan_type", "nutrition")
      .in("status", ["active", "published"])
      .order("scheduled_start_date", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CoachPlanRow[];
  });
