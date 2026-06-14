import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { daysUntilNextShopping } from "./shopping-cycle";

type ShoppingItem = {
  name: string;
  quantity: string;
  category: string;
};


/**
 * Generate (and cache) a shopping list for the user's currently active plan.
 * If `plan_id` is passed, generates for that plan instead.
 * Honors a `force` flag to bypass cache.
 */
export const generateShoppingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number; plan_id?: string; force?: boolean; scope?: "individual" | "combined" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve plan
    let planId = data.plan_id;
    if (!planId) {
      const { data: plan } = await supabase
        .from("nutrition_plans")
        .select("id")
        .eq("client_id", userId)
        .eq("plan_type", "nutrition")
        .eq("status", "active")
        .maybeSingle();
      if (!plan) throw new Error("Kein aktiver Ernährungsplan gefunden.");
      planId = (plan as any).id as string;
    }
    if (!planId) throw new Error("Kein Plan gefunden.");

    const { data: ownerPlan } = await supabaseAdmin
      .from("nutrition_plans")
      .select("id, client_id, partner_plan_id")
      .eq("id", planId)
      .eq("plan_type", "nutrition")
      .maybeSingle();
    if (!ownerPlan) throw new Error("Plan nicht gefunden.");
    if ((ownerPlan as any).client_id !== userId) {
      const { data: link } = await supabaseAdmin
        .from("nutrition_partners")
        .select("id")
        .or(`and(user_a.eq.${userId},user_b.eq.${(ownerPlan as any).client_id}),and(user_b.eq.${userId},user_a.eq.${(ownerPlan as any).client_id})`)
        .maybeSingle();
      if (!link) throw new Error("Kein Zugriff auf diesen Partner-Plan.");
    }


    // Determine window
    let windowDays = data.days;
    if (!windowDays) {
      const { data: prof } = await supabase
        .from("smart_nutrition_profile")
        .select("shopping_days")
        .eq("user_id", (ownerPlan as any).client_id)
        .maybeSingle();
      windowDays = daysUntilNextShopping((prof as any)?.shopping_days);
    }

    // Try cache (skip if force or windowDays explicit)
    if (!data.force && !data.days) {
      const { data: cached } = await supabase
        .from("shopping_lists")
        .select("items, days, generated_at")
        .eq("plan_id", planId)
        .eq("scope", data.scope === "combined" ? "partner_combined" : "individual")
        .maybeSingle();
      if (cached && (cached as any).items?.length) {
        return {
          items: (cached as any).items as ShoppingItem[],
          days: (cached as any).days as number,
          cached: true,
        };
      }
    }

    const { generateShoppingListForPlan, generateCombinedShoppingList } = await import("./shopping-list-engine.server");
    if (data.scope === "combined") {
      const { data: link } = await supabaseAdmin
        .from("nutrition_partners")
        .select("user_a, user_b")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .maybeSingle();
      if (!link) throw new Error("Kein Partner verknüpft.");
      const partnerUserId = (link as any).user_a === userId ? (link as any).user_b : (link as any).user_a;
      let partnerPlanId = (ownerPlan as any).partner_plan_id as string | null;
      if (!partnerPlanId) {
        const { data: partnerPlan } = await supabaseAdmin
          .from("nutrition_plans")
          .select("id")
          .eq("client_id", partnerUserId)
          .eq("plan_type", "nutrition")
          .in("status", ["active", "draft", "approved", "published"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        partnerPlanId = (partnerPlan as any)?.id ?? null;
      }
      if (!partnerPlanId) throw new Error("Kein Partner-Plan gefunden.");
      return await generateCombinedShoppingList({ apiKey, planAId: planId as string, planBId: partnerPlanId, userA: userId, userB: partnerUserId, windowDays });
    }
    return await generateShoppingListForPlan({ supabase, apiKey, planId: planId as string, windowDays });
  });

/**
 * Returns active & next plan summary plus their cached shopping lists.
 * Used by the customer "Aktuelle vs Nächste" toggle.
 */
export const getMyShoppingLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await supabase
      .from("smart_nutrition_profile")
      .select("shopping_days")
      .eq("user_id", userId)
      .maybeSingle();
    const window = daysUntilNextShopping((prof as any)?.shopping_days);

    const { data: plans } = await supabase
      .from("nutrition_plans")
      .select(
        "id, title, status, scheduled_start_date, scheduled_end_date, is_partner_plan, partner_plan_id",
      )
      .eq("client_id", userId)
      .eq("plan_type", "nutrition")
      .in("status", ["active", "draft", "approved", "published"])
      .order("created_at", { ascending: false });

    const all = (plans ?? []) as any[];
    const active = all.find((p) => p.status === "active") ?? null;
    const next =
      all.find((p) => ["draft", "approved", "published"].includes(p.status)) ?? null;

    const ids = [active?.id, next?.id].filter(Boolean) as string[];
    let listsByPlan: Record<string, any> = {};
    let combinedByPlan: Record<string, any> = {};
    if (ids.length) {
      const { data: rows } = await supabaseAdmin
        .from("shopping_lists")
        .select("plan_id, scope, items, days, generated_at, partner_user_id")
        .in("plan_id", ids);
      for (const r of rows ?? []) {
        const entry = { items: (r as any).items ?? [], days: (r as any).days ?? 7, generated_at: (r as any).generated_at, partner_user_id: (r as any).partner_user_id };
        if ((r as any).scope === "partner_combined") combinedByPlan[(r as any).plan_id] = entry;
        else listsByPlan[(r as any).plan_id] = entry;
      }
    }

    // Detect partner link & resolve partner's plan + name.
    const { data: link } = await supabase
      .from("nutrition_partners")
      .select("user_a, user_b")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .maybeSingle();
    const partnerUserId = link ? ((link as any).user_a === userId ? (link as any).user_b : (link as any).user_a) : null;

    let partnerName: string | null = null;
    let partnerPlan: any = null;
    let partnerList: any = null;
    if (partnerUserId) {
      const { data: pp } = await supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("id", partnerUserId)
        .maybeSingle();
      partnerName = (pp as any)?.display_name ?? "Partner";
      const { data: pPlans } = await supabaseAdmin
        .from("nutrition_plans")
        .select("id, title, status, scheduled_start_date, scheduled_end_date, partner_plan_id")
        .eq("client_id", partnerUserId)
        .eq("plan_type", "nutrition")
        .in("status", ["active", "draft", "approved", "published"])
        .order("created_at", { ascending: false });
      partnerPlan = (pPlans ?? []).find((p: any) => p.status === "active") ?? (pPlans ?? [])[0] ?? null;
      if (partnerPlan) {
        const { data: row } = await supabaseAdmin
          .from("shopping_lists")
          .select("items, days, generated_at")
          .eq("plan_id", partnerPlan.id)
          .eq("scope", "individual")
          .maybeSingle();
        partnerList = row ? { items: (row as any).items ?? [], days: (row as any).days ?? 7, generated_at: (row as any).generated_at } : null;
      }
    }

    return {
      active: active ? { ...active, list: listsByPlan[active.id] ?? null, combined: combinedByPlan[active.id] ?? null } : null,
      next: next ? { ...next, list: listsByPlan[next.id] ?? null, combined: combinedByPlan[next.id] ?? null } : null,
      window_days: window,
      partner: partnerUserId ? { user_id: partnerUserId, name: partnerName, plan: partnerPlan, list: partnerList } : null,
    };
  });

