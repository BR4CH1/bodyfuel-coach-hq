import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Per100 } from "@/lib/ingredient-roles";

export type ResolvedIngredientNutrition = Record<string, Per100>;

/**
 * Löst Zutatennamen einmalig gegen die BodyFuel-Lebensmitteldatenbank auf und
 * liefert Nährwerte pro 100 g/ml zurück. Wird vom Makro-Ziel-Editor genutzt,
 * damit im Builder nicht bei jedem Render gesucht werden muss.
 */
export const resolveIngredientNutrition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { names: string[] }) => ({
    names: Array.from(
      new Set(
        (Array.isArray(d?.names) ? d.names : [])
          .map((n) => String(n ?? "").trim())
          .filter((n) => n.length > 1),
      ),
    ).slice(0, 300),
  }))
  .handler(async ({ data }): Promise<ResolvedIngredientNutrition> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { lookupFood } = await import("@/lib/nutrition-engine.server");
    const out: ResolvedIngredientNutrition = {};

    for (const name of data.names) {
      try {
        const row = await lookupFood(supabaseAdmin, name);
        if (!row) continue;
        out[name] = {
          kcal: Number(row.kcal_per_100g ?? 0),
          protein_g: Number(row.protein_per_100g ?? 0),
          carbs_g: Number(row.carbs_per_100g ?? 0),
          fat_g: Number(row.fat_per_100g ?? 0),
        };
      } catch {
        // Einzelne Fehltreffer dürfen die Auflösung nicht abbrechen.
      }
    }
    return out;
  });
