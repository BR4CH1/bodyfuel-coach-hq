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
