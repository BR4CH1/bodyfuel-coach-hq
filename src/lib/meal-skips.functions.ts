import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SKIP_REASONS = [
  { key: "no_time", label: "Keine Zeit" },
  { key: "no_appetite", label: "Kein Appetit" },
  { key: "no_ingredients", label: "Zutaten fehlen" },
  { key: "dislike", label: "Schmeckt mir nicht" },
  { key: "too_expensive", label: "Zu teuer" },
  { key: "too_complex", label: "Zu aufwendig" },
  { key: "ate_other", label: "Etwas anderes gegessen" },
  { key: "other", label: "Anderer Grund" },
] as const;

export type SkipReasonKey = (typeof SKIP_REASONS)[number]["key"];

export const logMealSkip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: { meal_id: string; meal_name?: string; reason: string; note?: string; skip_date?: string }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const skipDate = data.skip_date ?? new Date().toISOString().slice(0, 10);

    // Replace existing skip for the same meal/day (idempotent)
    await supabase
      .from("meal_skips")
      .delete()
      .eq("user_id", userId)
      .eq("meal_id", data.meal_id)
      .eq("skip_date", skipDate);

    const { error } = await supabase.from("meal_skips").insert({
      user_id: userId,
      meal_id: data.meal_id,
      meal_name: data.meal_name ?? null,
      skip_date: skipDate,
      reason: data.reason,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMealSkip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { meal_id: string; skip_date?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const skipDate = data.skip_date ?? new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("meal_skips")
      .delete()
      .eq("user_id", userId)
      .eq("meal_id", data.meal_id)
      .eq("skip_date", skipDate);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMySkipsForDate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { skip_date?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const skipDate = data.skip_date ?? new Date().toISOString().slice(0, 10);
    const { data: rows } = await supabase
      .from("meal_skips")
      .select("meal_id, reason, note")
      .eq("user_id", userId)
      .eq("skip_date", skipDate);
    return { items: rows ?? [] };
  });
