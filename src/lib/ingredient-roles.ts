/**
 * BodyFuel — zentrale Zutaten-Klassifikation für den Makro-Ziel-Editor.
 *
 * Regeln (siehe Projekt-Memory):
 *   - Werte immer pro 100 g bzw. 100 ml.
 *   - Keine frei geschätzten kcal: die Fallback-Tabelle enthält ausschließlich
 *     BLS-/USDA-nahe Standardwerte für häufige Grundnahrungsmittel und wird nur
 *     genutzt, wenn die Lebensmitteldatenbank keinen Treffer liefert.
 *   - carbs = ohne Ballaststoffe.
 */

export type IngredientRole = "carb" | "protein" | "fat" | "vegetable" | "fruit" | "other";

export type Per100 = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

const normalize = (raw: string): string =>
  (raw ?? "")
    .toString()
    .toLowerCase()
    .replace(/[äÄ]/g, "a")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Haupt-Kohlenhydratquellen — werden bei Low Carb zuerst reduziert. */
const CARB_MARKERS = [
  "reis", "nudel", "pasta", "spaghetti", "penne", "fusilli", "tagliatelle",
  "brot", "brotchen", "toast", "baguette", "wrap", "tortilla", "fladen",
  "haferflocken", "hafer", "muesli", "granola", "cornflakes", "porridge",
  "kartoffel", "pommes", "kloss", "knodel", "gnocchi", "sussskartoffel",
  "susskartoffel", "couscous", "bulgur", "quinoa", "hirse", "polenta",
  "mais", "popcorn", "cracker", "zwieback", "knackebrot", "mehl", "grieb",
  "grieb", "griess", "zucker", "honig", "sirup", "marmelade", "dattel",
  "reiswaffel", "banane", "waffel", "pfannkuchen", "pancake", "brezel",
  "linsen nudel", "risotto", "semmel", "burger bun", "bun", "pizzateig", "teig",
];

/** Proteinquellen — bleiben möglichst stabil. */
const PROTEIN_MARKERS = [
  "hahnchen", "huhn", "hunchen", "pute", "truthahn", "rind", "beef", "steak",
  "schwein", "pork", "hack", "lamm", "kalb", "ente", "filet", "schnitzel",
  "fisch", "lachs", "thunfisch", "kabeljau", "seelachs", "forelle", "garnele",
  "shrimp", "surimi", "tofu", "tempeh", "seitan", "sojaschnetzel", "sojahack",
  "quark", "skyr", "huttenkase", "korniger frischkase", "protein", "whey",
  "casein", "eiweisspulver", "ei", "eier", "eiklar", "eiweiss", "linsen",
  "kichererbsen", "bohnen", "erbsenprotein", "joghurt", "magerquark",
  "harzer", "putenbrust", "schinken", "lachsfilet", "sojajoghurt",
];

/** Fettquellen. */
const FAT_MARKERS = [
  "ol", "olivenol", "rapsol", "leinol", "kokosol", "butter", "ghee", "margarine",
  "sahne", "creme fraiche", "mandel", "walnuss", "cashew", "haselnuss", "nuss",
  "nusse", "erdnuss", "erdnussbutter", "mandelmus", "tahini", "avocado",
  "samen", "kern", "chia", "leinsamen", "sonnenblumenkern", "kurbiskern",
  "sesam", "kase", "mozzarella", "feta", "parmesan", "halloumi", "schmand",
  "mayonnaise", "aioli", "pesto", "kokosmilch", "speck", "bacon", "salami",
];

/** Gemüse & kalorienarme Zutaten — werden nie automatisch verändert. */
const VEGETABLE_MARKERS = [
  "gemuse", "salat", "spinat", "brokkoli", "blumenkohl", "zucchini", "paprika",
  "tomate", "gurke", "karotte", "mohre", "sellerie", "lauch", "zwiebel",
  "knoblauch", "champignon", "pilz", "aubergine", "kohl", "rucola", "feldsalat",
  "bohnenkraut", "spargel", "rosenkohl", "kohlrabi", "radieschen", "rettich",
  "sprossen", "petersilie", "basilikum", "schnittlauch", "koriander", "dill",
  "gewurz", "salz", "pfeffer", "paprikapulver", "curry", "chili", "zitrone",
  "limette", "essig", "senf", "sojasauce", "bruhe", "wasser", "kraut",
  "erbsen tiefgekuhlt", "grune bohnen",
];

