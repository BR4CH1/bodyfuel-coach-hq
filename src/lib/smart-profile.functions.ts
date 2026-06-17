import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SmartNutritionProfile = {
  user_id: string;
  favorite_foods: string[];
  nogo_foods: string[];
  allergies: string[];
  extra_favorites: string | null;
  extra_nogos: string | null;
  extra_allergies: string | null;
  meal_prep_style: "daily" | "2_3_week" | "meal_prep" | "low_effort" | null;
  shopping_day:
    | "monday" | "tuesday" | "wednesday" | "thursday"
    | "friday" | "saturday" | "sunday" | null;
  shopping_days: string[];
  shopping_lead_days: number;
  budget_band: "<50" | "50_75" | "75_100" | ">100" | null;
  weekly_budget_eur: number | null;
  auto_publish: boolean;
  completed_at: string | null;
  training_weekdays: string[];
  kitchen_equipment: string[];
  kitchen_equipment_notes: string | null;
};


export const getMySmartProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("smart_nutrition_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as SmartNutritionProfile | null) ?? null;
  });

export const saveSmartProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<SmartNutritionProfile> & { complete?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { complete, ...rest } = data;
    const payload: any = {
      user_id: userId,
      ...rest,
    };
    if (complete) payload.completed_at = new Date().toISOString();
    const { error } = await supabase
      .from("smart_nutrition_profile")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Coach reads any profile (RLS allows)
export const getCustomerSmartProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("smart_nutrition_profile")
      .select("*")
      .eq("user_id", data.user_id)
      .maybeSingle();
    return (row as SmartNutritionProfile | null) ?? null;
  });

// Coach sets the weekly grocery budget (EUR) for any client.
// If the client has an active nutrition partner, the budget is mirrored to both.
export const setCustomerWeeklyBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; weekly_budget_eur: number | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "coach",
    });
    if (!isCoach) throw new Error("Forbidden");
    const value =
      data.weekly_budget_eur == null || Number.isNaN(Number(data.weekly_budget_eur))
        ? null
        : Math.max(0, Math.round(Number(data.weekly_budget_eur)));

    // Mirror to nutrition partner if linked
    const targetIds = new Set<string>([data.user_id]);
    const { data: link } = await supabase
      .from("nutrition_partners")
      .select("user_a, user_b")
      .or(`user_a.eq.${data.user_id},user_b.eq.${data.user_id}`)
      .maybeSingle();
    if (link) {
      targetIds.add(link.user_a as string);
      targetIds.add(link.user_b as string);
    }

    const rows = Array.from(targetIds).map((uid) => ({
      user_id: uid,
      weekly_budget_eur: value,
    }));
    const { error } = await supabase
      .from("smart_nutrition_profile")
      .upsert(rows, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, weekly_budget_eur: value, applied_to: Array.from(targetIds) };
  });

// Coach sets the kitchen equipment a client has available, plus optional notes
// (e.g. "nur Airfryer, kein Herd"). Used by the AI prompt to constrain recipes.
export const setCustomerKitchenEquipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    user_id: string;
    kitchen_equipment?: string[];
    kitchen_equipment_notes?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "coach",
    });
    if (!isCoach) throw new Error("Forbidden");
    const payload: any = { user_id: data.user_id };
    if (data.kitchen_equipment !== undefined) {
      payload.kitchen_equipment = Array.from(
        new Set((data.kitchen_equipment ?? []).map((s) => String(s).trim()).filter(Boolean)),
      );
    }
    if (data.kitchen_equipment_notes !== undefined) {
      const t = (data.kitchen_equipment_notes ?? "").toString().trim();
      payload.kitchen_equipment_notes = t.length > 0 ? t.slice(0, 600) : null;
    }
    const { error } = await supabase
      .from("smart_nutrition_profile")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

