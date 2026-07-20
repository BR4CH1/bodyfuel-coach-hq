import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack" | "any";
export type AppliesTo = "self" | "partner" | "both";

export type MealWish = {
  id: string;
  user_id: string;
  wish: string;
  meal_slot: MealSlot;
  for_person: string | null;
  applies_to: AppliesTo;
  status: "pending" | "approved" | "rejected";
  coach_note: string | null;
  reviewed_at: string | null;
  consumed_at: string | null;
  created_at: string;
};

const SELECT_COLS =
  "id, user_id, wish, meal_slot, for_person, applies_to, status, coach_note, reviewed_at, consumed_at, created_at";

export const listMealWishes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId?: string; includeHistory?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data.userId ?? userId;

    const { data: link } = await supabase
      .from("nutrition_partners")
      .select("user_a, user_b")
      .or(`user_a.eq.${target},user_b.eq.${target}`)
      .maybeSingle();
    const partnerId = link
      ? link.user_a === target
        ? link.user_b
        : link.user_a
      : null;
    const userIds = partnerId ? [target, partnerId] : [target];

    let q = supabase
      .from("meal_wishes")
      .select(SELECT_COLS)
      .in("user_id", userIds)
      .order("created_at", { ascending: false });
    if (!data.includeHistory) q = q.is("consumed_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows as MealWish[]) ?? [];
  });

export const addMealWish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: {
    wish: string;
    meal_slot?: MealSlot;
    for_person?: string;
    applies_to?: AppliesTo;
    /** Coach-only: insert wish on behalf of a customer */
    target_user_id?: string;
  }) =>
    z
      .object({
        wish: z.string().trim().min(1).max(300),
        meal_slot: z.enum(["breakfast", "lunch", "dinner", "snack", "any"]).optional().default("any"),
        for_person: z.string().trim().max(60).optional(),
        applies_to: z.enum(["self", "partner", "both"]).optional().default("self"),
        target_user_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let owner = userId;
    let autoApprove = false;
    if (data.target_user_id && data.target_user_id !== userId) {
      const { data: isCoach } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "coach",
      });
      if (!isCoach) throw new Error("Forbidden");
      owner = data.target_user_id;
      autoApprove = true; // Coach-added wishes are pre-approved
    }
    const insert: any = {
      user_id: owner,
      wish: data.wish,
      meal_slot: data.meal_slot ?? "any",
      for_person: data.for_person ?? null,
      applies_to: data.applies_to ?? "self",
      status: autoApprove ? "approved" : "pending",
    };
    if (autoApprove) {
      insert.reviewed_by = userId;
      insert.reviewed_at = new Date().toISOString();
    }
    const { data: row, error } = await supabase
      .from("meal_wishes")
      .insert(insert)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row as MealWish;
  });

export const updateMealWishAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: {
    id: string;
    meal_slot?: MealSlot;
    for_person?: string | null;
    applies_to?: AppliesTo;
  }) =>
    z
      .object({
        id: z.string().uuid(),
        meal_slot: z.enum(["breakfast", "lunch", "dinner", "snack", "any"]).optional(),
        for_person: z.string().trim().max(60).nullable().optional(),
        applies_to: z.enum(["self", "partner", "both"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: any = {};
    if (data.meal_slot !== undefined) patch.meal_slot = data.meal_slot;
    if (data.for_person !== undefined) {
      patch.for_person = data.for_person && data.for_person.length > 0 ? data.for_person : null;
    }
    if (data.applies_to !== undefined) patch.applies_to = data.applies_to;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("meal_wishes")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMealWish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("meal_wishes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewMealWish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; status: "approved" | "rejected"; coach_note?: string }) =>
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