const FRUIT_MARKERS = [
  "apfel", "birne", "beere", "himbeere", "heidelbeere", "erdbeere", "brombeere",
  "orange", "mandarine", "kiwi", "mango", "ananas", "pfirsich", "aprikose",
  "melone", "traube", "kirsche", "pflaume", "rosine", "feige", "granatapfel",
];

export type FoodState = "raw" | "cooked" | null;

const COOKED_TOKENS = [
  "gekocht",
  "gegart",
  "gedampft",
  "gedunstet",
  "gebraten",
  "zubereitet",
  "abgetropft",
  "aus der dose",
  "konserve",
  "gar",
];
const RAW_TOKENS = ["roh", "trocken", "getrocknet", "ungekocht", "ungegart"];

/**
 * Erkennt den Zustand aus dem Zutatennamen. Roh und gekocht dürfen niemals
 * automatisch ineinander umgerechnet werden (Projektregel), deshalb wird der
 * Zustand hier explizit ausgewertet und beim Nährwert-Lookup erzwungen.
 */
export function detectFoodState(name: string): FoodState {
  const n = normalize(name);
  if (!n) return null;
  const hasToken = (token: string) =>
    token.includes(" ") ? n.includes(token) : new RegExp(`(^| )${token}( |$)`).test(n);
  if (COOKED_TOKENS.some(hasToken)) return "cooked";
  if (RAW_TOKENS.some(hasToken)) return "raw";
  return null;
}

type FallbackEntry = { key: string; state: FoodState; value: Per100 };

/**
 * Nährwerte pro 100 g (BLS-/USDA-nahe Standardwerte). Für zustandsabhängige
 * Grundnahrungsmittel gibt es getrennte Roh- und Gekocht-Einträge; es wird
 * niemals von einem Zustand in den anderen umgerechnet.
 * Nur Fallback — die Lebensmitteldatenbank hat immer Vorrang.
 */
