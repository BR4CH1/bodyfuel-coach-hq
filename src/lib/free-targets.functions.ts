import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateProteinTarget } from "@/lib/nutrition-protein-policy";

const schema = z.object({
  height_cm: z.coerce.number().int().positive().max(260),
  weight_kg: z.coerce.number().positive().max(400),
  gender: z.enum(["male", "female", "other"]),
  birthdate: z.string().min(8),
  goal: z.enum(["fat_loss", "maintain", "lean_bulk"]).default("maintain"),
});

type FreeGoal = "fat_loss" | "maintain" | "lean_bulk";

function asGoal(value: unknown): FreeGoal {
  return value === "fat_loss" || value === "lean_bulk" || value === "maintain" ? value : "maintain";
}

function validNumber(value: unknown) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function calculateFreeTargets(data: {
  weight_kg: number;
  height_cm?: number | null;
  gender?: string | null;
  birthdate?: string | null;
  goal: FreeGoal;
}) {
  const w = data.weight_kg;
  const h = data.height_cm;
  const age = data.birthdate
    ? Math.max(15, Math.floor((Date.now() - new Date(data.birthdate).getTime()) / 31557600000))
    : null;
  const bmr =
    h && age
      ? data.gender === "female"
        ? 10 * w + 6.25 * h - 5 * age - 161
        : 10 * w + 6.25 * h - 5 * age + 5
      : w * 24;
  const goalMult: Record<FreeGoal, { t: number; r: number }> = {
    fat_loss: { t: 0.8, r: 0.78 },
    maintain: { t: 1.0, r: 1.0 },
    lean_bulk: { t: 1.1, r: 1.05 },
  };
  const gm = goalMult[data.goal];
  const round50 = (v: number) => Math.max(1000, Math.round(v / 50) * 50);
  const kcal_t = round50(bmr * 1.6 * gm.t);
  const kcal_r = round50(bmr * 1.4 * gm.r);
  const protein = calculateProteinTarget(w, data.goal);
  const fat_t = Math.round(w * (data.goal === "fat_loss" ? 0.8 : 0.9));
  const fat_r = Math.round(w * (data.goal === "fat_loss" ? 0.9 : 1.0));
  const carbs_t = Math.max(0, Math.round((kcal_t - protein * 4 - fat_t * 9) / 4));
  const carbs_r = Math.max(0, Math.round((kcal_r - protein * 4 - fat_r * 9) / 4));
  return { kcal_t, kcal_r, protein, fat_t, fat_r, carbs_t, carbs_r };
}

/**
 * Persist profile + measurement (server-side, bypasses RLS) and compute
 * Trainings- + Restday Makro-Targets via Mifflin-St Jeor, angepasst auf das Ziel.
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
        training_goal: data.goal,
      })
      .eq("id", userId);

    await supabaseAdmin.from("body_measurements").insert({
      user_id: userId,
      weight_kg: data.weight_kg,
      measured_at: new Date().toISOString(),
    });

    const { kcal_t, kcal_r, protein, fat_t, fat_r, carbs_t, carbs_r } = calculateFreeTargets(data);

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
        updated_by: userId,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, kcal_t, kcal_r };
  });

/**
 * Seedet Profile/Gewicht/Targets aus den raw_user_meta_data (seed_*),
 * die beim signUp gesetzt wurden. Idempotent: läuft nur, solange
 * training_goal noch nicht gesetzt ist.
 */
export const seedFromUserMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("training_goal, height_cm, birthdate, gender")
      .eq("id", userId)
      .maybeSingle();
    const { data: target } = await supabaseAdmin
      .from("nutrition_targets")
      .select("kcal, kcal_rest")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: latestMeasurement } = await supabaseAdmin
      .from("body_measurements")
      .select("weight_kg")
      .eq("user_id", userId)
      .not("weight_kg", "is", null)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (target?.kcal && target?.kcal !== 2200 && latestMeasurement?.weight_kg) {
      return { ok: true, skipped: true as const };
    }

    // Metadaten vom Auth-User lesen
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
    const meta = (userRes?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const heightFromMeta = validNumber(meta.seed_height_cm);
    const weightFromMeta = validNumber(meta.seed_weight_kg);
    const profileHeight = validNumber((prof as any)?.height_cm);
    const latestWeight = validNumber((latestMeasurement as any)?.weight_kg);
    const height_cm = heightFromMeta ?? profileHeight;
    const weight_kg = weightFromMeta ?? latestWeight;
    const genderMeta = String(meta.seed_gender ?? "");
    const gender = ["male", "female", "other"].includes(genderMeta)
      ? genderMeta
      : ((prof as any)?.gender ?? "other");
    const birthdate = String(meta.seed_birthdate ?? (prof as any)?.birthdate ?? "");
    const goal = asGoal(meta.seed_goal ?? (prof as any)?.training_goal);

    if (!weight_kg) {
      return { ok: false as const, reason: "missing_metadata" };
    }

    // Selbe Logik wie seedMyNutritionTargets — direkt hier, um Helper-Aufruf zu sparen
    await supabaseAdmin
      .from("profiles")
      .update({ height_cm, gender, birthdate: birthdate || null, training_goal: goal })
      .eq("id", userId);

    if (!latestWeight || weightFromMeta) {
      await supabaseAdmin.from("body_measurements").insert({
        user_id: userId,
        weight_kg,
        measured_at: new Date().toISOString(),
      });
    }

    const { kcal_t, kcal_r, protein, fat_t, fat_r, carbs_t, carbs_r } = calculateFreeTargets({
      weight_kg,
      height_cm,
      gender,
      birthdate,
      goal,
    });

    await supabaseAdmin.from("nutrition_targets").upsert(
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
        updated_by: userId,
      },
      { onConflict: "user_id" },
    );

    return { ok: true as const, kcal_t, kcal_r };
  });
