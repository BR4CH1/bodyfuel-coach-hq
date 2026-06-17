import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  height_cm: z.coerce.number().int().positive().max(260),
  weight_kg: z.coerce.number().positive().max(400),
  gender: z.enum(["male", "female", "other"]),
  birthdate: z.string().min(8),
});

/**
 * Persist profile + measurement (server-side, bypasses RLS) and compute
 * Trainings- + Restday Makro-Targets via Mifflin-St Jeor.
 * Always overwrites — caller is the signup flow.
 */
export const seedMyNutritionTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    await supabaseAdmin
      .from("profiles")
      .update({
        height_cm: data.height_cm,
        gender: data.gender,
        birthdate: data.birthdate,
      })
      .eq("id", userId);

    await supabaseAdmin.from("body_measurements").insert({
      user_id: userId,
      weight_kg: data.weight_kg,
      measured_at: new Date().toISOString(),
    });

    const w = data.weight_kg;
    const h = data.height_cm;
    const age = Math.max(
      15,
      Math.floor((Date.now() - new Date(data.birthdate).getTime()) / 31557600000),
    );
    const bmr =
      data.gender === "female"
        ? 10 * w + 6.25 * h - 5 * age - 161
        : 10 * w + 6.25 * h - 5 * age + 5;

    const round50 = (v: number) => Math.max(1000, Math.round(v / 50) * 50);
    const kcal_t = round50(bmr * 1.6);
    const kcal_r = round50(bmr * 1.4);
    const protein = Math.round(w * 1.8);
    const fat_t = Math.round(w * 0.9);
    const fat_r = Math.round(w * 1.0);
    const carbs_t = Math.max(0, Math.round((kcal_t - protein * 4 - fat_t * 9) / 4));
    const carbs_r = Math.max(0, Math.round((kcal_r - protein * 4 - fat_r * 9) / 4));

    const { error } = await supabaseAdmin.from("nutrition_targets").upsert(
      {
        user_id: userId,
        kcal: kcal_t,
        protein_g: protein,
        carbs_g: carbs_t,
        fat_g: fat_t,
        kcal_rest: kcal_r,
        protein_g_rest: protein,
        carbs_g_rest: carbs_r,
        fat_g_rest: fat_r,
        water_glasses: 8,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, kcal_t, kcal_r };
  });
