/**
 * Zentrale Logik der BodyFuel-Lebensmittelsuche.
 *
 * Ziele:
 *  - Robuste Normalisierung (Groß/Klein, Umlaute, Bindestriche, Sonderzeichen)
 *  - Deutsche Plural-/Singularformen und Synonyme (Ei/Eier/Vollei/Spiegelei …)
 *  - Tippfehlertoleranz (Levenshtein ≤ 1 bzw. ≤ 2 bei langen Wörtern)
 *  - Ranking: exakte und generische Treffer vor Marken-/Zufallstreffern
 *
 * Rein funktional und frei von DB/React-Abhängigkeiten, damit sie sowohl in
 * Server-Functions als auch in Tests genutzt werden kann.
 */

export function normalizeFoodTerm(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function compactFoodTerm(value: string): string {
  return normalizeFoodTerm(value).replace(/\s+/g, "");
}

/**
 * Synonymgruppen: jeder Begriff einer Gruppe zieht die gesamte Gruppe als
 * Suchvarianten nach sich. Alle Einträge sind bereits normalisiert (ae/oe/ue/ss).
 */
export const FOOD_SYNONYM_GROUPS: string[][] = [
  ["ei", "eier", "vollei", "huehnerei", "huehnereier", "frischei", "eiklar", "eigelb"],
  ["spiegelei", "spiegeleier", "ei gebraten", "ei"],
  ["ruehrei", "ruehreier", "scrambled eggs", "ei"],
  ["eiklar", "eiweiss", "egg white", "ei"],
  ["eigelb", "eidotter", "dotter", "ei"],
  ["haferflocken", "hafer", "oats", "porridge", "haferbrei", "haferkleie"],
  ["huehnchen", "haehnchen", "haehnchenbrust", "chicken", "poulet", "haehnchenfilet"],
  ["rind", "rindfleisch", "beef", "hackfleisch rind"],
  ["schwein", "schweinefleisch", "pork"],
  ["pute", "truthahn", "putenbrust", "turkey"],
  ["kartoffel", "kartoffeln", "erdaepfel", "potato"],
  ["reis", "rice"],
  ["nudeln", "pasta", "spaghetti", "penne"],
  ["quark", "magerquark", "speisequark"],
  ["joghurt", "jogurt", "yoghurt", "yogurt"],
  ["milch", "vollmilch", "kuhmilch", "milk"],
  ["kaese", "kaese scheibe", "cheese"],
  ["brot", "brote", "vollkornbrot", "bread"],
  ["broetchen", "semmel", "schrippe"],
  ["apfel", "aepfel", "apple"],
  ["banane", "bananen", "banana"],
  ["tomate", "tomaten", "tomato"],
  ["gurke", "gurken", "salatgurke"],
  ["zwiebel", "zwiebeln", "onion"],
  ["moehre", "moehren", "karotte", "karotten", "carrot"],
  ["paprika", "paprikaschote", "paprikaschoten"],
  ["lachs", "salmon"],
  ["thunfisch", "tuna"],
  ["mandel", "mandeln", "almond", "almonds"],
  ["walnuss", "walnuesse"],
  ["haselnuss", "haselnuesse"],
  ["erdnuss", "erdnuesse", "peanut", "erdnussbutter"],
  ["linsen", "linse", "lentils"],
  ["bohnen", "bohne", "beans", "kidneybohnen"],
  ["kichererbsen", "kichererbse", "chickpeas"],
  ["whey", "whey protein", "proteinpulver", "eiweisspulver", "protein pulver"],
  ["olivenoel", "olive oel", "olive oil"],
  ["butter", "suessrahmbutter"],
  ["honig", "honey"],
  ["zucker", "haushaltszucker"],
];

const SYNONYM_INDEX: Map<string, Set<string>> = (() => {
  const index = new Map<string, Set<string>>();
  for (const group of FOOD_SYNONYM_GROUPS) {
    const normalized = group.map(normalizeFoodTerm).filter(Boolean);
    for (const term of normalized) {
      const bucket = index.get(term) ?? new Set<string>();
      normalized.forEach((other) => bucket.add(other));
      index.set(term, bucket);
    }
  }
  return index;
})();

/** Sehr einfache deutsche Singularbildung für Lebensmittelbegriffe. */
export function singularizeGermanToken(token: string): string[] {
  const forms = new Set<string>();
  const t = token;
  if (t.length < 3) return [];
  const suffixes: Array<[RegExp, string]> = [
    [/(.+)nen$/, "$1"],
    [/(.+)er$/, "$1"],
    [/(.+)en$/, "$1"],
    [/(.+)e$/, "$1"],
    [/(.+)n$/, "$1"],
    [/(.+)s$/, "$1"],
  ];
  for (const [pattern, replacement] of suffixes) {
    if (pattern.test(t)) {
      const candidate = t.replace(pattern, replacement);
      if (candidate.length >= 2) forms.add(candidate);
    }
  }
  return [...forms];
}

/** Plural-Kandidaten (damit "Ei" auch "Eier" findet). */
export function pluralizeGermanToken(token: string): string[] {
  if (token.length < 2) return [];
  return [`${token}e`, `${token}en`, `${token}er`, `${token}n`, `${token}s`];
}

/**
 * Erzeugt Suchvarianten (inkl. Original) für eine Nutzereingabe.
 * Die Liste ist deterministisch sortiert: Originalbegriff zuerst.
 */
export function expandFoodQuery(query: string, maxVariants = 24): string[] {
  const raw = normalizeFoodTerm(query);
  if (!raw) return [];

  const variants = new Set<string>([raw]);
  const tokens = raw.split(/\s+/).filter(Boolean);

  // Ganze Phrase als Synonym (z. B. "ei gebraten")
  SYNONYM_INDEX.get(raw)?.forEach((term) => variants.add(term));

  if (tokens.length === 1) {
    const token = tokens[0];
    const candidates = new Set<string>([token]);
    singularizeGermanToken(token).forEach((form) => candidates.add(form));
    pluralizeGermanToken(token).forEach((form) => candidates.add(form));

    for (const candidate of [...candidates]) {
      variants.add(candidate);
      SYNONYM_INDEX.get(candidate)?.forEach((term) => variants.add(term));
    }
  } else {
    // Mehrwortsuche: jedes Token einzeln normalisieren, Synonyme der Tokens ergänzen
    for (const token of tokens) {
      SYNONYM_INDEX.get(token)?.forEach((term) => variants.add(term));
      singularizeGermanToken(token).forEach((form) => {
        if (SYNONYM_INDEX.has(form)) variants.add(form);
      });
    }
  }

  const ordered = [raw, ...[...variants].filter((v) => v !== raw).sort()];
  return ordered.filter(Boolean).slice(0, maxVariants);
}

/** Levenshtein-Distanz mit früher Abbruchgrenze. */
export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

/** Tippfehlertoleranz: 1 Fehler ab 4 Zeichen, 2 Fehler ab 8 Zeichen. */
export function isTypoMatch(candidate: string, term: string): boolean {
  const a = compactFoodTerm(candidate);
  const b = compactFoodTerm(term);
  if (!a || !b) return false;
  const budget = b.length >= 8 ? 2 : b.length >= 4 ? 1 : 0;
  if (budget === 0) return a === b;
  return levenshtein(a, b, budget) <= budget;
}

export type RankableFood = {
  name: string;
  aliases?: string[] | null;
  brand?: string | null;
  source?: string | null;
  verified_by_coach?: boolean | null;
  protein_per_100g?: number | null;
  carbs_per_100g?: number | null;
  fat_per_100g?: number | null;
  kcal_per_100g?: number | null;
};

const SOURCE_PRIORITY: Record<string, number> = {
  bodyfuel_verified: 0,
  bls_4_0: 1,
  usda: 2,
  open_food_facts: 3,
  manual: 4,
  barcode: 4,
  ai_estimate: 9,
};

export function foodSourcePriority(source: string | null | undefined): number {
  return SOURCE_PRIORITY[source ?? ""] ?? 5;
}

/**
 * Relevanzscore eines Treffers. Höher = besser.
 * Exakte Namenstreffer und generische (markenlose) Grundlebensmittel gewinnen.
 */
/** Wortgrenzen-Treffer: verhindert, dass "ei" in "Eisbergsalat" zählt. */
function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(haystack);
}

