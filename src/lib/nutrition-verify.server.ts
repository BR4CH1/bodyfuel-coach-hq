// Server-only helper: prüft KI-generierte Mahlzeiten-Beschreibungen
// gegen unsere geprüfte BodyFuel-DB (nutrition_foods, BLS 4.0 + verified)
// UND rechnet die Nährwerte bei guter Trefferquote aus den DB-Werten neu.
//
// Die KI halluziniert regelmäßig Makros (z. B. 207 g KH für 100 g Haferflocken
// + 1 Apfel). Wenn wir genug Zutaten 1:1 in der DB finden, ersetzen wir die
// KI-Werte durch saubere Rechnung: gramm / 100 * nährwert_per_100g.
//
// Zusätzlich erzwingen wir immer kcal = round(P*4 + C*4 + F*9).

export type DataSource =
  | "db_verified"
  | "db_mixed"
  | "ai_estimate"
  | "coach_verified";

export type VerifyResult = {
  data_source: DataSource;
  verified_ratio: number; // 0..1
  matched: string[];
  unmatched: string[];
};

export type RecomputedMacros = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  coverage: number; // 0..1 — Anteil der erkannten Zutaten (gewichtet nach Gramm)
  matched: string[];
  unmatched: string[];
};

type ParsedIngredient = {
  raw: string;
  name: string;
  grams: number | null;
};

// --- Parsing ---------------------------------------------------------------

const STOP_WORDS =
  /\b(roh|gekocht|gegart|gebraten|gedünstet|gegrillt|frisch|trocken|tk|tiefgekühlt|dose|optional|fettarm|mager|magere|magerer|magerem|natur|pur|light|zuckerarm|ungesüßt|ungesalzen|gewürfelt|geschnitten|gerieben|gehackt|fein|grob|in scheiben|kalt|warm)\b/gi;

