import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FoodResult = {
  name: string;
  brand: string | null;
  barcode: string | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

function mapOff(p: any): FoodResult | null {
  const n = p?.nutriments;
  if (!n) return null;
  const kcal = Number(n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0);
  if (!kcal && !n["proteins_100g"]) return null;
  return {
    name: p.product_name || p.generic_name || "Unbekannt",
    brand: p.brands || null,
    barcode: p.code || null,
    kcal_per_100g: kcal,
    protein_per_100g: Number(n["proteins_100g"] ?? 0),
    carbs_per_100g: Number(n["carbohydrates_100g"] ?? 0),
    fat_per_100g: Number(n["fat_100g"] ?? 0),
  };
}

/** Barcode lookup via OpenFoodFacts */
export const lookupBarcode = createServerFn({ method: "POST" })
  .inputValidator((d: { barcode: string }) => d)
  .handler(async ({ data }) => {
    const code = data.barcode.replace(/\D/g, "");
    if (!code) throw new Error("Ungültiger Barcode");
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
    if (!res.ok) throw new Error("Produkt nicht gefunden");
    const json = (await res.json()) as any;
    if (json.status !== 1) throw new Error("Produkt nicht gefunden");
    const mapped = mapOff(json.product);
    if (!mapped) throw new Error("Keine Nährwerte für dieses Produkt");
    return mapped;
  });

/** Search via OpenFoodFacts (German-language hint, no country filter to maximise matches) */
export const searchFoods = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }) => {
    const q = data.query.trim();
    if (!q) return [] as FoodResult[];
    const fields =
      "code,product_name,product_name_de,generic_name,brands,nutriments";
    const tryUrls = [
      // German DB first — most German products are indexed here
      `https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${fields}`,
      // World DB as fallback
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${fields}`,
    ];
    const seen = new Set<string>();
    const arr: FoodResult[] = [];
    for (const url of tryUrls) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "BodyFuelCoaching/1.0" },
        });
        if (!res.ok) continue;
        const json = (await res.json()) as any;
        for (const p of json.products ?? []) {
          const m = mapOff({
            ...p,
            product_name: p.product_name_de || p.product_name || p.generic_name,
          });
          if (!m) continue;
          const key = (m.barcode || m.name) + "|" + (m.brand ?? "");
          if (seen.has(key)) continue;
          seen.add(key);
          arr.push(m);
          if (arr.length >= 20) break;
        }
        if (arr.length) break;
      } catch {
        /* try next */
      }
    }
    return arr;
  });

/* ----------- Targets (coach only) ----------- */

async function assertCoach(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const setNutritionTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      user_id: string;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      water_glasses: number;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("nutrition_targets").upsert(
      {
        user_id: data.user_id,
        kcal: Math.max(0, Math.round(data.kcal)),
        protein_g: Math.max(0, Math.round(data.protein_g)),
        carbs_g: Math.max(0, Math.round(data.carbs_g)),
        fat_g: Math.max(0, Math.round(data.fat_g)),
        water_glasses: Math.max(1, Math.round(data.water_glasses)),
        updated_by: context.userId,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getNutritionTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    // self or coach
    if (data.user_id !== context.userId) {
      await assertCoach(context.supabase, context.userId);
    }
    const { data: row, error } = await context.supabase
      .from("nutrition_targets")
      .select("*")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });
