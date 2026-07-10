import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NutritionAdjustment = {
  id: string;
  created_at: string;
  kind: string;
  reason: string;
  date: string | null;
  meal_count: number | null;
};

/**
 * Liefert für den Coach die letzten automatischen Ernährungs-Anpassungen
 * eines Athleten (plan_adjustment_history, area='nutrition',
 * kind LIKE 'load_change:%'). Autorisiert nur Staff der jeweiligen Org
 * oder den Athleten selbst.
 */
export const listNutritionAdjustmentsForAthlete = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; limit?: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    const targetId = data.userId;

    if (targetId !== callerId) {
      // Staff-Check: mindestens eine gemeinsame Organisation als Staff
      const { data: staff } = await supabase
        .from("staff_assignments")
        .select("organization_id")
        .eq("user_id", callerId)
        .limit(1);
      if (!staff || staff.length === 0) {
        throw new Response("Forbidden", { status: 403 });
      }
    }

    const limit = Math.min(Math.max(data.limit ?? 20, 1), 100);
    const { data: rows, error } = await supabase
      .from("plan_adjustment_history")
      .select("id, created_at, kind, after_json")
      .eq("client_id", targetId)
      .eq("area", "nutrition")
      .like("kind", "load_change:%")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    return (rows ?? []).map((r): NutritionAdjustment => {
      const after = (r as any).after_json as
        | { date?: string; meal_count?: number }
        | null;
      const kind = (r as any).kind as string;
      const reason = kind.startsWith("load_change:")
        ? kind.slice("load_change:".length)
        : kind;
      return {
        id: (r as any).id as string,
        created_at: (r as any).created_at as string,
        kind,
        reason,
        date: after?.date ?? null,
        meal_count: after?.meal_count ?? null,
      };
    });
  });
