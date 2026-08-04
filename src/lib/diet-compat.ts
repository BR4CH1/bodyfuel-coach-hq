/**
 * BodyFuel — zentrale Ernährungsform-Normalisierung & Kompatibilitätsmatrix.
 *
 * Eine einzige Quelle der Wahrheit für Plan-Builder, Auto-Fill, Meal-Picker
 * und Smart-Plan. Unterstützt deutsche und englische Schreibweisen, ohne
 * bestehende Kundendaten zu brechen.
 */

export type DietStyle =
  | "omnivore"
  | "flexitarian"
  | "pescetarian"
  | "vegetarian"
  | "vegan"
  | "other";

/** Klasse eines Gerichts — bestimmt, für welche Ernährungsformen es zählt. */
export type MealDietClass = "vegan" | "vegetarian" | "pescetarian" | "omnivore";

const DIET_ALIASES: Record<string, DietStyle> = {
  vegan: "vegan",
  vegane: "vegan",
  veganer: "vegan",
  plant_based: "vegan",
  "plant-based": "vegan",
  pflanzlich: "vegan",
  vegetarian: "vegetarian",
  vegetarisch: "vegetarian",
  vegetarier: "vegetarian",
  ovo_lacto: "vegetarian",
  pescetarian: "pescetarian",
  pescatarian: "pescetarian",
  pescetarisch: "pescetarian",
  pescatarisch: "pescetarian",
  fisch: "pescetarian",
  omnivore: "omnivore",
  omnivor: "omnivore",
  alles: "omnivore",
  mischkost: "omnivore",
  flexitarian: "flexitarian",
  flexitarisch: "flexitarian",
  other: "other",
  andere: "other",
  individuell: "other",
};

/** Normalisiert beliebige gespeicherte Werte auf eine bekannte Ernährungsform. */
export function normalizeDietStyle(raw: string | null | undefined): DietStyle | null {
  if (!raw) return null;
  const key = raw.toString().trim().toLowerCase().replace(/\s+/g, "_");
  if (DIET_ALIASES[key]) return DIET_ALIASES[key];
  // Teilstring-Fallback für Freitext ("überwiegend vegetarisch", "vegan (streng)")
  if (key.includes("vegan")) return "vegan";
  if (key.includes("veget")) return "vegetarian";
  if (key.includes("pesc") || key.includes("pesk")) return "pescetarian";
  if (key.includes("flexi")) return "flexitarian";
  if (key.includes("omni")) return "omnivore";
  return null;
}

const MEAT_MARKERS = [
  "hähnchen", "hahnchen", "huhn", "hühner", "pute", "puten", "truthahn", "rind",
  "beef", "steak", "schwein", "pork", "wurst", "salami", "schinken", "speck",
  "bacon", "hack", "lamm", "wild", "kalb", "ente", "gans", "leber",
  "geflügel", "gelatine", "aufschnitt",
];

const FISH_MARKERS = [
  "fisch", "lachs", "salmon", "thunfisch", "tuna", "kabeljau", "seelachs",
  "forelle", "sardine", "hering", "matjes", "makrele", "zander", "pangasius",
  "shrimp", "garnele", "muschel", "meeresfrüchte", "surimi", "anchovis",
];

const DAIRY_EGG_MARKERS = [
  "milch", "milk", "käse", "kase", "cheese", "quark", "skyr", "joghurt",
  "yogurt", "butter", "sahne", "cream", "mozzarella", "feta", "parmesan",
  "halloumi", "hüttenkäse", "frischkäse", "harzer", "whey", "molke", "casein",
  "ei", "eier", "eigelb", "omelett", "rührei", "honig", "ghee",
];

