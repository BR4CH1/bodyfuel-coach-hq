// ============================================================
// BodyFuel Nutrition Engine (Server)
// ============================================================
// Single source of truth for meal macros. Replaces AI-hallucinated numbers
// with deterministic math against `nutrition_foods` (BLS 4.0 / coach-verified).
//
// Hard rules:
//   1. The AI may write recipe text + ingredients list, but NEVER macros.
//   2. Every calorie/macro shown to the user comes from this engine.
//   3. factor = grams / 100;  kcal = per100g.kcal * factor;  (same for P/C/F)
//   4. Total kcal MUST equal round(P*4 + C*4 + F*9). Tolerance 8 %.
//   5. Validation: known carb staples (Brot, Reis, Nudeln, Haferflocken, …)
//      must produce realistic carbs. Otherwise a warning is recorded.
// ============================================================

export type EngineIngredient = {
  name: string;          // raw name as written by the AI / user
  grams: number;         // canonical mass in grams (0 = ignore, e.g. water/spices)
  display?: string;      // optional pretty label (e.g. "3 Scheiben Vollkornbrot (100g)")
};

export type IngredientDebug = {
  input: EngineIngredient;
  matched_food: { id: string; name: string; source: string; verified: boolean } | null;
  grams_used: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  warning: string | null;
};

export type EngineResult = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  coverage: number;            // 0..1 of (matched grams) / (total grams of weighted ingredients)
  data_source: "db_verified" | "db_mixed" | "ai_estimate";
  warnings: string[];
  debug: IngredientDebug[];
};

// ---------- Food lookup ----------

type FoodRow = {
  id: string;
  name: string;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  verified_by_coach: boolean;
  source: string;
  aliases: string[] | null;
};

const SOURCE_PRIORITY: Record<string, number> = {
  bodyfuel_verified: 0,
  bls_4_0: 1,
  open_food_facts: 2,
  usda: 3,
  manual: 4,
  ai_estimate: 5,
};

