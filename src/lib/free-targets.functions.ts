import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Berechnet & speichert Trainings- + Restday-Makro-Targets
 * für den eingeloggten User (Free oder Coaching) auf Basis von
 * Profil (Größe, Geschlecht, Geburtsdatum) + letztem Gewicht.
 *
 * Formel: Mifflin-St Jeor BMR.
 * Trainingstag = BMR * 1.6, Restday = BMR * 1.4.
 * Protein 1.8 g/kg, Fett 0.9 g/kg (Training) bzw. 1.0 g/kg (Rest),
 * Carbs = Rest aus kcal.
 */
export const seedMyNutritionTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Schon vorhanden? Nicht überschreiben (Coach pflegt sonst manuell).
    const { data: existing } = await supabaseAdmin
      .from("nutrition_targets")
      .select("user_id, kcal_rest")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing && existing.kcal_rest != null) return { ok: true, created: false };

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("height_cm, gender, birthdate")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: bm } = await supabaseAdmin
      .from("body_measurements")
      .select("weight_kg, measured_at")
      .eq("user_id", context.userId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const w = Number(bm?.weight_kg ?? 0);
    const h = Number((prof as any)?.height_cm ?? 0);
    const gender = (prof as any)?.gender as string | undefined;
    const bd = (prof as any)?.birthdate as string | undefined;
    if (!w || !h || !gender || !bd) {
      return { ok: false, reason: "missing-profile" as const };
    }
    const age = Math.max(
      15,
      Math.floor((Date.now() - new Date(bd).getTime()) / 31557600000),
    );
    const bmr =
      gender === "female"
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

    const { error } = await supabaseAdmin
      .from("nutrition_targets")
      .upsert(
        {
          user_id: context.userId,
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
    return { ok: true, created: true };
  });
