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

/** Search via OpenFoodFacts (DE bias) */
export const searchFoods = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }) => {
    const q = data.query.trim();
    if (!q) return [] as FoodResult[];
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=15&lc=de&countries=germany`;
    const res = await fetch(url);
    if (!res.ok) return [] as FoodResult[];
    const json = (await res.json()) as any;
    const arr: FoodResult[] = [];
    for (const p of json.products ?? []) {
      const m = mapOff(p);
      if (m) arr.push(m);
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
