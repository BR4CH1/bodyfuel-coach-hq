import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack" | "any";

export type MealWish = {
  id: string;
  user_id: string;
  wish: string;
  meal_slot: MealSlot;
  for_person: string | null;
  status: "pending" | "approved" | "rejected";
  coach_note: string | null;
  reviewed_at: string | null;
  consumed_at: string | null;
  created_at: string;
};

export const listMealWishes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId?: string; includeHistory?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data.userId ?? userId;
    let q = supabase
      .from("meal_wishes")
      .select("id, user_id, wish, meal_slot, for_person, status, coach_note, reviewed_at, consumed_at, created_at")
      .eq("user_id", target)
      .order("created_at", { ascending: false });
    if (!data.includeHistory) q = q.is("consumed_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows as MealWish[]) ?? [];
  });

export const addMealWish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { wish: string; meal_slot?: MealSlot; for_person?: string }) =>
    z.object({
      wish: z.string().trim().min(1).max(300),
      meal_slot: z.enum(["breakfast", "lunch", "dinner", "snack", "any"]).optional().default("any"),
      for_person: z.string().trim().max(60).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("meal_wishes")
      .insert({
        user_id: userId,
        wish: data.wish,
        meal_slot: data.meal_slot ?? "any",
        for_person: data.for_person ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as MealWish;
  });


export const deleteMealWish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("meal_wishes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewMealWish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "approved" | "rejected"; coach_note?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
        coach_note: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "coach",
    });
    if (!isCoach) throw new Error("Forbidden");
    const { error } = await supabase
      .from("meal_wishes")
      .update({
        status: data.status,
        coach_note: data.coach_note ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
