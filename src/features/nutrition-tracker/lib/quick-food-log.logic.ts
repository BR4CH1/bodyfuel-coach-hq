/**
 * Quick Food Log — reine, testbare Logik (keine KI, kein Netzwerk).
 * Mengen, Datum, Konfidenz, Makroberechnung, lokale Korrekturen, Idempotenz-Schlüssel.
 * Nährwerte stammen immer aus Katalog/Etikett (pro 100 g/ml) oder gekennzeichneten Schätzungen.
 */
import { normalizeFoodTerm } from "@/lib/food-search.logic";
import { piecePresetFor } from "@/lib/food-piece-sizes";

export type QuickMeal = "breakfast" | "lunch" | "dinner" | "snack";
export type QuickUnit =
  | "g"
  | "ml"
  | "l"
  | "kg"
  | "stueck"
  | "scheibe"
  | "el"
  | "tl"
  | "portion"
  | "teller"
  | "handvoll"
  | "glas"
  | "tasse"
  | "flasche"
  | "dose"
  | "becher";
export type EstimateLevel = "exact" | "matched" | "estimated";
export type Confidence = "high" | "medium" | "low";

/** Ausgabe der KI-Zerlegung je Position (keine Nährwerte!). */
export type ParsedFoodItem = {
  phrase: string;
  food_name_de: string;
  brand: string | null;
  quantity: number | null;
  unit: QuickUnit | null;
  vague_qualifier: string | null;
  meal_slot: QuickMeal | null;
  relative_day: string | null;
  is_liquid: boolean;
};

/** Nährwertreferenz pro 100 g bzw. 100 ml. */
export type FoodRef = {
  food_id: string | null;
  name: string;
  brand: string | null;
  unit: "g" | "ml";
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  serving_g: number | null;
  source: string;
  verified: boolean;
};

export type ReviewItem = {
  key: string;
  phrase: string;
  label: string;
  meal: QuickMeal;
  entry_date: string;
  amount: number;
  unit: "g" | "ml";
  /** Anzeige der Originalmenge, z. B. "5 Stück". */
  amount_note: string | null;
  amount_estimated: boolean;
  food: FoodRef | null;
  match_score: number;
  estimate_level: EstimateLevel;
  confidence: Confidence;
  warnings: string[];
  /** Nutzer hat eine unsichere Position ausdrücklich bestätigt. */
  confirmed: boolean;
};

export type Macros = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };

/* ------------------------------ Mengen ------------------------------ */

/** Übliche Größen für ungefähre Angaben (nur Menge, niemals Nährwerte). */
export const VAGUE_UNIT_GRAMS: Record<string, number> = {
  handvoll: 30,
  teller: 350,
  portion: 250,
  el: 15,
  tl: 5,
  schale: 250,
};
export const VAGUE_UNIT_ML: Record<string, number> = {
  glas: 250,
  tasse: 200,
  flasche: 500,
  dose: 330,
  becher: 250,
};
/** Faktoren für umgangssprachliche Mengen-Adjektive. */
export const VAGUE_QUALIFIER_FACTOR: Record<string, number> = {
  ordentlich: 1.3,
  gross: 1.3,
  riesig: 1.6,
  viel: 1.3,
  doppelt: 2,
  bisschen: 0.5,
  wenig: 0.6,
  klein: 0.7,
  halb: 0.5,
};

const DEFAULT_PORTION_G = 150;
const DEFAULT_PORTION_ML = 250;

