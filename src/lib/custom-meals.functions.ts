import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MealImageStatus } from "@/lib/meal-images.functions";


export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack" | "any";

export type CustomMealIngredient = {
  name: string;
  amount?: number | null;
  unit?: "g" | "ml" | null;
  /** Legacy mass field retained for existing meals. */
  amount_g?: number | null;
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
};

export type CustomMeal = {
  id: string;
  user_id: string;
  name: string;
  meal_slot: MealSlot;
  ingredients: CustomMealIngredient[];
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
  image_url: string | null;
  image_status: MealImageStatus | null;
  image_path: string | null;
  image_source: string | null;
  image_error: string | null;
  image_generated_at: string | null;
  created_at: string;
  updated_at: string;
};




const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  amount: z.number().nonnegative().nullable().optional(),
  unit: z.enum(["g", "ml"]).nullable().optional(),
  amount_g: z.number().nonnegative().nullable().optional(),
  kcal: z.number().nonnegative().nullable().optional(),
  protein_g: z.number().nonnegative().nullable().optional(),
  carbs_g: z.number().nonnegative().nullable().optional(),
  fat_g: z.number().nonnegative().nullable().optional(),
});

const slotEnum = z.enum(["breakfast", "lunch", "dinner", "snack", "any"]);

export const listCustomMeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId?: string }) => d)
  .handler(async ({ data, context }) => {
    const target = data.userId ?? context.userId;
    const { data: rows, error } = await context.supabase
      .from("custom_meals")
      .select("*")
      .eq("user_id", target)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CustomMeal[];
  });

export const saveCustomMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      name: string;
      meal_slot?: MealSlot;
      ingredients: CustomMealIngredient[];
      notes?: string;
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          name: z.string().trim().min(1).max(120),
          meal_slot: slotEnum.optional().default("any"),
          ingredients: z.array(ingredientSchema).min(1).max(40),
          notes: z.string().trim().max(500).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Auto-sum macros from ingredients when set
    const totals = data.ingredients.reduce(
      (acc, ing) => ({
        kcal: acc.kcal + (ing.kcal ?? 0),
        protein_g: acc.protein_g + (ing.protein_g ?? 0),
        carbs_g: acc.carbs_g + (ing.carbs_g ?? 0),
        fat_g: acc.fat_g + (ing.fat_g ?? 0),
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );
    const payload = {
      user_id: context.userId,
      name: data.name,
      meal_slot: data.meal_slot,
      ingredients: data.ingredients,
      kcal: Math.round(totals.kcal) || null,
      protein_g: totals.protein_g || null,
      carbs_g: totals.carbs_g || null,
      fat_g: totals.fat_g || null,
      notes: data.notes ?? null,
    };
    const q = data.id
      ? context.supabase.from("custom_meals").update(payload).eq("id", data.id).select().single()
      : context.supabase.from("custom_meals").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row as CustomMeal;
  });

export const deleteCustomMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("custom_meals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const trackCustomMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; slot?: MealSlot; scale?: number }) =>
    z
      .object({
        id: z.string().uuid(),
        slot: slotEnum.optional(),
        scale: z.number().positive().max(10).optional().default(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: meal, error } = await context.supabase
      .from("custom_meals")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !meal) throw new Error(error?.message ?? "Mahlzeit nicht gefunden");
    const m = meal as CustomMeal;
    const scale = data.scale ?? 1;
    const slot =
      data.slot && data.slot !== "any" ? data.slot : m.meal_slot !== "any" ? m.meal_slot : "snack";
    const today = new Date().toISOString().slice(0, 10);
    const { error: insErr } = await context.supabase.from("food_entries").insert({
      user_id: context.userId,
      entry_date: today,
      meal: slot,
      name: m.name,
      serving_amount: 100,
      amount_unit: "g",
      serving_g: 100,
      kcal: Math.round((m.kcal ?? 0) * scale) || undefined,
      protein_g: m.protein_g ? +(m.protein_g * scale).toFixed(1) : undefined,
      carbs_g: m.carbs_g ? +(m.carbs_g * scale).toFixed(1) : undefined,
      fat_g: m.fat_g ? +(m.fat_g * scale).toFixed(1) : undefined,
      source: `custom:${m.id}`,
    });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });
