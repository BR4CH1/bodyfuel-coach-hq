import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AutoOverrideInfo = {
  date: string;
  count: number;
  reasons: string[];
};

/**
 * Liefert für den eingeloggten Athleten die Tage im gegebenen Zeitraum,
 * an denen automatische Load-Recalc-Overrides aktiv sind. Wird im
 * LoadWeekBanner benutzt, um dem Athleten transparent zu zeigen, dass
 * die Ernährung an die Belastung angepasst wurde.
 */
export const listAutoOverridesForAthlete = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fromDate: string; toDate: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("nutrition_plan_meal_overrides")
      .select("override_date, source")
      .eq("user_id", userId)
      .eq("source", "auto_load_recalc")
      .gte("override_date", data.fromDate)
      .lte("override_date", data.toDate);
    if (error) throw error;

    // Optional: History-Reasons aus plan_adjustment_history (best-effort).
    const { data: hist } = await supabase
      .from("plan_adjustment_history")
      .select("adjustment_date, reason")
      .eq("user_id", userId)
      .gte("adjustment_date", data.fromDate)
      .lte("adjustment_date", data.toDate);

    const byDate = new Map<string, AutoOverrideInfo>();
    for (const r of rows ?? []) {
      const key = r.override_date as string;
      const info = byDate.get(key) ?? { date: key, count: 0, reasons: [] };
      info.count += 1;
      byDate.set(key, info);
    }
    for (const h of hist ?? []) {
      const key = (h as any).adjustment_date as string;
      const info = byDate.get(key);
      if (!info) continue;
      const reason = (h as any).reason as string | null;
      if (reason && !info.reasons.includes(reason)) info.reasons.push(reason);
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  });
