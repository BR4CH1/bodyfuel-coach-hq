import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type MealLite = { id: string; name: string };

async function assertCoach(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
  if (!data) throw new Error("Forbidden");
}

// Insights for one customer
export const getCustomerRecipeInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);
    const target = data.user_id;

    const [{ data: ratings }, { data: favs }, { data: interactions }] = await Promise.all([
      supabase
        .from("meal_ratings")
        .select("meal_id, stars, comment, updated_at")
        .eq("user_id", target),
      supabase
        .from("meal_favorites")
        .select("meal_id, created_at")
        .eq("user_id", target),
      supabase
        .from("meal_interactions")
        .select("meal_id, kind, created_at")
        .eq("user_id", target),
    ]);

    const allIds = new Set<string>();
    (ratings ?? []).forEach((r) => allIds.add(r.meal_id));
    (favs ?? []).forEach((f) => allIds.add(f.meal_id));
    (interactions ?? []).forEach((i) => allIds.add(i.meal_id));
    const ids = [...allIds];
    let mealMap = new Map<string, MealLite>();
    if (ids.length) {
      const { data: meals } = await supabase
        .from("nutrition_plan_meals")
        .select("id, name")
        .in("id", ids);
      mealMap = new Map((meals ?? []).map((m: any) => [m.id, m]));
    }

    const ratedList = (ratings ?? [])
      .map((r) => ({ ...r, name: mealMap.get(r.meal_id)?.name ?? "Unbekannt" }))
      .sort((a, b) => b.stars - a.stars);
    const top5 = ratedList.slice(0, 5);
    const bottom5 = [...ratedList].reverse().slice(0, 5);
    const avgStars = ratedList.length
      ? ratedList.reduce((s, r) => s + r.stars, 0) / ratedList.length
      : 0;

    const favList = (favs ?? []).map((f) => ({
      meal_id: f.meal_id,
      name: mealMap.get(f.meal_id)?.name ?? "Unbekannt",
      created_at: f.created_at,
    }));

    const counts = (kind: string) => {
      const m = new Map<string, number>();
      (interactions ?? [])
        .filter((i) => i.kind === kind)
        .forEach((i) => m.set(i.meal_id, (m.get(i.meal_id) ?? 0) + 1));
      return [...m.entries()]
        .map(([id, count]) => ({ meal_id: id, name: mealMap.get(id)?.name ?? "Unbekannt", count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    };

    return {
      top5,
      bottom5,
      avg_stars: Math.round(avgStars * 10) / 10,
      ratings_count: ratedList.length,
      favorites: favList,
      most_eaten: counts("eaten"),
      most_swapped: counts("swapped"),
    };
  });

// Community top/flop across all clients
export const getCommunityRecipeInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCoach(supabase, userId);

    const { data: ratings } = await supabase
      .from("meal_ratings")
      .select("meal_id, stars");
    const agg = new Map<string, { sum: number; count: number }>();
    (ratings ?? []).forEach((r) => {
      const cur = agg.get(r.meal_id) ?? { sum: 0, count: 0 };
      cur.sum += r.stars;
      cur.count += 1;
      agg.set(r.meal_id, cur);
    });
    const entries = [...agg.entries()]
      .filter(([, v]) => v.count >= 2)
      .map(([id, v]) => ({ meal_id: id, avg: v.sum / v.count, count: v.count }));
    const ids = entries.map((e) => e.meal_id);
    let mealMap = new Map<string, string>();
    if (ids.length) {
      const { data: meals } = await supabase
        .from("nutrition_plan_meals")
        .select("id, name")
        .in("id", ids);
      mealMap = new Map((meals ?? []).map((m: any) => [m.id, m.name]));
    }
    const withNames = entries.map((e) => ({
      ...e,
      name: mealMap.get(e.meal_id) ?? "Unbekannt",
      avg: Math.round(e.avg * 10) / 10,
    }));
    const top10 = [...withNames].sort((a, b) => b.avg - a.avg || b.count - a.count).slice(0, 10);
    const flop10 = [...withNames].sort((a, b) => a.avg - b.avg || b.count - a.count).slice(0, 10);
    return { top10, flop10 };
  });
