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
  .inputValidator((d: { days?: number; plan_id?: string; force?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

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


    // Determine window
    let windowDays = data.days;
    if (!windowDays) {
      const { data: prof } = await supabase
        .from("smart_nutrition_profile")
        .select("shopping_days")
        .eq("user_id", userId)
        .maybeSingle();
      windowDays = daysUntilNextShopping((prof as any)?.shopping_days);
    }

    // Try cache (skip if force or windowDays explicit)
    if (!data.force && !data.days) {
      const { data: cached } = await supabase
        .from("shopping_lists")
        .select("items, days, generated_at")
        .eq("plan_id", planId)
        .maybeSingle();
      if (cached && (cached as any).items?.length) {
        return {
          items: (cached as any).items as ShoppingItem[],
          days: (cached as any).days as number,
          cached: true,
        };
      }
    }

    return await generateForPlan({ supabase, apiKey, planId: planId as string, windowDays });
  });

/**
 * Returns active & next plan summary plus their cached shopping lists.
 * Used by the customer "Aktuelle vs Nächste" toggle.
 */
export const getMyShoppingLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("smart_nutrition_profile")
      .select("shopping_days")
      .eq("user_id", userId)
      .maybeSingle();
    const window = daysUntilNextShopping((prof as any)?.shopping_days);

    const { data: plans } = await supabase
      .from("nutrition_plans")
      .select(
        "id, title, status, scheduled_start_date, scheduled_end_date",
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
    let lists: Record<string, { items: ShoppingItem[]; days: number; generated_at: string }> = {};
    if (ids.length) {
      const { data: rows } = await supabase
        .from("shopping_lists")
        .select("plan_id, items, days, generated_at")
        .in("plan_id", ids);
      lists = Object.fromEntries(
        (rows ?? []).map((r: any) => [
          r.plan_id,
          { items: r.items ?? [], days: r.days ?? 7, generated_at: r.generated_at },
        ]),
      );
    }

    return {
      active: active
        ? { ...active, list: lists[active.id] ?? null }
        : null,
      next: next
        ? { ...next, list: lists[next.id] ?? null }
        : null,
      window_days: window,
    };
  });
