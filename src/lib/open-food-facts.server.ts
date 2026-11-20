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
  // OFF's conventional _100g keys describe the label's 100 g/100 ml basis.
  // If explicit _100ml fields exist, never mix them with mass-based fields.
  const basis = unit === "ml" && Object.keys(n).some((key) => key.endsWith("_100ml")) ? "100ml" : "100g";
  const per = (key: string) =>
    Number(n[`${key}_${basis}`]);
  const kcal = per("energy-kcal");
  const protein = per("proteins");
  const carbs = per("carbohydrates");
  const fat = per("fat");
  if (["energy-kcal", "proteins", "carbohydrates", "fat"].some((key) => n[`${key}_${basis}`] == null)) return null;
  if (![kcal, protein, carbs, fat].every((v) => Number.isFinite(v) && v >= 0)) return null;
  if (kcal > 900 || [protein, carbs, fat].some((v) => v > 100)) return null;
  // Qualitätsfilter: ohne kcal und ohne Makros ist der Datensatz wertlos.
  if (!kcal && !protein && !carbs && !fat) return null;

  const name = String(
    p.product_name_de || p.product_name || p.generic_name_de || p.generic_name || "",
  ).trim();
  if (!name) return null;

  const fiber = n[`fiber_${basis}`];
  const energy = checkFoodEnergy({
    kcal_per_100g: kcal,
    protein_per_100g: protein,
    carbs_per_100g: carbs,
    fat_per_100g: fat,
    fiber_per_100g: fiber == null ? null : Number(fiber),
  });
  // An inconsistent label must be reviewed, not silently converted to invented kcal.
  if (energy.flagged) return null;

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
    sugar_per_100g: n[`sugars_${basis}`] == null ? null : per("sugars"),
    saturated_fat_per_100g:
      n[`saturated-fat_${basis}`] == null ? null : per("saturated-fat"),
    salt_per_100g: n[`salt_${basis}`] == null ? null : per("salt"),
    sodium_mg_per_100g: n[`sodium_${basis}`] == null ? null : per("sodium") * 1000,
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