export type ResolvedAmount = {
  amount: number;
  unit: "g" | "ml";
  note: string | null;
  estimated: boolean;
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function qualifierFactor(q: string | null | undefined): number {
  if (!q) return 1;
  const norm = normalizeFoodTerm(q);
  for (const [k, f] of Object.entries(VAGUE_QUALIFIER_FACTOR)) {
    if (norm.includes(k)) return f;
  }
  return 1;
}

/**
 * Wandelt Zahl + Einheit in Gramm/ml um. Ungenaue Angaben werden immer als geschätzt markiert.
 * Keine Umrechnung roh ↔ gekocht.
 */
export function resolveAmount(
  item: Pick<ParsedFoodItem, "quantity" | "unit" | "vague_qualifier" | "is_liquid" | "food_name_de">,
  food: Pick<FoodRef, "unit" | "serving_g" | "name" | "brand"> | null,
): ResolvedAmount {
  const liquid = food ? food.unit === "ml" : item.is_liquid;
  const target: "g" | "ml" = liquid ? "ml" : "g";
  const q = item.quantity != null && Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : null;
  const factor = qualifierFactor(item.vague_qualifier);
  const unit = item.unit;

  const done = (amount: number, note: string | null, estimated: boolean): ResolvedAmount => ({
    amount: round1(Math.max(0, amount * factor)),
    unit: target,
    note,
    estimated: estimated || factor !== 1,
  });

  if (unit === "g" || unit === "ml") {
    if (q == null) return done(liquid ? DEFAULT_PORTION_ML : DEFAULT_PORTION_G, null, true);
    return done(q, null, false);
  }
  if (unit === "kg" || unit === "l") {
    if (q == null) return done(1000, null, true);
    return done(q * 1000, null, false);
  }
  if (unit === "stueck" || unit === "scheibe") {
    const count = q ?? 1;
    const preset = piecePresetFor({
      name: food?.name ?? item.food_name_de,
      brand: food?.brand ?? null,
      unit: target,
      serving_g: food?.serving_g ?? null,
    });
    const label = unit === "scheibe" ? "Scheibe" : "Stück";
    if (preset) return done(count * preset.grams, `${count} ${preset.label || label}`, q == null);
    return done(count * 100, `${count} ${label}`, true);
  }
  if (unit && unit in VAGUE_UNIT_ML) {
    const per = VAGUE_UNIT_ML[unit]!;
    return done((q ?? 1) * per, `${q ?? 1} ${unit}`, true);
  }
  if (unit && unit in VAGUE_UNIT_GRAMS) {
    const per = VAGUE_UNIT_GRAMS[unit]!;
    return done((q ?? 1) * per, `${q ?? 1} ${unit === "el" ? "EL" : unit === "tl" ? "TL" : unit}`, true);
  }
  // Keine Einheit
  if (q != null) {
    // "2 Eier" ohne Einheit → Stück
    const preset = piecePresetFor({
      name: food?.name ?? item.food_name_de,
      brand: food?.brand ?? null,
      unit: target,
      serving_g: food?.serving_g ?? null,
    });
    if (preset && q <= 30) return done(q * preset.grams, `${q} ${preset.label}`, false);
    if (q >= 20) return done(q, null, true);
    return done(q * (liquid ? DEFAULT_PORTION_ML : DEFAULT_PORTION_G), `${q} Portion`, true);
  }
  const preset = piecePresetFor({
    name: food?.name ?? item.food_name_de,
    brand: food?.brand ?? null,
    unit: target,
    serving_g: food?.serving_g ?? null,
  });
  if (preset) return done(preset.grams, `1 ${preset.label}`, true);
  return done(liquid ? DEFAULT_PORTION_ML : DEFAULT_PORTION_G, "1 Portion", true);
}

/* ------------------------------ Datum ------------------------------ */

export const MAX_DAYS_BACK = 7;

function isoShift(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Löst "today" / "yesterday" / "vorgestern" / ISO relativ zum Basistag auf.
 * Zukunft wird auf heute begrenzt, mehr als 7 Tage zurück ebenfalls.
 */
export function resolveEntryDate(
  relative: string | null | undefined,
  baseDate: string,
  today: string,
): { date: string; adjusted: boolean } {
  const r = (relative ?? "").trim().toLowerCase();
  let date = baseDate;
  if (!r || r === "today" || r === "heute") date = baseDate;
  else if (r === "yesterday" || r === "gestern") date = isoShift(today, -1);
  else if (r === "day_before_yesterday" || r === "vorgestern") date = isoShift(today, -2);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(r)) date = r;
  let adjusted = false;
  if (date > today) {
    date = today;
    adjusted = true;
  }
  const min = isoShift(today, -MAX_DAYS_BACK);
  if (date < min) {
    date = min;
    adjusted = true;
  }
  return { date, adjusted };
}

/* --------------------------- Konfidenz --------------------------- */

export function classifyConfidence(input: {
  food: FoodRef | null;
  matchScore: number;
  brandRequested: boolean;
  brandMatched: boolean;
  amountEstimated: boolean;
  amount: number;
}): { confidence: Confidence; level: EstimateLevel; warnings: string[] } {
  const warnings: string[] = [];
  if (!input.food) {
    return { confidence: "low", level: "estimated", warnings: ["Kein passendes Lebensmittel gefunden"] };
  }
  const isEstimateSource = input.food.source === "ai_estimate";
  if (isEstimateSource) warnings.push("Nährwerte geschätzt (nicht im Katalog)");
  if (input.brandRequested && !input.brandMatched) warnings.push("Marke nicht im Katalog – allgemeiner Wert");
  if (input.amountEstimated) warnings.push("Menge geschätzt");
  if (input.amount <= 0 || input.amount > 3000) warnings.push("Unrealistische Menge – bitte prüfen");

  let confidence: Confidence;
  if (isEstimateSource || input.matchScore < 40 || input.amount <= 0 || input.amount > 3000) confidence = "low";
  else if (input.matchScore < 75 || input.amountEstimated || (input.brandRequested && !input.brandMatched))
    confidence = "medium";
  else confidence = "high";

  const level: EstimateLevel = isEstimateSource || input.amountEstimated
    ? "estimated"
    : input.food.verified || (input.brandRequested && input.brandMatched)
      ? "exact"
      : "matched";
  return { confidence, level, warnings };
}

/** Rote Positionen blockieren das Tracken, bis sie bestätigt wurden. */
export function isBlocking(item: ReviewItem): boolean {
  return item.confidence === "low" && !item.confirmed;
}

/* ----------------------------- Makros ----------------------------- */

export function macrosFor(food: FoodRef | null, amount: number): Macros {
  if (!food || !(amount > 0)) return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const f = amount / 100;
  return {
    kcal: food.kcal_per_100g * f,
    protein_g: food.protein_per_100g * f,
    carbs_g: food.carbs_per_100g * f,
    fat_g: food.fat_per_100g * f,
  };
}

export function sumMacros(items: Pick<ReviewItem, "food" | "amount">[]): Macros {
  return items.reduce<Macros>(
    (acc, it) => {
      const m = macrosFor(it.food, it.amount);
      return {
        kcal: acc.kcal + m.kcal,
        protein_g: acc.protein_g + m.protein_g,
        carbs_g: acc.carbs_g + m.carbs_g,
        fat_g: acc.fat_g + m.fat_g,
      };
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

/** Tageszuordnung, falls die KI keine Mahlzeit erkannt hat. */
export function fallbackMeal(index: number, total: number): QuickMeal {
  if (total <= 1) return "snack";
  const ratio = index / total;
  if (ratio < 0.3) return "breakfast";
  if (ratio < 0.6) return "lunch";
  if (ratio < 0.85) return "dinner";
  return "snack";
}

/* --------------------------- Idempotenz --------------------------- */

/** Stabiler Positionsschlüssel innerhalb eines Entwurfs. */
export function itemKey(index: number, phrase: string): string {
  return `${index}:${normalizeFoodTerm(phrase).slice(0, 40)}`;
}

/** Deterministischer Hash für Text-Cache (FNV-1a, 32 bit). */
export function textHash(text: string): string {
  const norm = text.trim().toLowerCase().replace(/\s+/g, " ");
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/* ---------------------- Lokale Korrekturen ---------------------- */

const UNIT_WORDS: Record<string, "g" | "ml" | "kg" | "l"> = {
  g: "g",
  gr: "g",
  gramm: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  liter: "l",
};

export type LocalCorrection = { key: string; amount: number; unit: "g" | "ml" };

/**
 * Erkennt "Die Erdnussbutter waren eher 70 g" ohne KI.
 * Liefert null, wenn nicht eindeutig (dann KI-Fallback).
 */
export function parseLocalCorrection(text: string, items: ReviewItem[]): LocalCorrection[] | null {
  const norm = normalizeFoodTerm(text.replace(/(\d),(\d)/g, "$1.$2"));
  const m = text.replace(/(\d),(\d)/g, "$1.$2").match(/(\d+(?:\.\d+)?)\s*(kg|gramm|gr|g|ml|liter|l)\b/i);
  if (!m) return null;
  const value = Number(m[1]);
  const unitWord = UNIT_WORDS[m[2]!.toLowerCase()];
  if (!unitWord || !(value > 0)) return null;
  const amount = unitWord === "kg" || unitWord === "l" ? value * 1000 : value;
  const unit: "g" | "ml" = unitWord === "ml" || unitWord === "l" ? "ml" : "g";

  const tokens = norm.split(/\s+/).filter((t) => t.length >= 3);
  const hits = items.filter((it) => {
    const hay = normalizeFoodTerm(`${it.label} ${it.phrase} ${it.food?.name ?? ""}`);
    const compact = hay.replace(/\s+/g, "");
    return tokens.some((t) => !/^\d/.test(t) && (hay.split(/\s+/).includes(t) || (t.length >= 4 && compact.includes(t))));
  });
  if (hits.length !== 1) return null;
  const hit = hits[0]!;
  if (hit.unit !== unit) return null;
  return [{ key: hit.key, amount, unit }];
}

export function applyAmountChange(item: ReviewItem, amount: number): ReviewItem {
  const safe = Math.max(0, Math.min(5000, amount));
  const next = { ...item, amount: round1(safe), amount_note: null, amount_estimated: false };
  const c = classifyConfidence({
    food: next.food,
    matchScore: next.match_score,
    brandRequested: false,
    brandMatched: false,
    amountEstimated: false,
    amount: next.amount,
  });
  return { ...next, confidence: c.confidence, estimate_level: c.level, warnings: c.warnings };
}

/** Ersetzt das Lebensmittel einer Position (Produkt tauschen). */
export function applyFoodChange(item: ReviewItem, food: FoodRef): ReviewItem {
  const c = classifyConfidence({
    food,
    matchScore: 100,
    brandRequested: false,
    brandMatched: false,
    amountEstimated: item.amount_estimated,
    amount: item.amount,
  });
  return {
    ...item,
    food,
    unit: food.unit,
    label: food.brand ? `${food.name} (${food.brand})` : food.name,
    match_score: 100,
    confidence: c.confidence,
    estimate_level: c.level,
    warnings: c.warnings,
  };
}

/** Wandelt eine Review-Position in das Commit-Payload (gerundete, finale Werte). */
export function toCommitItem(item: ReviewItem) {
  const m = macrosFor(item.food, item.amount);
  return {
    key: item.key,
    entry_date: item.entry_date,
    meal: item.meal,
    name: (item.food?.name ?? item.label).slice(0, 120),
    brand: item.food?.brand ?? null,
    food_id: item.food?.food_id ?? null,
    amount: item.amount,
    unit: item.unit,
    grams: item.amount,
    kcal: Math.round(m.kcal),
    protein_g: round1(m.protein_g),
    carbs_g: round1(m.carbs_g),
    fat_g: round1(m.fat_g),
    estimate_level: item.estimate_level,
    raw_phrase: item.phrase.slice(0, 300),
  };
}
