import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Coach-only: rechnet alle Mahlzeiten aktiver/Draft-Pläne anhand der
 * `nutrition_foods`-DB neu durch.
 *
 * Priorität:
 *   1) Mahlzeit hat strukturierte `ingredients_json` → Engine (deterministisch).
 *   2) Sonst Fallback: Description-Parser (alt) mit DB-Lookup.
 *   3) Sonst nur kcal = round(P*4 + C*4 + F*9) erzwingen.
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

    const [{ computeMealFromIngredients, computeMealFromDescription, coerceIngredients, isUsableEngineResult }, { enforceKcalConsistency }, { supabaseAdmin }] =
      await Promise.all([
        import("./nutrition-engine.server"),
        import("./nutrition-verify.server"),
        import("@/integrations/supabase/client.server"),
      ]);

    const { data: meals, error } = await supabaseAdmin
      .from("nutrition_plan_meals")
      .select(
        "id, description, ingredients_json, kcal, protein_g, carbs_g, fat_g, data_source, verified_ratio, nutrition_plan_days!inner(plan_id, nutrition_plans!inner(status))",
      )
      .in("nutrition_plan_days.nutrition_plans.status", ["active", "draft", "scheduled"]);
    if (error) throw new Error(error.message);

    let updated = 0;
    let viaEngine = 0;
    let viaParser = 0;
    let kcalFixed = 0;

    for (const m of meals ?? []) {
      let kcal = m.kcal;
      let p = m.protein_g;
      let c = m.carbs_g;
      let f = m.fat_g;
      let data_source = m.data_source;
      let verified_ratio = m.verified_ratio;
      let warnings: string[] = [];

      const structured = coerceIngredients((m as any).ingredients_json ?? null);
      if (structured.length) {
        const r = await computeMealFromIngredients(supabaseAdmin, structured);
        if (isUsableEngineResult(r)) {
          kcal = r.kcal; p = r.protein_g; c = r.carbs_g; f = r.fat_g;
          data_source = r.data_source;
          verified_ratio = r.coverage;
          warnings = r.warnings;
          viaEngine += 1;
        }
      } else {
        const rc = await computeMealFromDescription(supabaseAdmin, m.description);
        if (isUsableEngineResult(rc)) {
          kcal = rc.kcal; p = rc.protein_g; c = rc.carbs_g; f = rc.fat_g;
          data_source = rc.data_source;
          verified_ratio = rc.coverage;
          warnings = rc.warnings;
          viaParser += 1;
        } else {
          const fixed = enforceKcalConsistency({ kcal, protein_g: p, carbs_g: c, fat_g: f });
          if (fixed.kcal !== m.kcal) kcalFixed += 1;
          kcal = fixed.kcal;
        }
      }

      const changed =
        kcal !== m.kcal || p !== m.protein_g || c !== m.carbs_g ||
        f !== m.fat_g || data_source !== m.data_source;

      if (changed || warnings.length) {
        await supabaseAdmin
          .from("nutrition_plan_meals")
          .update({
            kcal, protein_g: p, carbs_g: c, fat_g: f,
            data_source, verified_ratio,
            compute_warnings: warnings,
          })
          .eq("id", m.id);
        if (changed) updated += 1;
      }
    }

    return {
      ok: true,
      scanned: meals?.length ?? 0,
      updated,
      via_engine: viaEngine,
      via_parser: viaParser,
      kcal_fixed: kcalFixed,
    };
  });

/**
 * Coach-only: führt die fünf Engine-Testfälle (Porridge, Brot, Reis,
 * Hähnchenbrust, Olivenöl) gegen die produktive Lebensmittel-DB aus.
 * Gibt Pass/Fail + Detailwerte zurück, damit der Coach sieht, ob die
 * Berechnung wirklich stabil ist.
 */
export const runNutritionEngineTests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach) throw new Error("Nur für Coaches");
    const { runEngineSelfTests } = await import("./nutrition-engine.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return runEngineSelfTests(supabaseAdmin);
  });
