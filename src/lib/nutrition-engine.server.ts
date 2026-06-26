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
  default_state?: string | null;
  unit_type?: string | null;
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
  "gekochter", "gekochte", "gekochtes", "gekochten", "gekochtem",
  "frisch", "trocken", "tk", "tiefgekühlt", "dose", "optional",
  "fettarm", "mager", "magerer", "magere", "magerem", "natur", "pur",
  "fett", "prozent", "extra", "groß", "große", "gross", "grosse",
  "light", "zuckerarm", "ungesüßt", "ungesalzen", "gewürfelt",
  "geschnitten", "gerieben", "gehackt", "fein", "grob", "kalt", "warm",
  "scheibe", "scheiben", "stück", "stueck", "stk", "je", "el", "tl",
  "esslöffel", "teelöffel", "prise", "prisen", "bund", "g", "gramm",
  "ml", "milliliter", "l", "liter", "kg",
]);

const BLOCKING_WARNING_PREFIX = "KRITISCH:";

const STATE_HINTS = {
  raw: /\b(roh(?:e|er|es|en|em)?|ungekocht|trocken|dry|raw)\b/i,
  cooked: /\b(gekocht(?:e|er|es|en|em)?|gegart(?:e|er|es|en|em)?|gebraten(?:e|er|es|en|em)?|gegrillt(?:e|er|es|en|em)?|gebacken(?:e|er|es|en|em)?|zubereitet|cooked)\b/i,
  deli: /\b(aufschnitt|geräuchert(?:e|er|es|en|em)?|geraeuchert(?:e|er|es|en|em)?|dose|konserve|abgetropft)\b/i,
};

