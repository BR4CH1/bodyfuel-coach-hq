import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Zentrale + private Lebensmittelsuche (max 50). */
export const searchFoods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        q: z.string().min(1),
        includePrivate: z.boolean().optional().default(true),
        maxResults: z.number().int().min(1).max(50).optional().default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("search_foods" as any, {
      q: data.q,
      include_private: data.includePrivate,
      max_results: data.maxResults,
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

    const [totalRes, verifiedRes, sourcesRes, runsRes, userFoodsRes] = await Promise.all([
      (supabase.from("foods" as any) as any).select("*", { count: "exact", head: true }),
      (supabase.from("foods" as any) as any)
        .select("*", { count: "exact", head: true })
        .eq("is_verified", true),
      Promise.resolve(null),
      (supabase.from("import_runs" as any) as any)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20),
      (supabase.from("user_foods" as any) as any).select("*", { count: "exact", head: true }),
    ]);

    // per-source counts
    const { data: perSourceRaw } = await (supabase.from("foods" as any) as any)
      .select("source")
      .limit(50000);
    const bySource: Record<string, number> = {};
    for (const r of (perSourceRaw ?? []) as { source: string }[]) {
      bySource[r.source] = (bySource[r.source] ?? 0) + 1;
    }

    return {
      totalFoods: totalRes.count ?? 0,
      verifiedFoods: verifiedRes.count ?? 0,
      userFoods: userFoodsRes.count ?? 0,
      bySource,
      recentRuns: (runsRes.data ?? []) as any[],
      _sourcesRes: sourcesRes,
    };
  });
