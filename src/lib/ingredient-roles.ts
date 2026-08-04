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

/**
 * Nährwerte pro 100 g für häufige Grundnahrungsmittel (BLS/USDA-nahe
 * Standardwerte, Zustand wie üblich geplant: Reis/Nudeln roh, Brot verzehrfertig).
 * Nur Fallback — die Lebensmitteldatenbank hat immer Vorrang.
 */
const FALLBACK_PER100: Array<[string, Per100]> = [
  ["haferflocken", { kcal: 372, protein_g: 13.5, carbs_g: 58.7, fat_g: 7 }],
  ["reis", { kcal: 349, protein_g: 7.4, carbs_g: 77.7, fat_g: 0.6 }],
  ["nudel", { kcal: 350, protein_g: 12.5, carbs_g: 69, fat_g: 1.4 }],
  ["pasta", { kcal: 350, protein_g: 12.5, carbs_g: 69, fat_g: 1.4 }],
  ["kartoffel", { kcal: 70, protein_g: 2, carbs_g: 14.6, fat_g: 0.1 }],
  ["susskartoffel", { kcal: 86, protein_g: 1.6, carbs_g: 18.4, fat_g: 0.1 }],
  ["brot", { kcal: 232, protein_g: 7.7, carbs_g: 41, fat_g: 1.2 }],
  ["toast", { kcal: 269, protein_g: 8.5, carbs_g: 48, fat_g: 3.5 }],
  ["wrap", { kcal: 300, protein_g: 8, carbs_g: 50, fat_g: 6 }],
  ["couscous", { kcal: 358, protein_g: 12, carbs_g: 70, fat_g: 1.5 }],
  ["quinoa", { kcal: 368, protein_g: 14, carbs_g: 58, fat_g: 6 }],
  ["banane", { kcal: 88, protein_g: 1.1, carbs_g: 20, fat_g: 0.2 }],
  ["apfel", { kcal: 52, protein_g: 0.3, carbs_g: 11.4, fat_g: 0.2 }],
  ["beere", { kcal: 45, protein_g: 1, carbs_g: 7, fat_g: 0.4 }],
  ["hahnchen", { kcal: 107, protein_g: 23.1, carbs_g: 0, fat_g: 1.3 }],
  ["pute", { kcal: 105, protein_g: 24, carbs_g: 0, fat_g: 1 }],
  ["rind", { kcal: 145, protein_g: 21, carbs_g: 0, fat_g: 6.5 }],
  ["lachs", { kcal: 202, protein_g: 20, carbs_g: 0, fat_g: 13.6 }],
  ["thunfisch", { kcal: 108, protein_g: 24, carbs_g: 0, fat_g: 1 }],
  ["tofu", { kcal: 127, protein_g: 15.4, carbs_g: 1.5, fat_g: 7 }],
  ["tempeh", { kcal: 190, protein_g: 19, carbs_g: 6.4, fat_g: 10 }],
  ["magerquark", { kcal: 67, protein_g: 12, carbs_g: 4.1, fat_g: 0.3 }],
  ["quark", { kcal: 67, protein_g: 12, carbs_g: 4.1, fat_g: 0.3 }],
  ["skyr", { kcal: 63, protein_g: 11, carbs_g: 4, fat_g: 0.2 }],
  ["joghurt", { kcal: 61, protein_g: 3.5, carbs_g: 4.7, fat_g: 3.3 }],
  ["ei", { kcal: 137, protein_g: 11.9, carbs_g: 0.7, fat_g: 9.3 }],
  ["linsen", { kcal: 328, protein_g: 23.5, carbs_g: 46, fat_g: 1.5 }],
  ["kichererbsen", { kcal: 306, protein_g: 19, carbs_g: 41, fat_g: 5.9 }],
  ["olivenol", { kcal: 805, protein_g: 0, carbs_g: 0, fat_g: 91 }],
  ["rapsol", { kcal: 805, protein_g: 0, carbs_g: 0, fat_g: 91 }],
  ["butter", { kcal: 741, protein_g: 0.7, carbs_g: 0.6, fat_g: 83 }],
  ["mandel", { kcal: 570, protein_g: 21, carbs_g: 5, fat_g: 52 }],
  ["walnuss", { kcal: 654, protein_g: 15, carbs_g: 7, fat_g: 63 }],
  ["erdnussbutter", { kcal: 588, protein_g: 25, carbs_g: 12, fat_g: 50 }],
  ["avocado", { kcal: 138, protein_g: 1.9, carbs_g: 3.6, fat_g: 12 }],
  ["kase", { kcal: 350, protein_g: 25, carbs_g: 1, fat_g: 27 }],
  ["mozzarella", { kcal: 254, protein_g: 18, carbs_g: 1.5, fat_g: 20 }],
  ["feta", { kcal: 264, protein_g: 14, carbs_g: 1, fat_g: 22 }],
  ["gemuse", { kcal: 30, protein_g: 2, carbs_g: 3.5, fat_g: 0.3 }],
  ["salat", { kcal: 15, protein_g: 1.2, carbs_g: 1.5, fat_g: 0.2 }],
  ["brokkoli", { kcal: 34, protein_g: 3.8, carbs_g: 2.7, fat_g: 0.2 }],
  ["tomate", { kcal: 18, protein_g: 1, carbs_g: 2.6, fat_g: 0.2 }],
  ["zucchini", { kcal: 19, protein_g: 1.6, carbs_g: 2.2, fat_g: 0.4 }],
  ["paprika", { kcal: 26, protein_g: 1.2, carbs_g: 4.5, fat_g: 0.3 }],
  ["spinat", { kcal: 20, protein_g: 2.7, carbs_g: 0.6, fat_g: 0.4 }],
  ["zwiebel", { kcal: 28, protein_g: 1.2, carbs_g: 4.9, fat_g: 0.3 }],
];

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

/** Nährwert-Fallback für häufige Grundnahrungsmittel. `null` = unbekannt. */
export function fallbackPer100(name: string): Per100 | null {
  const n = normalize(name);
  if (!n) return null;
  let best: { key: string; value: Per100 } | null = null;
  for (const [key, value] of FALLBACK_PER100) {
    if (!n.includes(key)) continue;
    if (!best || key.length > best.key.length) best = { key, value };
  }
  return best ? { ...best.value } : null;
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
