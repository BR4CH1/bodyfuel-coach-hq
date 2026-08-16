import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCoachOrSelf(supabase: any, userId: string, target: string) {
  if (userId === target) return;
  const { data: isCoach } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "coach",
  });
  if (!isCoach) throw new Error("Forbidden");
}

export const getCustomerSmartProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoachOrSelf(supabase, userId, data.user_id);

    const { data: profile } = await supabase
      .from("smart_nutrition_profile")
      .select("*")
      .eq("user_id", data.user_id)
      .maybeSingle();
    return { profile: profile ?? null };
  });

export const getCustomerRiskFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoachOrSelf(supabase, userId, data.user_id);

    const target = data.user_id;
    const today = new Date();
    const { loadEffectiveNutritionTargets } = await import("@/lib/nutrition-tracker-targets.functions");
    const effectiveTargets = await loadEffectiveNutritionTargets(
      supabase,
      target,
      today.toISOString().slice(0, 10),
    );
    const since = new Date(today.getTime() - 14 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    // Plan meals (active plan) → expected total meals
    const { data: plan } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("client_id", target)
      .eq("plan_type", "nutrition")
      .eq("is_active", true)
      .maybeSingle();

    let expectedMealsPerDay = 0;
    if (plan) {
      const { data: days } = await supabase
        .from("nutrition_plan_days")
        .select("id")
        .eq("plan_id", plan.id);
      const dayIds = (days ?? []).map((d: any) => d.id);
      if (dayIds.length) {
        const { count: mealCount } = await supabase
          .from("nutrition_plan_meals")
          .select("id", { count: "exact", head: true })
          .in("day_id", dayIds);
        expectedMealsPerDay = Math.round((mealCount ?? 0) / dayIds.length);
      }
    }

    const [{ count: skipsCount }, { count: swapsCount }, { count: eatenCount }, { data: targets }, { data: avg7 }] =
      await Promise.all([
        supabase
          .from("meal_skips")
          .select("id", { count: "exact", head: true })
          .eq("user_id", target)
          .gte("skip_date", since),
        supabase
          .from("meal_interactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", target)
          .eq("kind", "swapped")
          .gte("created_at", since),
        supabase
          .from("meal_interactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", target)
          .eq("kind", "eaten")
          .gte("created_at", since),
        Promise.resolve({ data: effectiveTargets }),
        supabase
          .from("food_entries")
          .select("entry_date, protein_g, kcal")
          .eq("user_id", target)
          .gte("entry_date", since),
      ]);

    const expected14 = expectedMealsPerDay * 14;
    const skipRate = expected14 > 0 ? (skipsCount ?? 0) / expected14 : 0;
    const swapRate = expected14 > 0 ? (swapsCount ?? 0) / expected14 : 0;

    // Protein adherence
    const byDay = new Map<string, { protein: number; kcal: number }>();
    (avg7 ?? []).forEach((e: any) => {
      const cur = byDay.get(e.entry_date) ?? { protein: 0, kcal: 0 };
      cur.protein += e.protein_g ?? 0;
      cur.kcal += e.kcal ?? 0;
      byDay.set(e.entry_date, cur);
    });
    const trackedDays = byDay.size;
    const avgProtein = trackedDays > 0
      ? Array.from(byDay.values()).reduce((s, d) => s + d.protein, 0) / trackedDays
      : 0;
    const targetProtein = (targets as any)?.protein_g ?? 0;
    const proteinShortfall = targetProtein > 0 ? Math.max(0, 1 - avgProtein / targetProtein) : 0;

    const flags: { key: string; severity: "warn" | "critical"; label: string; detail: string }[] = [];
    if (skipRate > 0.3) {
      flags.push({
        key: "high_skip",
        severity: skipRate > 0.5 ? "critical" : "warn",
        label: "Viele übersprungene Mahlzeiten",
        detail: `${Math.round(skipRate * 100)} % der erwarteten Mahlzeiten in 14 Tagen übersprungen.`,
      });
    }
    if (swapRate > 0.3) {
      flags.push({
        key: "high_swap",
        severity: "warn",
        label: "Häufige Mahlzeitentausche",
        detail: `${Math.round(swapRate * 100)} % der Mahlzeiten getauscht — Plan passt evtl. nicht zu den Vorlieben.`,
      });
    }
    if (targetProtein > 0 && proteinShortfall > 0.2) {
      flags.push({
        key: "protein_short",
        severity: proteinShortfall > 0.4 ? "critical" : "warn",
        label: "Protein-Ziel verfehlt",
        detail: `Ø ${Math.round(avgProtein)} g vs. Ziel ${targetProtein} g (-${Math.round(proteinShortfall * 100)} %).`,
      });
    }
    if (trackedDays < 5) {
      flags.push({
        key: "low_tracking",
        severity: trackedDays < 2 ? "critical" : "warn",
        label: "Wenig Tracking-Aktivität",
        detail: `Nur ${trackedDays} von 14 Tagen Daten erfasst.`,
      });
    }

    return {
      flags,
      stats: {
        skips: skipsCount ?? 0,
        swaps: swapsCount ?? 0,
        eaten: eatenCount ?? 0,
        expected: expected14,
        avg_protein: Math.round(avgProtein),
        target_protein: targetProtein,
        tracked_days: trackedDays,
      },
    };
  });

export const getCustomerSkipBreakdown = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoachOrSelf(supabase, userId, data.user_id);
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { data: rows } = await supabase
      .from("meal_skips")
      .select("reason, meal_name")
      .eq("user_id", data.user_id)
      .gte("skip_date", since);
    const reasons = new Map<string, number>();
    const meals = new Map<string, number>();
    (rows ?? []).forEach((r: any) => {
      reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
      if (r.meal_name) meals.set(r.meal_name, (meals.get(r.meal_name) ?? 0) + 1);
    });
    return {
      reasons: Array.from(reasons.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
      meals: Array.from(meals.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  });

export const setCustomerAutoPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; auto_publish: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "coach",
    });
    if (!isCoach) throw new Error("Forbidden");
    const { error } = await supabase
      .from("smart_nutrition_profile")
      .upsert(
        { user_id: data.user_id, auto_publish: data.auto_publish },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