const FALLBACK_PER100: FallbackEntry[] = [
  // --- zustandsabhängige Stärkebeilagen -----------------------------------
  { key: "reis", state: "raw", value: { kcal: 349, protein_g: 7.4, carbs_g: 77.7, fat_g: 0.6 } },
  { key: "reis", state: "cooked", value: { kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 } },
  { key: "vollkornreis", state: "raw", value: { kcal: 344, protein_g: 7.8, carbs_g: 70.6, fat_g: 2.2 } },
  { key: "vollkornreis", state: "cooked", value: { kcal: 111, protein_g: 2.6, carbs_g: 21.3, fat_g: 0.9 } },
  { key: "reisnudel", state: "raw", value: { kcal: 360, protein_g: 5.9, carbs_g: 80.2, fat_g: 0.6 } },
  { key: "reisnudel", state: "cooked", value: { kcal: 109, protein_g: 0.9, carbs_g: 24.9, fat_g: 0.2 } },
  { key: "nudel", state: "raw", value: { kcal: 350, protein_g: 12.5, carbs_g: 69, fat_g: 1.4 } },
  { key: "nudel", state: "cooked", value: { kcal: 158, protein_g: 5.8, carbs_g: 30.9, fat_g: 0.9 } },
  { key: "pasta", state: "raw", value: { kcal: 350, protein_g: 12.5, carbs_g: 69, fat_g: 1.4 } },
  { key: "pasta", state: "cooked", value: { kcal: 158, protein_g: 5.8, carbs_g: 30.9, fat_g: 0.9 } },
  { key: "spaghetti", state: "raw", value: { kcal: 350, protein_g: 12.5, carbs_g: 69, fat_g: 1.4 } },
  { key: "spaghetti", state: "cooked", value: { kcal: 158, protein_g: 5.8, carbs_g: 30.9, fat_g: 0.9 } },
  { key: "quinoa", state: "raw", value: { kcal: 368, protein_g: 14, carbs_g: 58, fat_g: 6 } },
  { key: "quinoa", state: "cooked", value: { kcal: 120, protein_g: 4.4, carbs_g: 18.5, fat_g: 1.9 } },
  { key: "couscous", state: "raw", value: { kcal: 358, protein_g: 12, carbs_g: 70, fat_g: 1.5 } },
  { key: "couscous", state: "cooked", value: { kcal: 112, protein_g: 3.8, carbs_g: 23.2, fat_g: 0.2 } },
  { key: "bulgur", state: "raw", value: { kcal: 342, protein_g: 12.3, carbs_g: 63, fat_g: 1.3 } },
  { key: "bulgur", state: "cooked", value: { kcal: 83, protein_g: 3.1, carbs_g: 17, fat_g: 0.2 } },
  { key: "hirse", state: "raw", value: { kcal: 354, protein_g: 10.6, carbs_g: 68.8, fat_g: 3.9 } },
  { key: "hirse", state: "cooked", value: { kcal: 119, protein_g: 3.5, carbs_g: 23.7, fat_g: 1 } },
  { key: "polenta", state: "raw", value: { kcal: 358, protein_g: 8.5, carbs_g: 73, fat_g: 1.5 } },
  { key: "polenta", state: "cooked", value: { kcal: 85, protein_g: 2, carbs_g: 17.5, fat_g: 0.4 } },
  { key: "haferflocken", state: "raw", value: { kcal: 372, protein_g: 13.5, carbs_g: 58.7, fat_g: 7 } },
  { key: "haferflocken", state: "cooked", value: { kcal: 71, protein_g: 2.5, carbs_g: 11.7, fat_g: 1.5 } },
  { key: "kartoffel", state: "raw", value: { kcal: 70, protein_g: 2, carbs_g: 14.6, fat_g: 0.1 } },
  { key: "kartoffel", state: "cooked", value: { kcal: 70, protein_g: 2, carbs_g: 14.6, fat_g: 0.1 } },
  { key: "susskartoffel", state: "raw", value: { kcal: 86, protein_g: 1.6, carbs_g: 18.4, fat_g: 0.1 } },
  { key: "susskartoffel", state: "cooked", value: { kcal: 90, protein_g: 2, carbs_g: 18.4, fat_g: 0.2 } },
  // --- Hülsenfrüchte (trocken vs. gekocht/Dose) ---------------------------
  { key: "linsen", state: "raw", value: { kcal: 328, protein_g: 23.5, carbs_g: 46, fat_g: 1.5 } },
  { key: "linsen", state: "cooked", value: { kcal: 116, protein_g: 9, carbs_g: 15.6, fat_g: 0.4 } },
  { key: "kichererbsen", state: "raw", value: { kcal: 306, protein_g: 19, carbs_g: 41, fat_g: 5.9 } },
  { key: "kichererbsen", state: "cooked", value: { kcal: 164, protein_g: 8.9, carbs_g: 20, fat_g: 2.6 } },
  { key: "bohnen", state: "raw", value: { kcal: 291, protein_g: 21.1, carbs_g: 41, fat_g: 1.6 } },
  { key: "bohnen", state: "cooked", value: { kcal: 127, protein_g: 8.7, carbs_g: 17, fat_g: 0.5 } },
  // --- Namen, die "reis"/"nudel" enthalten, aber keine Stärkebeilage sind ---
  { key: "blumenkohlreis", state: null, value: { kcal: 25, protein_g: 1.9, carbs_g: 2.4, fat_g: 0.3 } },
  { key: "konjaknudel", state: null, value: { kcal: 8, protein_g: 0.2, carbs_g: 0.5, fat_g: 0.1 } },
  { key: "reiswaffel", state: null, value: { kcal: 387, protein_g: 8.2, carbs_g: 81, fat_g: 3.1 } },
  { key: "erbsen reis protein", state: null, value: { kcal: 375, protein_g: 80, carbs_g: 4, fat_g: 5 } },
  // --- zustandsneutrale Lebensmittel --------------------------------------
  { key: "brot", state: null, value: { kcal: 232, protein_g: 7.7, carbs_g: 41, fat_g: 1.2 } },

  { key: "toast", state: null, value: { kcal: 269, protein_g: 8.5, carbs_g: 48, fat_g: 3.5 } },
  { key: "wrap", state: null, value: { kcal: 300, protein_g: 8, carbs_g: 50, fat_g: 6 } },
  { key: "banane", state: null, value: { kcal: 88, protein_g: 1.1, carbs_g: 20, fat_g: 0.2 } },
  { key: "apfel", state: null, value: { kcal: 52, protein_g: 0.3, carbs_g: 11.4, fat_g: 0.2 } },
  { key: "beere", state: null, value: { kcal: 45, protein_g: 1, carbs_g: 7, fat_g: 0.4 } },
  { key: "hahnchen", state: null, value: { kcal: 107, protein_g: 23.1, carbs_g: 0, fat_g: 1.3 } },
  { key: "pute", state: null, value: { kcal: 105, protein_g: 24, carbs_g: 0, fat_g: 1 } },
  { key: "rind", state: null, value: { kcal: 145, protein_g: 21, carbs_g: 0, fat_g: 6.5 } },
  { key: "lachs", state: null, value: { kcal: 202, protein_g: 20, carbs_g: 0, fat_g: 13.6 } },
  { key: "thunfisch", state: null, value: { kcal: 108, protein_g: 24, carbs_g: 0, fat_g: 1 } },
  { key: "tofu", state: null, value: { kcal: 127, protein_g: 15.4, carbs_g: 1.5, fat_g: 7 } },
  { key: "tempeh", state: null, value: { kcal: 190, protein_g: 19, carbs_g: 6.4, fat_g: 10 } },
  { key: "magerquark", state: null, value: { kcal: 67, protein_g: 12, carbs_g: 4.1, fat_g: 0.3 } },
  { key: "quark", state: null, value: { kcal: 67, protein_g: 12, carbs_g: 4.1, fat_g: 0.3 } },
  { key: "skyr", state: null, value: { kcal: 63, protein_g: 11, carbs_g: 4, fat_g: 0.2 } },
  { key: "joghurt", state: null, value: { kcal: 61, protein_g: 3.5, carbs_g: 4.7, fat_g: 3.3 } },
  { key: "ei", state: null, value: { kcal: 137, protein_g: 11.9, carbs_g: 0.7, fat_g: 9.3 } },
  { key: "olivenol", state: null, value: { kcal: 805, protein_g: 0, carbs_g: 0, fat_g: 91 } },
  { key: "rapsol", state: null, value: { kcal: 805, protein_g: 0, carbs_g: 0, fat_g: 91 } },
  { key: "butter", state: null, value: { kcal: 741, protein_g: 0.7, carbs_g: 0.6, fat_g: 83 } },
  { key: "mandel", state: null, value: { kcal: 570, protein_g: 21, carbs_g: 5, fat_g: 52 } },
  { key: "walnuss", state: null, value: { kcal: 654, protein_g: 15, carbs_g: 7, fat_g: 63 } },
  { key: "erdnussbutter", state: null, value: { kcal: 588, protein_g: 25, carbs_g: 12, fat_g: 50 } },
  { key: "avocado", state: null, value: { kcal: 138, protein_g: 1.9, carbs_g: 3.6, fat_g: 12 } },
  { key: "kase", state: null, value: { kcal: 350, protein_g: 25, carbs_g: 1, fat_g: 27 } },
  { key: "mozzarella", state: null, value: { kcal: 254, protein_g: 18, carbs_g: 1.5, fat_g: 20 } },
  { key: "feta", state: null, value: { kcal: 264, protein_g: 14, carbs_g: 1, fat_g: 22 } },
  { key: "gemuse", state: null, value: { kcal: 30, protein_g: 2, carbs_g: 3.5, fat_g: 0.3 } },
  { key: "salat", state: null, value: { kcal: 15, protein_g: 1.2, carbs_g: 1.5, fat_g: 0.2 } },
  { key: "brokkoli", state: null, value: { kcal: 34, protein_g: 3.8, carbs_g: 2.7, fat_g: 0.2 } },
  { key: "tomate", state: null, value: { kcal: 18, protein_g: 1, carbs_g: 2.6, fat_g: 0.2 } },
  { key: "zucchini", state: null, value: { kcal: 19, protein_g: 1.6, carbs_g: 2.2, fat_g: 0.4 } },
  { key: "paprika", state: null, value: { kcal: 26, protein_g: 1.2, carbs_g: 4.5, fat_g: 0.3 } },
  { key: "spinat", state: null, value: { kcal: 20, protein_g: 2.7, carbs_g: 0.6, fat_g: 0.4 } },
  { key: "zwiebel", state: null, value: { kcal: 28, protein_g: 1.2, carbs_g: 4.9, fat_g: 0.3 } },
];