function startsWithWord(haystack: string, needle: string): boolean {
  return haystack === needle || haystack.startsWith(`${needle} `);
}

export function scoreFoodMatch(food: RankableFood, query: string): number {
  const term = normalizeFoodTerm(query);
  const variants = expandFoodQuery(query);
  const name = normalizeFoodTerm(food.name);
  // Klammerzusätze wie "(roh)" für den Vergleich ausblenden
  const bareName = normalizeFoodTerm(String(food.name).replace(/\([^)]*\)/g, ""));
  const nameTokens = name.split(/\s+/).filter(Boolean);
  const tokenSet = new Set(nameTokens);

  let score = 0;
  if (name === term || bareName === term) score += 120;
  else if (variants.some((v) => bareName === v || name === v)) score += 100;
  else if (startsWithWord(name, term) || startsWithWord(bareName, term)) score += 80;
  else if (tokenSet.has(term)) score += 60;
  else if (variants.some((v) => startsWithWord(name, v) || startsWithWord(bareName, v))) score += 50;
  else if (variants.some((v) => tokenSet.has(v))) score += 45;
  else if (containsWord(name, term)) score += 30;
  else if (variants.some((v) => containsWord(name, v))) score += 20;
  else if (nameTokens.some((token) => isTypoMatch(token, term))) score += 25;
  else if (name.includes(term) && term.length >= 5) score += 10;
  else if (
    (food.aliases ?? []).some((alias) => {
      const a = normalizeFoodTerm(String(alias ?? ""));
      return a !== "" && (a === term || variants.some((v) => a === v));
    })
  )
    score += 40;
  else {
    // Markensuche: "Milbona", "Aldi Haferflocken" o. Ä. treffen über die Marke.
    const brand = normalizeFoodTerm(String(food.brand ?? ""));
    const brandTokens = new Set(brand.split(/\s+/).filter(Boolean));
    const termTokens = term.split(/\s+/).filter(Boolean);
    const brandHit =
      brand !== "" &&
      (brand === term ||
        brandTokens.has(term) ||
        termTokens.some((t) => brandTokens.has(t) || (t.length >= 4 && brand.includes(t))));
    if (!brandHit) return -100; // kein sinnvoller Bezug zur Suche
    // Restliche Suchtokens müssen zumindest im Namen auftauchen.
    const rest = termTokens.filter((t) => !brandTokens.has(t) && !brand.includes(t));
    if (rest.length && !rest.every((t) => name.includes(t))) return -100;
    score += brand === term ? 70 : 45;
  }


  // Quellenqualität
  score += Math.max(0, 24 - foodSourcePriority(food.source) * 6);
  if (food.verified_by_coach) score += 10;

  // Generische Grundlebensmittel vor Markenprodukten
  if (!food.brand) score += 12;
  else score -= 6;

  // Kürzere, generischere Namen bevorzugen
  score -= Math.min(18, Math.max(0, name.length - term.length) / 3);

  return score;
}


export function rankFoodResults<T extends RankableFood>(results: T[], query: string): T[] {
  const scored = [...results]
    .map((food, index) => ({ food, index, score: scoreFoodMatch(food, query) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  // Substring-Rauschen (z.B. "Eisbergsalat" bei "Ei") ausblenden — außer es bleibt sonst nichts übrig.
  const relevant = scored.filter((entry) => entry.score > -100);
  return (relevant.length > 0 ? relevant : scored).map((entry) => entry.food);
}