const STOPWORDS = new Set([
  "roh", "gekocht", "gegart", "gebraten", "gedünstet", "gegrillt",
  "frisch", "trocken", "tk", "tiefgekühlt", "dose", "optional",
  "fettarm", "mager", "magerer", "magere", "magerem", "natur", "pur",
  "light", "zuckerarm", "ungesüßt", "ungesalzen", "gewürfelt",
  "geschnitten", "gerieben", "gehackt", "fein", "grob", "kalt", "warm",
  "scheibe", "scheiben", "stück", "stueck", "stk", "el", "tl",
  "esslöffel", "teelöffel", "prise", "prisen", "bund", "g", "gramm",
  "ml", "milliliter", "l", "liter", "kg",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[0-9.,]+/g, " ")
    .replace(/[,;:/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(name: string): string[] {
  return normalize(name)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** Try a sequence of progressively shorter probes against name + aliases. */
export async function lookupFood(
  supabase: any,
  rawName: string,
): Promise<FoodRow | null> {
  const norm = normalize(rawName);
  const toks = tokens(rawName);
  if (!norm || !toks.length) return null;

  const probes = Array.from(
    new Set([
      norm,
      toks.join(" "),
      toks.slice(-3).join(" "),
      toks.slice(-2).join(" "),
      toks[toks.length - 1],
      toks[0],
    ]),
  ).filter((p) => p && p.length >= 3);

  for (const probe of probes) {
    const safe = probe.replace(/[,()%{}]/g, "").slice(0, 60);
    if (!safe) continue;
    const { data, error } = await supabase
      .from("nutrition_foods")
      .select(
        "id,name,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,verified_by_coach,source,aliases",
      )
      .or(`name.ilike.%${safe}%,aliases.cs.{${safe}}`)
      .limit(15);
    if (error || !data?.length) continue;

    const rows = (data as FoodRow[]).filter((r) => {
      const n = (r.name ?? "").toLowerCase();
      if (n.includes(safe)) return true;
      const al = (r.aliases ?? []).map((a) => (a ?? "").toLowerCase());
      return al.some((a) => a === safe || a.includes(safe));
    });
    if (!rows.length) continue;

    rows.sort((a, b) => {
      const an = (a.name ?? "").toLowerCase();
      const bn = (b.name ?? "").toLowerCase();
      const aExact = an === safe || (a.aliases ?? []).some((x) => (x ?? "").toLowerCase() === safe) ? 0 : 1;
      const bExact = bn === safe || (b.aliases ?? []).some((x) => (x ?? "").toLowerCase() === safe) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      if (a.verified_by_coach !== b.verified_by_coach) return a.verified_by_coach ? -1 : 1;
      return (SOURCE_PRIORITY[a.source] ?? 9) - (SOURCE_PRIORITY[b.source] ?? 9);
    });
    return rows[0];
  }
  return null;
}

// ---------- Compute ----------

/** Major carbohydrate staples — if these appear, carbs must be substantial. */
const CARB_STAPLES: Array<{ re: RegExp; minCarbsPer100g: number; label: string }> = [
  { re: /\b(brot|brötchen|broetchen|toast|baguette|wrap|tortilla)\b/i, minCarbsPer100g: 35, label: "Brot" },
  { re: /\b(reis)\b/i, minCarbsPer100g: 25, label: "Reis" }, // gekocht ~28, roh ~78
  { re: /\b(nudel|pasta|spaghetti|penne|fusilli|tagliatelle)\b/i, minCarbsPer100g: 25, label: "Pasta" },
  { re: /\b(haferflocken|porridge|oats|müsli|muesli)\b/i, minCarbsPer100g: 55, label: "Haferflocken" },
  { re: /\b(kartoffel|kartoffeln|süßkartoffel|suesskartoffel)\b/i, minCarbsPer100g: 14, label: "Kartoffel" },
  { re: /\b(couscous|bulgur|quinoa)\b/i, minCarbsPer100g: 18, label: "Getreide-Beilage" },
];

/** Compute macros for a list of structured ingredients. */
export async function computeMealFromIngredients(
  supabase: any,
  ingredients: EngineIngredient[],
): Promise<EngineResult> {
  const debug: IngredientDebug[] = [];
  const warnings: string[] = [];
  let kcal = 0, p = 0, c = 0, f = 0;
  let totalGrams = 0, matchedGrams = 0;
  let anyMatched = false;
  let anyMissed = false;

  for (const ing of ingredients) {
    const grams = Number(ing.grams) || 0;
    if (grams <= 0) {
      // Spices/water/optional — record but ignore for math + coverage.
      debug.push({
        input: ing, matched_food: null, grams_used: 0,
        kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
        warning: null,
      });
      continue;
    }

    const food = await lookupFood(supabase, ing.name);
    totalGrams += grams;
    if (!food) {
      anyMissed = true;
      const w = `Zutat nicht in DB gefunden: „${ing.name}" (${grams} g) — Nährwerte ignoriert.`;
      warnings.push(w);
      debug.push({
        input: ing, matched_food: null, grams_used: grams,
        kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
        warning: w,
      });
      continue;
    }

    anyMatched = true;
    matchedGrams += grams;
    const factor = grams / 100;
    const ik = (food.kcal_per_100g ?? 0) * factor;
    const ip = (food.protein_per_100g ?? 0) * factor;
    const ic = (food.carbs_per_100g ?? 0) * factor;
    const ifa = (food.fat_per_100g ?? 0) * factor;
    kcal += ik; p += ip; c += ic; f += ifa;

    // Validation: known carb staple must yield realistic carbs.
    let ingWarn: string | null = null;
    for (const staple of CARB_STAPLES) {
      if (staple.re.test(ing.name) && (food.carbs_per_100g ?? 0) < staple.minCarbsPer100g) {
        ingWarn = `„${ing.name}" wurde als „${food.name}" erkannt — aber ${food.carbs_per_100g} g KH/100 g liegt unter dem Plausibilitäts-Minimum für ${staple.label} (${staple.minCarbsPer100g} g/100 g). Mapping prüfen.`;
        warnings.push(ingWarn);
        break;
      }
    }

    debug.push({
      input: ing,
      matched_food: { id: food.id, name: food.name, source: food.source, verified: food.verified_by_coach },
      grams_used: grams,
      kcal: round1(ik),
      protein_g: round1(ip),
      carbs_g: round1(ic),
      fat_g: round1(ifa),
      warning: ingWarn,
    });
  }

  // Force kcal = 4P + 4C + 9F (within rounding) — never trust kcal from
  // outside math. This is the *single* place this constraint is enforced.
  const macroKcal = Math.round(p * 4 + c * 4 + f * 9);
  const summedKcal = Math.round(kcal);
  if (summedKcal > 0 && Math.abs(macroKcal - summedKcal) / summedKcal > 0.08) {
    warnings.push(
      `Plausibilitäts-Hinweis: Summe aus Lebensmittel-kcal (${summedKcal}) und 4·P + 4·C + 9·F (${macroKcal}) weichen >8 % ab. Verwende den Makro-Wert.`,
    );
  }

  const coverage = totalGrams > 0 ? matchedGrams / totalGrams : 0;
  const data_source: EngineResult["data_source"] =
    anyMatched && !anyMissed ? "db_verified"
    : anyMatched ? "db_mixed"
    : "ai_estimate";

  return {
    kcal: macroKcal,
    protein_g: Math.round(p),
    carbs_g: Math.round(c),
    fat_g: Math.round(f),
    coverage: Math.round(coverage * 100) / 100,
    data_source,
    warnings,
    debug,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------- AI-output -> EngineIngredient[] coercion ----------

/** Coerce loose AI output { name, amount, unit } / { name, grams } into EngineIngredient[]. */
export function coerceIngredients(raw: unknown): EngineIngredient[] {
  if (!Array.isArray(raw)) return [];
  const out: EngineIngredient[] = [];
  for (const r of raw as any[]) {
    if (!r || typeof r !== "object") continue;
    const name = String(r.name ?? "").trim();
    if (!name) continue;
    let grams = 0;
    if (typeof r.grams === "number") grams = r.grams;
    else if (typeof r.amount_g === "number") grams = r.amount_g;
    else if (typeof r.amount === "number") {
      const u = String(r.unit ?? "g").toLowerCase();
      if (u === "g" || u === "gramm") grams = r.amount;
      else if (u === "kg") grams = r.amount * 1000;
      else if (u === "ml" || u === "milliliter") grams = r.amount; // density 1.0 fallback
      else if (u === "l" || u === "liter") grams = r.amount * 1000;
      else if (u === "el" || u === "esslöffel") grams = r.amount * 15;
      else if (u === "tl" || u === "teelöffel") grams = r.amount * 5;
      else if (u === "prise" || u === "prisen") grams = 0; // spices ignored
      else grams = 0; // unknown unit → ignore for math
    }
    out.push({
      name,
      grams: Math.max(0, Math.round(grams)),
      display: typeof r.display === "string" ? r.display : undefined,
    });
  }
  return out;
}

// ---------- Self-tests ----------

export type SelfTestCase = {
  name: string;
  ingredients: EngineIngredient[];
  expect: { kcalMin: number; kcalMax: number; pMin: number; pMax: number; cMin: number; cMax: number; fMin: number; fMax: number };
};

export const SELF_TEST_CASES: SelfTestCase[] = [
  {
    name: "Porridge: 100 g Haferflocken + 150 g Apfel + Wasser + Zimt",
    ingredients: [
      { name: "Haferflocken", grams: 100 },
      { name: "Apfel", grams: 150 },
      { name: "Wasser", grams: 0 },
      { name: "Zimt", grams: 0 },
    ],
    expect: { kcalMin: 420, kcalMax: 500, pMin: 12, pMax: 16, cMin: 65, cMax: 90, fMin: 6, fMax: 10 },
  },
  {
    name: "Vollkornbrot + Rinderaufschnitt + Tomate + Gewürzgurken",
    ingredients: [
      { name: "Vollkornbrot", grams: 100 },
      { name: "Rinderaufschnitt", grams: 100 },
      { name: "Tomate", grams: 100 },
      { name: "Gewürzgurken", grams: 50 },
    ],
    expect: { kcalMin: 300, kcalMax: 420, pMin: 25, pMax: 40, cMin: 35, cMax: 60, fMin: 3, fMax: 9 },
  },
  {
    name: "100 g Reis roh",
    ingredients: [{ name: "Reis", grams: 100 }],
    expect: { kcalMin: 330, kcalMax: 380, pMin: 6, pMax: 10, cMin: 70, cMax: 82, fMin: 0, fMax: 3 },
  },
  {
    name: "100 g Hähnchenbrust",
    ingredients: [{ name: "Hähnchenbrust", grams: 100 }],
    expect: { kcalMin: 95, kcalMax: 135, pMin: 20, pMax: 26, cMin: 0, cMax: 2, fMin: 0, fMax: 4 },
  },
  {
    name: "100 g Olivenöl",
    ingredients: [{ name: "Olivenöl", grams: 100 }],
    expect: { kcalMin: 860, kcalMax: 905, pMin: 0, pMax: 1, cMin: 0, cMax: 1, fMin: 95, fMax: 100 },
  },
];

export type SelfTestRun = {
  name: string;
  passed: boolean;
  result: EngineResult;
  expect: SelfTestCase["expect"];
  reasons: string[];
};

export async function runEngineSelfTests(supabase: any): Promise<{
  passed: number;
  failed: number;
  runs: SelfTestRun[];
}> {
  const runs: SelfTestRun[] = [];
  for (const tc of SELF_TEST_CASES) {
    const res = await computeMealFromIngredients(supabase, tc.ingredients);
    const reasons: string[] = [];
    if (res.kcal < tc.expect.kcalMin || res.kcal > tc.expect.kcalMax)
      reasons.push(`kcal ${res.kcal} außerhalb [${tc.expect.kcalMin}, ${tc.expect.kcalMax}]`);
    if (res.protein_g < tc.expect.pMin || res.protein_g > tc.expect.pMax)
      reasons.push(`P ${res.protein_g} außerhalb [${tc.expect.pMin}, ${tc.expect.pMax}]`);
    if (res.carbs_g < tc.expect.cMin || res.carbs_g > tc.expect.cMax)
      reasons.push(`C ${res.carbs_g} außerhalb [${tc.expect.cMin}, ${tc.expect.cMax}]`);
    if (res.fat_g < tc.expect.fMin || res.fat_g > tc.expect.fMax)
      reasons.push(`F ${res.fat_g} außerhalb [${tc.expect.fMin}, ${tc.expect.fMax}]`);
    runs.push({ name: tc.name, passed: reasons.length === 0, result: res, expect: tc.expect, reasons });
  }
  const passed = runs.filter((r) => r.passed).length;
  return { passed, failed: runs.length - passed, runs };
}