/**
 * Zustand, der gilt, wenn im Namen keiner angegeben ist.
 * Beilagen werden im Coaching üblicherweise als Trockengewicht geplant,
 * Hülsenfrüchte und Kartoffeln als verzehrfertige Menge.
 */
const BARE_STATE: Record<string, Exclude<FoodState, null>> = {
  reis: "raw",
  vollkornreis: "raw",
  reisnudel: "raw",
  nudel: "raw",
  pasta: "raw",
  spaghetti: "raw",
  quinoa: "raw",
  couscous: "raw",
  bulgur: "raw",
  hirse: "raw",
  polenta: "raw",
  haferflocken: "raw",
  kartoffel: "cooked",
  susskartoffel: "cooked",
  linsen: "cooked",
  kichererbsen: "cooked",
  bohnen: "cooked",
};

function markerHit(name: string, markers: readonly string[]): boolean {
  const n = normalize(name);
  if (!n) return false;
  return markers.some((marker) => {
    if (marker === "ei" || marker === "ol") {
      return new RegExp(`(^| )${marker}(er|e|s)?( |$)`).test(n);
    }
    return n.includes(marker);
  });
}

/**
 * Nährwert-Fallback für häufige Grundnahrungsmittel. `null` = unbekannt.
 * Der spezifischste Treffer gewinnt (längster Schlüssel), der Zustand aus dem
 * Namen hat Vorrang vor dem Standardzustand.
 */