/** Pflanzliche Begriffe, die sonst fälschlich als tierisch gelten würden. */
const PLANT_OVERRIDES = [
  "sojamilch", "hafermilch", "mandelmilch", "reismilch", "pflanzenmilch",
  "sojajoghurt", "sojaquark", "kokosmilch", "sojadrink", "haferdrink",
  "erbsenprotein", "hanfprotein", "kokosjoghurt", "hefeschmelz", "vegan",
  "sojahack", "sojaschnetzel", "sojageschnetzeltes", "soja-geschnetzeltes",
  "eiweißerbse", "kichererbse", "erbsen", "eiweißbrot", "eiweiß",
  "erdnussbutter", "nussbutter", "mandelbutter", "kakaobutter", "tempeh",
  "sojabutter", "pflanzenbutter",
];

export interface MealDietInput {
  name?: string | null;
  description?: string | null;
  tags?: string[] | null;
  ingredients?: Array<{ name?: string | null }> | null;
  main_protein?: string | null;
  no_go_ingredients?: string[] | null;
}

function haystack(m: MealDietInput): string {
  let hay = [
    m.name ?? "",
    m.description ?? "",
    m.main_protein ?? "",
    ...(m.ingredients ?? []).map((i) => i?.name ?? ""),
  ]
    .join(" | ")
    .toLowerCase();
  for (const term of PLANT_OVERRIDES) {
    hay = hay.split(term).join(" pflanzlich ");
  }
  // Verneinungen ("ohne Käse", "ohne Ei") dürfen nicht als Marker zählen.
  hay = hay.replace(/ohne\s+[a-zäöüß-]+/g, " pflanzlich ");
  return hay;
}

function containsMarker(hay: string, markers: readonly string[]): boolean {
  return markers.some((mk) => {
    if (mk === "ei" || mk === "eier") {
      return /(^|[^a-zäöüß])ei(er)?([^a-zäöüß]|$)/.test(hay);
    }
    if (mk === "hack") {
      // "gehackt"/"gehackte Mandeln" ist kein Hackfleisch.
      return /(^|[^a-zäöüß])hack(fleisch|braten)?([^a-zäöüß]|$)/.test(hay);
    }
    return hay.includes(mk);
  });
}

/**
 * Bestimmt die Ernährungsform-Klasse eines Gerichts aus Inhalt + Tags.
 * Inhalt schlägt Tag: ein als "vegan" getaggtes Gericht mit Käse ist
 * vegetarisch, nicht vegan.
 */
export function classifyMealDiet(m: MealDietInput): MealDietClass {
  const hay = haystack(m);
  if (containsMarker(hay, MEAT_MARKERS)) return "omnivore";
  if (containsMarker(hay, FISH_MARKERS)) return "pescetarian";
  if (containsMarker(hay, DAIRY_EGG_MARKERS)) return "vegetarian";

  const tags = (m.tags ?? []).map((t) => (t ?? "").toLowerCase());
  if (tags.includes("vegan")) return "vegan";
  if (tags.includes("vegetarisch") || tags.includes("vegetarian")) return "vegetarian";
  // Ohne Marker und ohne eindeutigen Tag konservativ als vegetarisch werten.
  return "vegetarian";
}

const COMPAT: Record<MealDietClass, MealDietClass[]> = {
  vegan: ["vegan", "vegetarian", "pescetarian", "omnivore"],
  vegetarian: ["vegetarian", "pescetarian", "omnivore"],
  pescetarian: ["pescetarian", "omnivore"],
  omnivore: ["omnivore"],
};

/** Ist die Gerichtsklasse mit der Ernährungsform des Kunden kompatibel? */
export function isDietClassCompatible(
  mealClass: MealDietClass,
  diet: DietStyle | null | undefined,
): boolean {
  if (!diet || diet === "omnivore" || diet === "flexitarian" || diet === "other") {
    return true;
  }
  return COMPAT[mealClass].includes(diet);
}

/** Convenience: Gericht + roher Profilwert. */
export function isMealCompatibleWithDiet(
  meal: MealDietInput,
  rawDiet: string | null | undefined,
): boolean {
  return isDietClassCompatible(classifyMealDiet(meal), normalizeDietStyle(rawDiet));
}
