import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Coach-only: rechnet alle Mahlzeiten ALLER aktiven/Draft-Pläne anhand der
 * `nutrition_foods`-DB neu durch. Ersetzt halluzinierte KI-Makros, wenn die
 * DB ≥ 70 % der Zutaten abdeckt. Erzwingt sonst kcal = P*4 + C*4 + F*9.
 */
export const recomputeAllPlanMacros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "coach",
    });
    if (!isCoach) throw new Error("Nur für Coaches");

    const { recomputeMealFromDb, enforceKcalConsistency } = await import(
      "./nutrition-verify.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Alle Mahlzeiten aus aktiven oder Draft-Plänen
    const { data: meals, error } = await supabaseAdmin
      .from("nutrition_plan_meals")
      .select(
        "id, description, kcal, protein_g, carbs_g, fat_g, data_source, verified_ratio, nutrition_plan_days!inner(plan_id, nutrition_plans!inner(status))",
      )
      .in("nutrition_plan_days.nutrition_plans.status", [
        "active",
        "draft",
        "scheduled",
      ]);
    if (error) throw new Error(error.message);

    let updated = 0;
    let dbRecomputed = 0;
    let kcalFixed = 0;

    for (const m of meals ?? []) {
      const rc = await recomputeMealFromDb(supabaseAdmin, m.description);
      let kcal = m.kcal;
      let p = m.protein_g;
      let c = m.carbs_g;
      let f = m.fat_g;
      let data_source = m.data_source;
      let verified_ratio = m.verified_ratio;

      if (rc && rc.coverage >= 0.7) {
        kcal = rc.kcal;
        p = rc.protein_g;
        c = rc.carbs_g;
        f = rc.fat_g;
        data_source = "db_verified";
        verified_ratio = rc.coverage;
        dbRecomputed += 1;
      } else {
        const fixed = enforceKcalConsistency({
          kcal,
          protein_g: p,
          carbs_g: c,
          fat_g: f,
        });
        if (fixed.kcal !== m.kcal) kcalFixed += 1;
        kcal = fixed.kcal;
      }

      const changed =
        kcal !== m.kcal ||
        p !== m.protein_g ||
        c !== m.carbs_g ||
        f !== m.fat_g ||
        data_source !== m.data_source;

      if (changed) {
        await supabaseAdmin
          .from("nutrition_plan_meals")
          .update({
            kcal,
            protein_g: p,
            carbs_g: c,
            fat_g: f,
            data_source,
            verified_ratio,
          })
          .eq("id", m.id);
        updated += 1;
      }
    }

    return {
      ok: true,
      scanned: meals?.length ?? 0,
      updated,
      db_recomputed: dbRecomputed,
      kcal_fixed: kcalFixed,
    };
  });