export function fallbackPer100(name: string): Per100 | null {
  const n = normalize(name);
  if (!n) return null;

  let bestKey: string | null = null;
  for (const entry of FALLBACK_PER100) {
    if (!n.includes(entry.key)) continue;
    if (!bestKey || entry.key.length > bestKey.length) bestKey = entry.key;
  }
  if (!bestKey) return null;

  const variants = FALLBACK_PER100.filter((entry) => entry.key === bestKey);
  const wantedState = detectFoodState(n) ?? BARE_STATE[bestKey] ?? null;
  const match =
    variants.find((entry) => entry.state === wantedState) ??
    variants.find((entry) => entry.state === null) ??
    variants[0];
  return match ? { ...match.value } : null;
}


/** Rolle aus dem Namen ableiten (Marker haben Vorrang vor Makro-Heuristik). */
export function classifyIngredientRole(name: string, per100?: Per100 | null): IngredientRole {
  if (markerHit(name, VEGETABLE_MARKERS)) return "vegetable";
  if (markerHit(name, CARB_MARKERS)) return "carb";
  if (markerHit(name, PROTEIN_MARKERS)) return "protein";
  if (markerHit(name, FAT_MARKERS)) return "fat";
  if (markerHit(name, FRUIT_MARKERS)) return "fruit";

  if (per100) {
    if (per100.kcal > 0 && per100.kcal < 60 && per100.carbs_g < 10) return "vegetable";
    const fromProtein = per100.protein_g * 4;
    const fromCarbs = per100.carbs_g * 4;
    const fromFat = per100.fat_g * 9;
    const total = fromProtein + fromCarbs + fromFat;
    if (total > 0) {
      if (fromCarbs / total >= 0.5) return "carb";
      if (fromFat / total >= 0.5) return "fat";
      if (fromProtein / total >= 0.35) return "protein";
    }
  }
  return "other";
}

export type RoleBounds = { min: number; max: number };

/**
 * Realistische Mengengrenzen je Rolle. `allowZero` erlaubt das komplette
 * Streichen einer Kohlenhydratquelle (z. B. Banane im Skyr bei Keto).
 */
export function roleBounds(
  role: IngredientRole,
  baseGrams: number,
  options: { allowZero?: boolean } = {},
): RoleBounds {
  const base = Math.max(0, Math.round(baseGrams));
  switch (role) {
    case "carb":
      return { min: options.allowZero ? 0 : Math.round(base * 0.15), max: Math.round(base * 2.5) };
    case "fruit":
      return { min: 0, max: Math.round(base * 1.5) };
    case "fat":
      return { min: Math.round(base * 0.2), max: Math.round(base * 2) };
    case "protein":
      return { min: Math.round(base * 0.6), max: Math.round(base * 2) };
    case "vegetable":
    case "other":
    default:
      return { min: base, max: base };
  }
}

/** Rundet Mengen auf plausible Schritte (5 g ab 40 g, sonst 1 g). */
export function roundGrams(grams: number): number {
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  return grams >= 40 ? Math.round(grams / 5) * 5 : Math.round(grams);
}
