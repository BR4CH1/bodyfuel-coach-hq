import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============== Favorites ==============
export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { meal_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("meal_favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("meal_id", data.meal_id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from("meal_favorites").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { favorited: false };
    }
    const { error } = await supabase
      .from("meal_favorites")
      .insert({ user_id: userId, meal_id: data.meal_id });
    if (error) throw new Error(error.message);
    return { favorited: true };
  });

export const getFavoriteStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { meal_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("meal_favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("meal_id", data.meal_id)
      .maybeSingle();
    return { favorited: !!row };
  });

export const listMyFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: favs, error } = await supabase
      .from("meal_favorites")
      .select("id, meal_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (favs ?? []).map((f) => f.meal_id);
    if (!ids.length) return { items: [] as any[] };

    const { data: meals } = await supabase
      .from("nutrition_plan_meals")
      .select("id, name, description, kcal, protein_g, carbs_g, fat_g")
      .in("id", ids);
    const { data: ratings } = await supabase
      .from("meal_ratings")
      .select("meal_id, stars")
      .eq("user_id", userId)
      .in("meal_id", ids);

    // Eaten counts via interactions
    const { data: interactions } = await supabase
      .from("meal_interactions")
      .select("meal_id, kind")
      .eq("user_id", userId)
      .in("meal_id", ids);

    const ratingMap = new Map((ratings ?? []).map((r) => [r.meal_id, r.stars]));
    const eatenCount = new Map<string, number>();
    (interactions ?? []).forEach((i) => {
      if (i.kind === "eaten") eatenCount.set(i.meal_id, (eatenCount.get(i.meal_id) ?? 0) + 1);
    });
    const mealMap = new Map((meals ?? []).map((m) => [m.id, m]));

    const items = (favs ?? [])
      .map((f) => {
        const m = mealMap.get(f.meal_id);
        if (!m) return null;
        return {
          favorite_id: f.id,
          favorited_at: f.created_at,
          meal: m,
          stars: ratingMap.get(f.meal_id) ?? null,
          eaten_count: eatenCount.get(f.meal_id) ?? 0,
        };
      })
      .filter(Boolean);
    return { items };
  });

// ============== Ratings ==============
export const setRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { meal_id: string; stars: number; comment?: string | null }) => {
    if (!Number.isInteger(d.stars) || d.stars < 1 || d.stars > 5) {
      throw new Error("Bewertung muss 1–5 sein");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("meal_ratings").upsert(
      {
        user_id: userId,
        meal_id: data.meal_id,
        stars: data.stars,
        comment: data.comment ?? null,
      },
      { onConflict: "user_id,meal_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyRating = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { meal_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("meal_ratings")
      .select("stars, comment")
      .eq("user_id", userId)
      .eq("meal_id", data.meal_id)
      .maybeSingle();
    return { stars: row?.stars ?? null, comment: row?.comment ?? null };
  });

// ============== Interactions ==============
export const logInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { meal_id: string; kind: "shown" | "eaten" | "swapped"; meta?: any }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("meal_interactions").insert({
      user_id: userId,
      meal_id: data.meal_id,
      kind: data.kind,
      meta: data.meta ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
