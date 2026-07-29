/**
 * Live-Anbindung an Open Food Facts für Markenprodukte (Milbona, Aldi, ja!, …).
 *
 * Der interne BodyFuel-Katalog deckt Grundlebensmittel ab; Markenartikel mit
 * Barcode kommen ergänzend von Open Food Facts. Werte werden strikt pro 100 g
 * bzw. pro 100 ml übernommen — es findet keine Umrechnung statt.
 */

import { checkFoodEnergy } from "@/lib/food-energy";
import type { FoodResult } from "@/lib/nutrition.types";

const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_de",
  "generic_name",
  "generic_name_de",
  "brands",
  "quantity",
  "nutriments",
  "serving_size",
  "serving_quantity",
  "image_front_small_url",
  "image_small_url",
  "image_front_url",
  "image_url",
].join(",");

const USER_AGENT = "BodyFuelCoaching/1.0 (nutrition tracker)";

function offImage(p: any): string | null {
  return (
    p?.image_front_small_url ||
    p?.image_small_url ||
    p?.image_front_url ||
    p?.image_url ||
    p?.selected_images?.front?.small?.de ||
    p?.selected_images?.front?.small?.en ||
    null
  );
}

async function fetchJsonWithTimeout(url: string, ms: number): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Flüssigkeiten werden in ml geführt, alles andere in g. */
function detectUnit(p: any): "g" | "ml" {
  const hay = `${p?.quantity ?? ""} ${p?.serving_size ?? ""}`.toLowerCase();
  if (/\d\s*(ml|cl|l\b|liter)/.test(hay)) return "ml";
  const n = p?.nutriments ?? {};
  if (n["energy-kcal_100ml"] != null || n["proteins_100ml"] != null) return "ml";
  return "g";
}

export function mapOffProduct(p: any): FoodResult | null {
  const n = p?.nutriments;
  if (!n) return null;
  const unit = detectUnit(p);
  const per = (key: string) =>
    Number(n[`${key}_100g`] ?? n[`${key}_100ml`] ?? 0) || 0;
  const kcal =
    Number(n["energy-kcal_100g"] ?? n["energy-kcal_100ml"] ?? n["energy-kcal"] ?? 0) || 0;
  const protein = per("proteins");
  const carbs = per("carbohydrates");
  const fat = per("fat");
  // Qualitätsfilter: ohne kcal und ohne Makros ist der Datensatz wertlos.
  if (!kcal && !protein && !carbs && !fat) return null;

  const name = String(
    p.product_name_de || p.product_name || p.generic_name_de || p.generic_name || "",
  ).trim();
  if (!name) return null;

  const fiber = n["fiber_100g"] ?? n["fiber_100ml"];
  const energy = checkFoodEnergy({
    kcal_per_100g: kcal,
    protein_per_100g: protein,
    carbs_per_100g: carbs,
    fat_per_100g: fat,
    fiber_per_100g: fiber == null ? null : Number(fiber),
  });

  const image_url = offImage(p);
  return {
    id: null,
    name: name.slice(0, 140),
    brand: offBrand(p),
    barcode: p.code ? String(p.code) : null,
    unit,
    density_g_per_ml: null,
    kcal_per_100g: energy.kcal_per_100g,
    protein_per_100g: protein,
    carbs_per_100g: carbs,
    fat_per_100g: fat,
    fiber_per_100g: fiber == null ? null : Number(fiber),
    sugar_per_100g: n["sugars_100g"] == null ? null : Number(n["sugars_100g"]),
    saturated_fat_per_100g:
      n["saturated-fat_100g"] == null ? null : Number(n["saturated-fat_100g"]),
    salt_per_100g: n["salt_100g"] == null ? null : Number(n["salt_100g"]),
    sodium_mg_per_100g: n["sodium_100g"] == null ? null : Number(n["sodium_100g"]) * 1000,
    serving_g: null,
    serving_label: `pro 100 ${unit}`,
    source: "open_food_facts",
    verified_by_coach: false,
    image_url,
    image_source: image_url ? "open_food_facts" : null,
    energy_flagged: energy.flagged,
    energy_note: energy.reason,
    aliases: offBrandList(p),
  };
}

/** OFF liefert Marken je nach Endpoint als String oder Array. */
function offBrandList(p: any): string[] | null {
  const raw = p?.brands;
  const list = Array.isArray(raw)
    ? raw.map((b) => String(b ?? "").trim())
    : String(raw ?? "")
        .split(",")
        .map((b) => b.trim());
  const cleaned = list.filter(Boolean);
  return cleaned.length ? cleaned : null;
}

function offBrand(p: any): string | null {
  return offBrandList(p)?.[0] ?? null;
}

/** Markenprodukt-Suche über die aktuelle OFF-Such-API. Best effort. */
export async function searchOpenFoodFacts(query: string, limit = 25): Promise<FoodResult[]> {
  const q = query.trim();
  if (!q) return [];
  const pageSize = Math.min(50, Math.max(10, limit));
  const base = "https://search.openfoodfacts.org/search";
  const common = `&page_size=${pageSize}&fields=${OFF_FIELDS}`;
  const deUrl =
    `${base}?q=${encodeURIComponent(q)}&langs=de,en${common}` +
    `&countries_tags=germany,austria,switzerland&sort_by=-popularity_key`;
  const worldUrl = `${base}?q=${encodeURIComponent(q)}&langs=de,en${common}`;

  const [de, world] = await Promise.all([
    fetchJsonWithTimeout(deUrl, 4500),
    fetchJsonWithTimeout(worldUrl, 4500),
  ]);

  const products = [
    ...((de?.hits ?? de?.products ?? []) as any[]),
    ...((world?.hits ?? world?.products ?? []) as any[]),
  ];
  const out: FoodResult[] = [];
  const seen = new Set<string>();
  for (const p of products) {
    const key = String(p?.code ?? "");
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const mapped = mapOffProduct(p);
    if (mapped) out.push(mapped);
  }
  return out;
}


/** Barcode-Fallback, wenn der interne Katalog den Code nicht kennt. */
export async function lookupOpenFoodFactsBarcode(code: string): Promise<FoodResult | null> {
  const json = await fetchJsonWithTimeout(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`,
    4000,
  );
  if (!json || json.status !== 1) return null;
  return mapOffProduct(json.product);
}
