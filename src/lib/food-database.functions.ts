import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Suche im selben auditierten Katalog, den Tracker und Planer verwenden (max. 50). */
export const searchFoods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        q: z.string().min(1),
        maxResults: z.number().int().min(1).max(50).optional().default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase.rpc as any)("search_nutrition_foods", {
      _q: data.q,
      _max_results: data.maxResults,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

/** Admin-Statistiken für den Import/Datenbank-Überblick. */
export const getFoodDatabaseStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isOwner } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "platform_owner",
    });
    if (!isOwner) throw new Error("Forbidden");

    const sources = [
      "bodyfuel_verified",
      "bls_4_0",
      "open_food_facts",
      "usda",
      "manual",
      "ai_estimate",
    ] as const;

    const [totalRes, safeRes, reviewRes, liquidRes, runsRes, userFoodsRes, ...sourceResults] =
      await Promise.all([
        supabase.from("nutrition_foods").select("*", { count: "exact", head: true }),
        supabase
          .from("nutrition_foods")
          .select("*", { count: "exact", head: true })
          .eq("safe_for_smart", true)
          .eq("is_active", true),
        supabase
          .from("nutrition_foods")
          .select("*", { count: "exact", head: true })
          .eq("needs_review", true),
        supabase
          .from("nutrition_foods")
          .select("*", { count: "exact", head: true })
          .eq("unit_type", "ml"),
        (supabase.from("import_runs" as any) as any)
          .select("*")
          .order("started_at", { ascending: false })
          .limit(20),
        (supabase.from("user_foods" as any) as any).select("*", { count: "exact", head: true }),
        ...sources.map((source) =>
          supabase
            .from("nutrition_foods")
            .select("*", { count: "exact", head: true })
            .eq("source", source),
        ),
      ]);

    const bySource = Object.fromEntries(
      sources.map((source, index) => [source, sourceResults[index]?.count ?? 0]),
    );

    return {
      totalFoods: totalRes.count ?? 0,
      safeFoods: safeRes.count ?? 0,
      reviewFoods: reviewRes.count ?? 0,
      liquidFoods: liquidRes.count ?? 0,
      userFoods: userFoodsRes.count ?? 0,
      bySource,
      recentRuns: (runsRes.data ?? []) as any[],
    };
  });