const PROBE_REWRITES: Array<[RegExp, string]> = [
  [/\bgekocht(?:e|er|es|en|em)?\s+reis\b/g, "reis weiß gekocht"],
  [/\breis\s+gekocht(?:e|er|es|en|em)?\b/g, "reis weiß gekocht"],
  [/\b(?:roh(?:e|er|es|en|em)?|ungekocht|trocken)\s+reis\b/g, "reis weiß roh"],
  [/\breis\s+(?:roh(?:e|er|es|en|em)?|ungekocht|trocken)\b/g, "reis weiß roh"],
  [/\brinderhackfleisch\s+extra\s+mager\b/g, "rinderhack mager"],
  [/\bextra\s+mager(?:es|er|e|em|en)?\s+rinderhackfleisch\b/g, "rinderhack mager"],
  [/\bmager(?:es|er|e|em|en)?\s+rinderhackfleisch\b/g, "rinderhack mager"],
  [/\brinderhackfleisch\b/g, "rinderhack mager"],
  [/\bhackfleisch\s+rind\b/g, "rinderhack mager"],
  [/\bpaprikaschoten?\b/g, "paprika"],
  [/\bhähnchenbrustfilet\b/g, "hähnchenbrust"],
  [/\bhaehnchenbrustfilet\b/g, "hähnchenbrust"],
  [/\bhähnchenfilet\b/g, "hähnchenbrust"],
  [/\bhaehnchenfilet\b/g, "hähnchenbrust"],
  [/\bputenbrustfilet\b/g, "putenbrust"],
  [/\bpute\s+filet\b/g, "putenbrust"],
  [/\bvollkorn[-\s]?wraps?\b/g, "weizenwrap"],
  [/\bwraps?\b/g, "weizenwrap"],
  [/\btortillas?\b/g, "tortilla"],
  [/\bvollkornnudeln\b/g, "vollkornnudeln"],
  [/\bvollkornpasta\b/g, "vollkornnudeln"],
  [/\bgrüne\s+bohnen\b/g, "grüne bohnen"],
  [/\bgruene\s+bohnen\b/g, "grüne bohnen"],
  [/\bgemischtes\s+gemüse\b/g, "gemischtes gemüse"],
  [/\bgemischtes\s+gemuese\b/g, "gemischtes gemüse"],
  [/\bkarotten(?:stifte|scheiben)?\b/g, "karotte"],
  [/\bmöhren(?:stifte|scheiben)?\b/g, "karotte"],
  [/\bmoehren(?:stifte|scheiben)?\b/g, "karotte"],
  [/\bgurken(?:scheiben|stifte)?\b/g, "gurke"],
  [/\bsalatblätter\b/g, "kopfsalat"],
  [/\bsalatblaetter\b/g, "kopfsalat"],
  // Eggs: bare "Eier" / "Ei" / "3 Eier" must always resolve to Hühnerei
  [/\beier\b/g, "hühnerei"],
  [/\bei\b/g, "hühnerei"],
  [/\bvollei\b/g, "hühnerei"],
  // Generic light cheese variants (Light-Käse, Käse light, Magerkäse)
  [/\blight\s+käse\b/g, "gouda light"],
  [/\bkäse\s+light\b/g, "gouda light"],
  [/\bmager(?:käse|kaese)\b/g, "gouda light"],
  [/\bharzer\s+käse\b/g, "harzer käse"],
  // Joghurt-Dressing → Joghurt
  [/\bjoghurt[-\s]?dressing\b/g, "joghurt natur"],
  // Coconut milk
  [/\bkokosmilch\s+light\b/g, "kokosmilch light"],
  [/\bkokosmilch\b/g, "kokosmilch"],
  // Curry paste – low impact, but provide mapping
  [/\bcurrypaste\b/g, "currypaste"],
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[0-9.,]+/g, " ")
    // Treat hyphens, slashes and other separators as spaces so compounds like
    // "Light-Käse", "Joghurt-Dressing", "BBQ/Honig" tokenize correctly.
    .replace(/[%(),;:/\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(name: string): string[] {
  return normalize(name)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function rewrittenProbes(norm: string): string[] {
  const out = new Set<string>();
  for (const [re, replacement] of PROBE_REWRITES) {
    re.lastIndex = 0;
    if (re.test(norm)) {
      out.add(norm.replace(re, replacement).replace(/\b(mager)\s+\1\b/g, "$1").replace(/\s+/g, " ").trim());
      out.add(replacement);
    }
  }
  return [...out].filter((p) => p.length >= 3);
}

function stateScore(rawName: string, row: FoodRow): number {
  const hay = `${row.name} ${(row.aliases ?? []).join(" ")}`.toLowerCase();
  if (STATE_HINTS.raw.test(rawName)) {
    if (/\b(roh|trocken|ungekocht|raw)\b/.test(hay)) return -40;
    if (/\b(gekocht|gegart|gebraten|aufschnitt|geräuchert|geraeuchert)\b/.test(hay)) return 40;
  }
  if (STATE_HINTS.cooked.test(rawName)) {
    if (/\b(gekocht|gegart|gebraten|gegrillt|cooked)\b/.test(hay)) return -40;
    if (/\b(roh|trocken|ungekocht|raw)\b/.test(hay)) return 40;
  }
  if (STATE_HINTS.deli.test(rawName)) {
    if (/\b(aufschnitt|geräuchert|geraeuchert|dose|konserve)\b/.test(hay)) return -30;
  }
  return 0;
}

function rowMatchScore(row: FoodRow, safe: string, rawName: string): number {
  const n = (row.name ?? "").toLowerCase();
  const aliases = (row.aliases ?? []).map((x) => (x ?? "").toLowerCase());
  let score = 100;
  if (n === safe || aliases.some((x) => x === safe)) score -= 60;
  else if (n.includes(safe)) score -= 35;
  else if (aliases.some((x) => x.includes(safe) || safe.includes(x))) score -= 30;
  score += stateScore(rawName, row);
  if (row.verified_by_coach) score -= 10;
  score += SOURCE_PRIORITY[row.source] ?? 9;
  score += Math.abs(n.length - safe.length) / 20;
  return score;
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
      ...rewrittenProbes(norm),
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
        "id,name,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,verified_by_coach,source,aliases,default_state,unit_type",
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

    rows.sort((a, b) => rowMatchScore(a, safe, rawName) - rowMatchScore(b, safe, rawName));
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

const HIGH_IMPACT_INGREDIENT = /\b(hähnchen|haehnchen|huhn|pute|truthahn|rind|hack|steak|schinken|aufschnitt|lachs|fisch|thunfisch|ei|eier|tofu|tempeh|skyr|quark|joghurt|hüttenkäse|huettenkaese|käse|kaese|mozzarella|feta|gouda|emmentaler|frischkäse|frischkaese|protein|riegel|reis|nudel|pasta|spaghetti|kartoffel|brot|brötchen|broetchen|wrap|tortilla|hafer|müsli|muesli|quinoa|bulgur|couscous|linsen|kichererbsen|bohnen|öl|oel|olivenöl|olivenoel|butter|kokosmilch|nuss|nüsse|nuesse|mandel|avocado)\b/i;
const LOW_IMPACT_INGREDIENT = /\b(wasser|salz|pfeffer|gewürz|gewuerz|zimt|kräuter|kraeuter|essig|zitrone|limette|salat|gurke|tomate|zucchini|paprika|brokkoli|blumenkohl|spinat|spargel|champignon|pilz|zwiebel|knoblauch)\b/i;

function isBlockingMissingIngredient(ing: EngineIngredient): boolean {
  const grams = Number(ing.grams) || 0;
  if (grams < 25) return false;
  if (HIGH_IMPACT_INGREDIENT.test(ing.name)) return true;
  return grams >= 120 && !LOW_IMPACT_INGREDIENT.test(ing.name);
}

export function hasBlockingWarnings(result: Pick<EngineResult, "warnings"> | null | undefined): boolean {
  return !!result?.warnings?.some((w) => w.startsWith(BLOCKING_WARNING_PREFIX));
}

export function isUsableEngineResult(result: EngineResult | null | undefined): result is EngineResult {
  return !!result && result.coverage >= 0.7 && !hasBlockingWarnings(result);
}

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
      const blocking = isBlockingMissingIngredient(ing);
      const w = `${blocking ? BLOCKING_WARNING_PREFIX + " " : ""}Zutat nicht in DB gefunden: „${ing.name}" (${grams} g) — Nährwerte ignoriert.`;
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
        ingWarn = `${BLOCKING_WARNING_PREFIX} „${ing.name}" wurde als „${food.name}" erkannt — aber ${food.carbs_per_100g} g KH/100 g liegt unter dem Plausibilitäts-Minimum für ${staple.label} (${staple.minCarbsPer100g} g/100 g). Mapping prüfen.`;
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

// ---------- Description parser fallback ----------

type ParsedIngredient = { raw: string; name: string; grams: number | null };

const PARSER_STOP_WORDS =
  /\b(optional|zuckerarm|ungesüßt|ungesalzen|gewürfelt|geschnitten|gerieben|gehackt|fein|grob|in scheiben)\b/gi;

function cleanIngredientName(raw: string): string {
  return raw
    .replace(/\((?:je\s*)?\d+(?:[.,]\d+)?\s*(?:g|gramm|ml|l|kg)\)/gi, " ")
    .replace(/[()]/g, " ")
    .replace(/^\s*\d+(?:[.,]\d+)?\s*(scheiben?|stück|stueck|stk\.?|wraps?|tortillas?|brötchen|broetchen|semmeln?|riegel)\s+/i, " ")
    .replace(/\bje\s*\d+(?:[.,]\d+)?\s*(?:g|gramm|ml|l|kg)\b/gi, " ")
    .replace(PARSER_STOP_WORDS, " ")
    .replace(/[,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIngredientText(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of text.replace(/\n/g, ",")) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.flatMap((p) => p.split(/\s+(?:und|\+)\s+/i).map((x) => x.trim()).filter(Boolean));
}

function parseFraction(token: string): number | null {
  const m = token.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (m) {
    const a = parseFloat(m[1].replace(",", "."));
    const b = parseFloat(m[2].replace(",", "."));
    if (b !== 0) return a / b;
  }
  const n = parseFloat(token.replace(",", "."));
  return isFinite(n) ? n : null;
}

const PIECE_GRAMS: Array<[RegExp, number]> = [
  [/\bapfel\b/i, 150], [/\bbirne\b/i, 150], [/\bbanane\b/i, 120], [/\borange\b/i, 180],
  [/\bzitrone\b/i, 80], [/\bei\b|\beier\b/i, 60], [/\bscheibe\b|\bscheiben\b/i, 45],
  [/\b(wrap|wraps|tortilla|tortillas)\b/i, 60],
  [/\b(brötchen|broetchen|semmel|semmeln)\b/i, 70],
  [/\b(reiswaffel|reiswaffeln)\b/i, 8],
  [/\bkartoffel\b/i, 120], [/\btomate\b/i, 90], [/\bgurke\b/i, 300], [/\bpaprika\b/i, 150],
  [/\bzwiebel\b/i, 80], [/\bknoblauch(?:zehe)?\b/i, 5], [/\bavocado\b/i, 170],
  [/\b(proteinriegel|eiweißriegel|eiweissriegel)\b/i, 55],
];

function defaultPieceGrams(name: string): number | null {
  for (const [re, g] of PIECE_GRAMS) if (re.test(name)) return g;
  return null;
}

function parseIngredientLine(raw: string): ParsedIngredient | null {
  const original = raw.trim();
  if (!original) return null;
  // Gramm-Angabe in Klammern = MAßGEBLICHE Gesamtmenge.
  // Stück/Scheiben davor sind nur Anzeige und werden NICHT multipliziert,
  // außer der Prefix "je" steht in der Klammer (z. B. "(je 50g)").
  const tail = original.match(/\((je\s*)?(\d+(?:[.,]\d+)?)\s*(g|gramm|ml|l|kg)\)/i);
  if (tail) {
    let amount = parseFloat(tail[2].replace(",", "."));
    const unit = tail[3].toLowerCase();
    if (unit === "kg" || unit === "l") amount *= 1000;
    const isPerPiece = !!tail[1];
    const beforeTail = original.replace(tail[0], "");
    if (isPerPiece) {
      // "(je Xg)" → mit Stückzahl multiplizieren
      const lead = beforeTail.match(
        /^\s*(\d+(?:[.,]\d+)?|ein(?:e|en|em|er)?)\s*(scheiben?|stück|stueck|stk\.?|wraps?|tortillas?|brötchen|broetchen|semmeln?|riegel)?\s*(.*)$/i,
      );
      if (lead) {
        const countToken = lead[1].toLowerCase();
        const count = /^ein/.test(countToken) ? 1 : parseFloat(countToken.replace(",", "."));
        const restName = cleanIngredientName(lead[3] ?? beforeTail);
        if (Number.isFinite(count) && restName.length >= 3) {
          return { raw: original, name: restName, grams: amount * count };
        }
      }
    }
    // Standardfall: Klammer-Gramm ist Gesamtgewicht. Stückzahl ignorieren.
    const name = cleanIngredientName(beforeTail);
    if (name.length >= 3) return { raw: original, name, grams: amount };
  }
  const m = original.match(
    /^\s*(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?|ein(?:e|en|em|er)?|halb(?:e|er|es)?)\s*(kg|g|gramm|ml|milliliter|l|liter|el|esslöffel|tl|teelöffel|prisen?|scheiben?|stück|stueck|stk\.?|eier?|ei|bund)?\s*(.*)$/i,
  );
  let amount: number | null = null;
  let unit = "";
  let nameRaw = original;
  if (m) {
    const t = m[1].toLowerCase();
    if (/^ein/.test(t)) amount = 1;
    else if (/^halb/.test(t)) amount = 0.5;
    else amount = parseFraction(t);
    unit = (m[2] ?? "").toLowerCase().trim();
    nameRaw = m[3] ?? "";
  }
  const name = cleanIngredientName(nameRaw);
  if (!name || name.length < 3) return null;
  if (amount == null) return { raw: original, name, grams: null };
  let grams: number | null = null;
  if (/^kg|kilogramm$/.test(unit)) grams = amount * 1000;
  else if (/^g|gramm$/.test(unit)) grams = amount;
  else if (/^l|liter$/.test(unit)) grams = amount * 1000;
  else if (/^ml|milliliter$/.test(unit)) grams = amount;
  else if (/^el|esslöffel$/.test(unit)) grams = amount * 15;
  else if (/^tl|teelöffel$/.test(unit)) grams = amount * 5;
  else if (/^prise/.test(unit)) grams = 0;
  else if (/^scheibe/.test(unit)) grams = amount * 45;
  else if (/^bund$/.test(unit)) grams = amount * 30;
  else if (/^(stück|stueck|stk|ei|eier)/.test(unit) || !unit) {
    const pg = defaultPieceGrams(name);
    grams = pg ? amount * pg : null;
  }
  return { raw: original, name, grams };
}

export function parseDescriptionToEngineIngredients(description: string | null | undefined): EngineIngredient[] {
  if (!description) return [];
  return splitIngredientText(description)
    .map(parseIngredientLine)
    .filter((p): p is ParsedIngredient => !!p)
    .map((p) => ({ name: p.name, grams: Math.max(0, Math.round(p.grams ?? 0)), display: p.raw }));
}

export async function computeMealFromDescription(
  supabase: any,
  description: string | null | undefined,
): Promise<EngineResult | null> {
  const ingredients = parseDescriptionToEngineIngredients(description);
  if (!ingredients.length) return null;
  return computeMealFromIngredients(supabase, ingredients);
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