function cleanName(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, " ")
    .replace(STOP_WORDS, " ")
    .replace(/[,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

// Default-Stückgewichte (g) für gängige Lebensmittel.
const PIECE_GRAMS: Array<[RegExp, number]> = [
  [/\bapfel\b/i, 150],
  [/\bbirne\b/i, 150],
  [/\bbanane\b/i, 120],
  [/\borange\b/i, 180],
  [/\bzitrone\b/i, 80],
  [/\bei\b|\beier\b/i, 60],
  [/\bscheibe\b|\bscheiben\b/i, 45], // Brot/Aufschnitt
  [/\bkartoffel\b/i, 120],
  [/\btomate\b/i, 90],
  [/\bgurke\b/i, 300],
  [/\bpaprika\b/i, 150],
  [/\bzwiebel\b/i, 80],
  [/\bknoblauch(?:zehe)?\b/i, 5],
  [/\bavocado\b/i, 170],
];

function defaultPieceGrams(name: string): number | null {
  for (const [re, g] of PIECE_GRAMS) if (re.test(name)) return g;
  return null;
}

// Parser für eine Zutatenzeile aus der KI-Beschreibung.
// Akzeptiert: "100g Haferflocken", "1 Apfel (150g)", "2 Scheiben Vollkornbrot",
// "1 EL Olivenöl", "300ml Wasser", "50 g Gurken".
function parseIngredientLine(raw: string): ParsedIngredient | null {
  const original = raw.trim();
  if (!original) return null;

  // Wenn am Ende eine Gramm-Angabe in Klammern steht, bevorzugt nehmen.
  const tail = original.match(/\((\d+(?:[.,]\d+)?)\s*(g|gramm|ml|l|kg)\)/i);
  if (tail) {
    let amount = parseFloat(tail[1].replace(",", "."));
    const unit = tail[2].toLowerCase();
    if (unit === "kg") amount *= 1000;
    if (unit === "l") amount *= 1000;
    const name = cleanName(original.replace(tail[0], ""));
    if (name.length >= 3) return { raw: original, name, grams: amount };
  }

  // Standard: "<menge><einheit?> <name>"
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

  const name = cleanName(nameRaw);
  if (!name || name.length < 3) return null;

  if (amount == null) {
    // Keine Menge erkannt → unbrauchbar für Berechnung
    return { raw: original, name, grams: null };
  }

  let grams: number | null = null;
  if (/^kg|kilogramm$/.test(unit)) grams = amount * 1000;
  else if (/^g|gramm$/.test(unit)) grams = amount;
  else if (/^l|liter$/.test(unit)) grams = amount * 1000; // ml→g default 1.0
  else if (/^ml|milliliter$/.test(unit)) grams = amount;
  else if (/^el|esslöffel$/.test(unit)) grams = amount * 15;
  else if (/^tl|teelöffel$/.test(unit)) grams = amount * 5;
  else if (/^prise/.test(unit)) grams = amount * 1;
  else if (/^scheibe/.test(unit)) grams = amount * 45;
  else if (/^bund$/.test(unit)) grams = amount * 30;
  else if (/^(stück|stueck|stk|ei|eier)/.test(unit) || !unit) {
    const pg = defaultPieceGrams(name);
    if (pg) grams = amount * pg;
    else if (!unit) grams = null; // nackte Zahl ohne erkennbares Stück → unsicher
    else grams = amount * 100;
  }

  return { raw: original, name, grams };
}

export function parseDescription(
  description: string | null | undefined,
): ParsedIngredient[] {
  if (!description) return [];
  // Splittet an Komma, Semikolon, Zeilenumbruch, " und ".
  return description
    .split(/[\n;,]| und /gi)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
    .map(parseIngredientLine)
    .filter((p): p is ParsedIngredient => !!p);
}

// --- DB-Lookup -------------------------------------------------------------

type FoodRow = {
  id: string;
  name: string;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  verified_by_coach: boolean;
  source: string;
};

const SOURCE_PRIORITY: Record<string, number> = {
  bls_4_0: 1,
  open_food_facts: 2,
  usda: 3,
  manual: 4,
  ai_estimate: 5,
};

async function lookupFood(
  supabase: any,
  name: string,
): Promise<FoodRow | null> {
  const tokens = name.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
  if (!tokens.length) return null;

  // Mehrere Lookup-Strategien: ganzer Name, letzte 2 Worte, letztes Wort,
  // erstes Wort. Sucht in name UND aliases.
  const probes = Array.from(
    new Set([
      name.toLowerCase(),
      tokens.slice(-2).join(" "),
      tokens[tokens.length - 1],
      tokens[0],
    ]),
  ).filter((p) => p && p.length >= 3);

  for (const probe of probes) {
    const safe = probe.replace(/[,()%{}]/g, "").slice(0, 60);
    if (!safe) continue;
    // Suche in Name (ilike) ODER in aliases (case-insensitive Array-Match).
    const { data, error } = await supabase
      .from("nutrition_foods")
      .select(
        "id,name,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,verified_by_coach,source,aliases",
      )
      .or(`name.ilike.%${safe}%,aliases.cs.{${safe}}`)
      .limit(10);
    if (error) continue;
    let rows = (data ?? []) as (FoodRow & { aliases?: string[] | null })[];
    if (!rows.length) continue;
    // Aliases sind case-sensitive im Array — also nochmal manuell prüfen
    // und exakte Treffer bevorzugen.
    rows = rows.filter((r) => {
      const n = (r.name ?? "").toLowerCase();
      if (n.includes(safe)) return true;
      const al = (r.aliases ?? []).map((a) => (a ?? "").toLowerCase());
      return al.some((a) => a === safe || a.includes(safe));
    });
    if (!rows.length) continue;
    rows.sort((a, b) => {
      // exakter Name-Match zuerst
      const aExact = (a.name ?? "").toLowerCase() === safe ? 0 : 1;
      const bExact = (b.name ?? "").toLowerCase() === safe ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      if (a.verified_by_coach !== b.verified_by_coach) return a.verified_by_coach ? -1 : 1;
      return (SOURCE_PRIORITY[a.source] ?? 9) - (SOURCE_PRIORITY[b.source] ?? 9);
    });
    return rows[0];
  }
  return null;
}

/**
 * Rechnet die Makros einer Mahlzeit auf Basis der DB neu.
 * Liefert auch coverage zurück (Anteil der erkannten Zutaten, gewichtet nach Gramm).
 */
export async function recomputeMealFromDb(
  supabase: any,
  description: string | null | undefined,
): Promise<RecomputedMacros | null> {
  const ingredients = parseDescription(description);
  if (!ingredients.length) return null;

  let kcal = 0;
  let p = 0;
  let c = 0;
  let f = 0;
  let totalGrams = 0;
  let matchedGrams = 0;
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const ing of ingredients) {
    const grams = ing.grams ?? 0;
    totalGrams += grams || 50; // Zutat ohne Menge zählt mit 50 g Gewicht (für Coverage)
    const food = await lookupFood(supabase, ing.name);
    if (!food || !grams) {
      unmatched.push(ing.raw);
      continue;
    }
    matched.push(ing.raw);
    matchedGrams += grams;
    const factor = grams / 100;
    kcal += (food.kcal_per_100g ?? 0) * factor;
    p += (food.protein_per_100g ?? 0) * factor;
    c += (food.carbs_per_100g ?? 0) * factor;
    f += (food.fat_per_100g ?? 0) * factor;
  }

  const coverage = totalGrams > 0 ? matchedGrams / totalGrams : 0;

  // Konsistenz erzwingen: kcal aus Makros (4/4/9).
  const kcalFromMacros = Math.round(p * 4 + c * 4 + f * 9);

  return {
    kcal: kcalFromMacros,
    protein_g: Math.round(p),
    carbs_g: Math.round(c),
    fat_g: Math.round(f),
    coverage: Math.round(coverage * 100) / 100,
    matched,
    unmatched,
  };
}

/**
 * Erzwingt 4/4/9-Konsistenz für eine Mahlzeit:
 * Wenn die gespeicherten kcal mehr als 8 % von Protein*4 + KH*4 + Fett*9 abweichen,
 * werden kcal auf den Makro-Wert korrigiert.
 */
export function enforceKcalConsistency<T extends { kcal?: number | null; protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null }>(
  meal: T,
): T {
  const p = Number(meal.protein_g) || 0;
  const c = Number(meal.carbs_g) || 0;
  const f = Number(meal.fat_g) || 0;
  if (p <= 0 && c <= 0 && f <= 0) return meal;
  const calc = Math.round(p * 4 + c * 4 + f * 9);
  const stored = Number(meal.kcal) || 0;
  if (stored <= 0) return { ...meal, kcal: calc };
  const diff = Math.abs(stored - calc) / stored;
  if (diff > 0.08) return { ...meal, kcal: calc };
  return meal;
}

// --- Verifikation (Datenqualitätslabel) -----------------------------------

const INGREDIENT_LINE =
  /(\d+[.,]?\d*)\s*(g|ml|stk|stück|el|tl|kcal|portion|portionen)?\s*([a-zäöüß][a-zäöüß \-'/().0-9]+)/gi;

function ingredientKeyword(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, "")
    .replace(/[0-9]+/g, "")
    .replace(/\b(roh|gekocht|gegart|gebraten|frisch|trocken|tk|dose)\b/gi, "")
    .trim()
    .toLowerCase();
}

export function parseIngredients(
  description: string | null | undefined,
): string[] {
  if (!description) return [];
  const out: string[] = [];
  const text = description.replace(/\n/g, ",");
  for (const part of text.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    INGREDIENT_LINE.lastIndex = 0;
    const m = INGREDIENT_LINE.exec(trimmed);
    if (m) {
      const kw = ingredientKeyword(m[3] ?? "");
      if (kw && kw.length >= 3) out.push(kw);
    }
  }
  return out;
}

export async function verifyMealAgainstDb(
  supabase: any,
  description: string | null | undefined,
): Promise<VerifyResult> {
  const items = parseIngredients(description);
  if (items.length === 0) {
    return { data_source: "ai_estimate", verified_ratio: 0, matched: [], unmatched: [] };
  }
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const kw of items) {
    const head = kw.split(/\s+/).slice(-2).join(" ");
    const probe = head.length >= 3 ? head : kw;
    const { data, error } = await supabase
      .from("nutrition_foods")
      .select("id")
      .or(`name.ilike.%${probe}%,aliases.cs.{${probe}}`)
      .limit(1);
    if (error) {
      unmatched.push(kw);
      continue;
    }
    if ((data?.length ?? 0) > 0) matched.push(kw);
    else unmatched.push(kw);
  }
  const ratio = matched.length / items.length;
  const data_source: DataSource =
    ratio >= 0.8 ? "db_verified" : ratio >= 0.4 ? "db_mixed" : "ai_estimate";
  return { data_source, verified_ratio: Math.round(ratio * 100) / 100, matched, unmatched };
}
