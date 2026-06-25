// Server-only helper for generating shopping lists from a plan's meals.
// Imported by server functions, NOT by client code.
//
// IMPORTANT: Uses the admin client internally so partner plans work too.
// Callers are responsible for authorizing access before invoking these
// helpers (i.e. the calling server function has already checked the user
// owns / is coach for / is partner of the affected plans).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ShoppingItem = { name: string; quantity: string; category: string; checked?: boolean };

type Unit = "g" | "ml" | "Stück" | "Scheiben" | "EL" | "TL" | "Prise" | "Bund" | "Vorrat";
type Quantity = { amount: number; unit: Unit; estimated?: boolean };
type IngredientRule = {
  key: string;
  display: string;
  category: string;
  preferredUnit?: Unit;
  pieceGram?: number;
  sliceGram?: number;
  tablespoonGram?: number;
  teaspoonGram?: number;
  tablespoonMl?: number;
  teaspoonMl?: number;
  cookedToRawFactor?: number;
  spice?: boolean;
  pantry?: boolean;
};

const CATEGORY_ORDER = [
  "Obst & Gemüse",
  "Fleisch & Fisch",
  "Eier & Milchprodukte",
  "Getreide & Beilagen",
  "Vorrat & Gewürze",
  "Getränke",
  "Sonstiges",
];

const INGREDIENT_RULES: Array<[RegExp, IngredientRule]> = [
  [/^paprikapulver\b.*/, { key: "paprikapulver", display: "Paprikapulver", category: "Vorrat & Gewürze", spice: true }],
  [/^(salz|meersalz)\b.*/, { key: "salz", display: "Salz", category: "Vorrat & Gewürze", spice: true }],
  [/^(pfeffer|schwarzer\s+pfeffer)\b.*/, { key: "pfeffer", display: "Pfeffer", category: "Vorrat & Gewürze", spice: true }],
  [/^zimt\b.*/, { key: "zimt", display: "Zimt", category: "Vorrat & Gewürze", spice: true, teaspoonGram: 2.5 }],
  [/^(petersilie|schnittlauch|basilikum|koriander|dill)\b.*/, { key: "kräuter", display: "Frische Kräuter", category: "Obst & Gemüse", preferredUnit: "Bund" }],
  [/^skyr\b.*/, { key: "skyr", display: "Skyr", category: "Eier & Milchprodukte", tablespoonGram: 15, teaspoonGram: 5 }],
  [/^magerquark\b.*/, { key: "magerquark", display: "Magerquark", category: "Eier & Milchprodukte", tablespoonGram: 15, teaspoonGram: 5 }],
  [/^(griechischer\s+)?joghurt\b.*/, { key: "griechischer joghurt", display: "Griechischer Joghurt", category: "Eier & Milchprodukte", tablespoonGram: 15, teaspoonGram: 5 }],
  [/^(hütten|huetten|körniger\s+frisch)?käse\b.*/, { key: "käse", display: "Käse", category: "Eier & Milchprodukte", tablespoonGram: 10, teaspoonGram: 4 }],
  [/^hüttenkäse\b.*/, { key: "hüttenkäse", display: "Hüttenkäse", category: "Eier & Milchprodukte", tablespoonGram: 15, teaspoonGram: 5 }],
  [/^feta\b.*/, { key: "feta", display: "Feta", category: "Eier & Milchprodukte", tablespoonGram: 10, teaspoonGram: 4 }],
  [/^mozzarella\b.*/, { key: "mozzarella", display: "Mozzarella", category: "Eier & Milchprodukte" }],
  [/^parmesan\b.*/, { key: "parmesan", display: "Parmesan", category: "Eier & Milchprodukte", tablespoonGram: 8, teaspoonGram: 3 }],
  [/^proteinpudding\b.*/, { key: "proteinpudding", display: "Proteinpudding", category: "Eier & Milchprodukte" }],
  [/^(protein(shake|pulver|riegel)?|whey)\b.*/, { key: "proteinpulver", display: "Proteinpulver", category: "Vorrat & Gewürze" }],
  [/^(milch|kuhmilch)\b.*/, { key: "milch", display: "Milch", category: "Eier & Milchprodukte", tablespoonMl: 15, teaspoonMl: 5 }],
  [/^hafermilch\b.*/, { key: "hafermilch", display: "Hafermilch", category: "Eier & Milchprodukte", tablespoonMl: 15, teaspoonMl: 5 }],
  [/^mandelmilch\b.*/, { key: "mandelmilch", display: "Mandelmilch", category: "Eier & Milchprodukte", tablespoonMl: 15, teaspoonMl: 5 }],
  [/^(ei|eier|eiklar|eiweiß)\b.*/, { key: "eier", display: "Eier", category: "Eier & Milchprodukte", preferredUnit: "Stück", pieceGram: 60 }],
  [/^(hähnchen|haehnchen)(brust)?(filet)?\b.*/, { key: "hähnchenbrust", display: "Hähnchenbrust", category: "Fleisch & Fisch" }],
  [/^pute(nbrust|nfilet|nstreifen)?\b.*/, { key: "putenbrust", display: "Putenbrust", category: "Fleisch & Fisch" }],
  [/^((rinder|puten|hähnchen|haehnchen)?hack(fleisch)?|hackfleisch)\b.*/, { key: "putenhack", display: "Putenhack", category: "Fleisch & Fisch" }],
  [/^lachs(filet)?\b.*/, { key: "lachs", display: "Lachs", category: "Fleisch & Fisch" }],
  [/^thunfisch\b.*/, { key: "thunfisch", display: "Thunfisch", category: "Fleisch & Fisch" }],
  [/^garnelen\b.*/, { key: "garnelen", display: "Garnelen", category: "Fleisch & Fisch" }],
  [/^(basmati|jasmin)?reis\b.*/, { key: "reis", display: "Reis", category: "Getreide & Beilagen", cookedToRawFactor: 0.35 }],
  [/^(vollkorn)?nudeln?\b.*/, { key: "nudeln", display: "Nudeln", category: "Getreide & Beilagen", cookedToRawFactor: 0.45 }],
  [/^(spaghetti|penne|fusilli)\b.*/, { key: "nudeln", display: "Nudeln", category: "Getreide & Beilagen", cookedToRawFactor: 0.45 }],
  [/^kartoffeln?\b.*/, { key: "kartoffeln", display: "Kartoffeln", category: "Obst & Gemüse" }],
  [/^(süßkartoffeln?|suesskartoffeln?)\b.*/, { key: "süßkartoffeln", display: "Süßkartoffeln", category: "Obst & Gemüse" }],
  [/^haferflocken\b.*/, { key: "haferflocken", display: "Haferflocken", category: "Getreide & Beilagen" }],
  [/^(müsli|muesli)\b.*/, { key: "müsli", display: "Müsli", category: "Getreide & Beilagen" }],
  [/^(vollkorn[-\s]*)?tortillas?\b.*/, { key: "vollkorn-tortillas", display: "Vollkorn-Tortillas", category: "Getreide & Beilagen", preferredUnit: "Stück", pieceGram: 60 }],
  [/^wraps?\b.*/, { key: "wraps", display: "Wraps", category: "Getreide & Beilagen", preferredUnit: "Stück", pieceGram: 60 }],
  [/^vollkornbrot\b.*/, { key: "vollkornbrot", display: "Vollkornbrot", category: "Getreide & Beilagen", preferredUnit: "Scheiben", sliceGram: 45 }],
  [/^(eiweiß|protein)brot\b.*/, { key: "eiweißbrot", display: "Eiweißbrot", category: "Getreide & Beilagen", preferredUnit: "Scheiben", sliceGram: 45 }],
  [/^reiswaffeln?\b.*/, { key: "reiswaffeln", display: "Reiswaffeln", category: "Getreide & Beilagen", preferredUnit: "Stück" }],
  [/^couscous\b.*/, { key: "couscous", display: "Couscous", category: "Getreide & Beilagen", cookedToRawFactor: 0.45 }],
  [/^quinoa\b.*/, { key: "quinoa", display: "Quinoa", category: "Getreide & Beilagen", cookedToRawFactor: 0.35 }],
  [/^linsen\b.*/, { key: "linsen", display: "Linsen", category: "Getreide & Beilagen" }],
  [/^kichererbsen\b.*/, { key: "kichererbsen", display: "Kichererbsen", category: "Getreide & Beilagen" }],
  [/^bohnen\b.*/, { key: "bohnen", display: "Bohnen", category: "Getreide & Beilagen" }],
  [/^bananen?\b.*/, { key: "bananen", display: "Bananen", category: "Obst & Gemüse", preferredUnit: "Stück", pieceGram: 120 }],
  [/^[äa]pfel\b.*/, { key: "äpfel", display: "Äpfel", category: "Obst & Gemüse", preferredUnit: "Stück", pieceGram: 180 }],
  [/^heidelbeeren?\b.*/, { key: "heidelbeeren", display: "Heidelbeeren", category: "Obst & Gemüse" }],
  [/^erdbeeren?\b.*/, { key: "erdbeeren", display: "Erdbeeren", category: "Obst & Gemüse" }],
  [/^himbeeren?\b.*/, { key: "himbeeren", display: "Himbeeren", category: "Obst & Gemüse" }],
  [/^beeren\b.*/, { key: "beeren", display: "Beeren", category: "Obst & Gemüse" }],
  [/^brokkoli\b.*/, { key: "brokkoli", display: "Brokkoli", category: "Obst & Gemüse" }],
  [/^blumenkohl\b.*/, { key: "blumenkohl", display: "Blumenkohl", category: "Obst & Gemüse" }],
  [/^(karotten?|möhren?|moehren?)\b.*/, { key: "karotten", display: "Karotten", category: "Obst & Gemüse" }],
  [/^paprikaschoten?\b.*/, { key: "paprika", display: "Paprika", category: "Obst & Gemüse", pieceGram: 150 }],
  [/^paprika\b.*/, { key: "paprika", display: "Paprika", category: "Obst & Gemüse", pieceGram: 150 }],
  [/^kirschtomaten?\b.*/, { key: "kirschtomaten", display: "Kirschtomaten", category: "Obst & Gemüse" }],
  [/^tomaten?\b.*/, { key: "tomaten", display: "Tomaten", category: "Obst & Gemüse" }],
  [/^(salatgurken?|gurken?)\b.*/, { key: "gurke", display: "Gurke", category: "Obst & Gemüse", preferredUnit: "Stück", pieceGram: 300 }],
  [/^zucchini\b.*/, { key: "zucchini", display: "Zucchini", category: "Obst & Gemüse", pieceGram: 200 }],
  [/^spinat\b.*/, { key: "spinat", display: "Spinat", category: "Obst & Gemüse" }],
  [/^erbsen\b.*/, { key: "erbsen", display: "Erbsen", category: "Obst & Gemüse" }],
  [/^salat\b.*/, { key: "salat", display: "Salat", category: "Obst & Gemüse" }],
  [/^avocados?\b.*/, { key: "avocado", display: "Avocado", category: "Obst & Gemüse", preferredUnit: "Stück", pieceGram: 180 }],
  [/^zwiebeln?\b.*/, { key: "zwiebeln", display: "Zwiebeln", category: "Obst & Gemüse" }],
  [/^knoblauch\b.*/, { key: "knoblauch", display: "Knoblauch", category: "Obst & Gemüse" }],
  [/^aubergine\b.*/, { key: "aubergine", display: "Aubergine", category: "Obst & Gemüse" }],
  [/^spargel\b.*/, { key: "spargel", display: "Spargel", category: "Obst & Gemüse" }],
  [/^(oliven[öo]l|olivenöl)\b.*/, { key: "olivenöl", display: "Olivenöl", category: "Vorrat & Gewürze", tablespoonMl: 15, teaspoonMl: 5 }],
  [/^rapsöl\b.*/, { key: "rapsöl", display: "Rapsöl", category: "Vorrat & Gewürze", tablespoonMl: 15, teaspoonMl: 5 }],
  [/^kokos[öo]l\b.*/, { key: "kokosöl", display: "Kokosöl", category: "Vorrat & Gewürze", tablespoonGram: 13, teaspoonGram: 4 }],
  [/^butter\b.*/, { key: "butter", display: "Butter", category: "Vorrat & Gewürze", tablespoonGram: 12, teaspoonGram: 4 }],
  [/^honig\b.*/, { key: "honig", display: "Honig", category: "Vorrat & Gewürze", tablespoonGram: 20, teaspoonGram: 7 }],
  [/^ahornsirup\b.*/, { key: "ahornsirup", display: "Ahornsirup", category: "Vorrat & Gewürze", tablespoonGram: 20, teaspoonGram: 7 }],
  [/^(mandeln?|walnüsse|walnuesse|walnuss|cashews?|erdnüsse|erdnuesse|erdnuss)\b.*/, { key: "nüsse", display: "Nüsse", category: "Vorrat & Gewürze", tablespoonGram: 10, teaspoonGram: 4 }],
  [/^(leinsamen|chia|chiasamen|sesam|sonnenblumenkerne|kürbiskerne)\b.*/, { key: "samen", display: "Samen & Kerne", category: "Vorrat & Gewürze", tablespoonGram: 10, teaspoonGram: 3 }],
  [/^(erdnuss|mandel)mus\b.*/, { key: "nussmus", display: "Nussmus", category: "Vorrat & Gewürze", tablespoonGram: 15, teaspoonGram: 5 }],
  [/^pesto\b.*/, { key: "pesto", display: "Pesto", category: "Vorrat & Gewürze", tablespoonGram: 15, teaspoonGram: 5 }],
  [/^senf\b.*/, { key: "senf", display: "Senf", category: "Vorrat & Gewürze", tablespoonGram: 15, teaspoonGram: 5 }],
  [/^ketchup\b.*/, { key: "ketchup", display: "Ketchup", category: "Vorrat & Gewürze", tablespoonGram: 15, teaspoonGram: 5 }],
  [/^(mineralwasser|flaschenwasser)\b.*/, { key: "mineralwasser", display: "Mineralwasser", category: "Getränke", tablespoonMl: 15, teaspoonMl: 5 }],
];

function titleCase(s: string) {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase("de-DE") + s.slice(1);
}

function normalizeFractionText(text: string) {
  return text
    .replace(/½/g, "1/2")
    .replace(/¼/g, "1/4")
    .replace(/¾/g, "3/4")
    .replace(/⅓/g, "1/3")
    .replace(/⅔/g, "2/3")
    .replace(/(^|\s)\/(\d+)\b/g, "$11/$2");
}

function compactText(text: string) {
  return normalizeFractionText(String(text ?? ""))
    .replace(/[–—]/g, " — ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripNonIngredientNotes(text: string) {
  let t = compactText(text)
    .replace(/^[-•·]\s*/, "")
    .replace(/\boptional\b/gi, "")
    .replace(/\b(nach\s+geschmack|nach\s+belieben)\b.*$/gi, "")
    .replace(/\b(ca\.|circa)\b/gi, "")
    .replace(/\s+als\s+(dip|topping|beilage|snack|garnitur)\b.*$/gi, "")
    .replace(/\s+(zum|zur)\s+(servieren|garnieren|abschmecken)\b.*$/gi, "")
    .replace(/\s*\([^)]*(gekocht|gegart|roh|optional|nach\s+geschmack)[^)]*\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  t = t.replace(/^für\s+(dressing|sauce|soße|sosse|marinade|topping|füllung|fuellung)\s*:?\s*/i, "");
  return t.trim();
}

function isNonIngredientText(text: string) {
  const t = compactText(text).toLowerCase();
  if (!t || !/[a-zäöüß]/i.test(t)) return true;
  if (/^für\s+.+\s+—\s+insgesamt\b/i.test(text)) return true;
  if (/^für\s+(?!dressing|sauce|soße|sosse|marinade|topping|füllung|fuellung)\b/i.test(text)) return true;
  if (/^für\s+[a-zäöüß]+\s+[a-zäöüß]+\b.*\binsgesamt\b/i.test(text)) return true;
  if (/\binsgesamt\s+\d+(?:[,.]\d+)?\s*(g|kg|ml|l)\b/i.test(text) && /^für\b/i.test(text)) return true;
  if (/^(portion(en)?|person(en)?|ergibt|rezept|hinweis|notiz|zubereitung|gesamt|summe)\b/i.test(text)) return true;
  if (/\b(servieren|vermengen|anbraten|braten|kochen|backen|garen|abschmecken)\b/i.test(text)) return true;
  return false;
}

function parseNumberToken(token: string): number | null {
  const t = token.trim().toLowerCase().replace(",", ".");
  if (/^\d+\s*\/\s*\d+$/.test(t)) {
    const [a, b] = t.split("/").map((x) => Number(x.trim()));
    return b ? a / b : null;
  }
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
  if (/^(ein|eine|einen|einem|einer)$/.test(t)) return 1;
  if (/^(halbe|halber|halbes|halb)$/.test(t)) return 0.5;
  return null;
}

function normalizeUnit(unit: string | undefined): Unit | null {
  const u = (unit ?? "").trim().toLowerCase();
  if (!u) return null;
  if (/^(kg|kilogramm)$/.test(u)) return "g";
  if (/^(g|gramm)$/.test(u)) return "g";
  if (/^(l|liter)$/.test(u)) return "ml";
  if (/^(ml|milliliter)$/.test(u)) return "ml";
  if (/^(el|esslöffel|essloeffel)$/.test(u)) return "EL";
  if (/^(tl|teelöffel|teeloeffel)$/.test(u)) return "TL";
  if (/^prisen?$/.test(u)) return "Prise";
  if (/^scheiben?$/.test(u)) return "Scheiben";
  if (/^(stück|stueck|stk\.?|ei|eier)$/.test(u)) return "Stück";
  if (/^bund$/.test(u)) return "Bund";
  return null;
}

function parseQuantityText(text: string): Quantity | null {
  const q = compactText(text).replace(/^(ca\.|circa)\s+/i, "");
  const m = q.match(/^(\d+\s*\/\s*\d+|\d+(?:[,.]\d+)?|ein(?:e|en|em|er)?|halb(?:e|er|es)?)\s*(kg|kilogramm|g|gramm|ml|milliliter|l|liter|el|esslöffel|essloeffel|tl|teelöffel|teeloeffel|prisen?|scheiben?|stück|stueck|stk\.?|bund|eier?|ei)?\b/i);
  if (!m) return null;
  const amount = parseNumberToken(m[1]);
  const unit = normalizeUnit(m[2]);
  if (amount == null) return null;
  let normalizedAmount = amount;
  let normalizedUnit = unit ?? "Stück";
  if (/^kg$/i.test(m[2] ?? "")) normalizedAmount *= 1000;
  if (/^l$/i.test(m[2] ?? "")) normalizedAmount *= 1000;
  return { amount: normalizedAmount, unit: normalizedUnit };
}

function parseQuantityList(text: string): Quantity[] {
  return compactText(text)
    .split(/\s*\+\s*|\s*;\s*/)
    .map((part) => parseQuantityText(part))
    .filter((q): q is Quantity => !!q);
}

function takeQuantityFromText(text: string): { name: string; quantity: Quantity | null; cooked: boolean; rawHadSlice: boolean; rawHadPinch: boolean } {
  let t = stripNonIngredientNotes(text).replace(/^ekochtes\s+ei\b/i, "Gekochtes Ei");
  const cooked = /\b(gekocht|gekochte|gekochter|gekochtes|gegart|gegarte|gegarter|gegartes)\b/i.test(t);
  const rawHadSlice = /^\s*(\d+\s*\/\s*\d+|\d+(?:[,.]\d+)?|ein(?:e|en|em|er)?|halb(?:e|er|es)?)?\s*scheiben?\b/i.test(t);
  const rawHadPinch = /^\s*(\d+\s*\/\s*\d+|\d+(?:[,.]\d+)?|ein(?:e|en|em|er)?)?\s*prisen?\b/i.test(t);

  const colon = t.match(/^(.+?):\s*(\d+\s*\/\s*\d+|\d+(?:[,.]\d+)?)\s*(kg|g|ml|l|el|tl|scheiben?|stück|stk\.?)?$/i);
  if (colon) t = `${colon[2]} ${colon[3] ?? "g"} ${colon[1]}`;

  const start = t.match(/^(\d+\s*\/\s*\d+|\d+(?:[,.]\d+)?|ein(?:e|en|em|er)?|halb(?:e|er|es)?)\s*(kg|kilogramm|g|gramm|ml|milliliter|l|liter|el|esslöffel|essloeffel|tl|teelöffel|teeloeffel|prisen?|scheiben?|stück|stueck|stk\.?|bund|eier?|ei)?\b\s*(.*)$/i);
  if (start) {
    const amount = parseNumberToken(start[1]);
    const unit = normalizeUnit(start[2]);
    if (amount != null) {
      let normalizedAmount = amount;
      if (/^kg$/i.test(start[2] ?? "")) normalizedAmount *= 1000;
      if (/^l$/i.test(start[2] ?? "")) normalizedAmount *= 1000;
      return { name: start[3].trim(), quantity: { amount: normalizedAmount, unit: unit ?? "Stück" }, cooked, rawHadSlice, rawHadPinch };
    }
  }

  const unitOnly = t.match(/^(prisen?|scheiben?|bund)\s+(.+)$/i);
  if (unitOnly) {
    const unit = normalizeUnit(unitOnly[1]);
    return { name: unitOnly[2].trim(), quantity: unit ? { amount: 1, unit } : null, cooked, rawHadSlice, rawHadPinch };
  }

  const end = t.match(/^(.+?)\s+(\d+\s*\/\s*\d+|\d+(?:[,.]\d+)?)\s*(kg|g|ml|l|el|tl|prisen?|scheiben?|stück|stk\.?|bund|eier?|ei)$/i);
  if (end) {
    let amount = parseNumberToken(end[2]);
    const unit = normalizeUnit(end[3]);
    if (amount != null && unit) {
      if (/^kg$/i.test(end[3])) amount *= 1000;
      if (/^l$/i.test(end[3])) amount *= 1000;
      return { name: end[1].trim(), quantity: { amount, unit }, cooked, rawHadSlice, rawHadPinch };
    }
  }

  return { name: t, quantity: null, cooked, rawHadSlice, rawHadPinch };
}

function normalizeIngredientName(name: string) {
  return stripNonIngredientNotes(name)
    .replace(/^ekochtes\s+ei\b/i, "Gekochtes Ei")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\b(ungekocht|gekocht(?:e[rsn]?)?|gegart(?:e[rsn]?)?|gebraten(?:e[rsn]?)?|gedünstet(?:e[rsn]?)?|geduenstet(?:e[rsn]?)?|gegrillt(?:e[rsn]?)?|roh(?:e[rsn]?)?|trocken(?:e[rsn]?)?|frisch(?:e[rsn]?)?|tiefgekühlt|tiefgekuehlt|tk|light|fettarm|zuckerarm|mager(?:e[rsn]?)?|natur|pur|optional|gewürfelt|gewuerfelt|geschnitten|gerieben)\b/gi, " ")
    .replace(/\b(gehackt)\b/gi, " ")
    .replace(/^(eine?|ein|einen|einem|einer|der|die|das|etwas)\s+/i, "")
    .replace(/^(scheiben?|prisen?)\s+/i, "")
    .replace(/\s+für\s+.*$/i, "")
    .replace(/:\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalize(rawName: string): IngredientRule | null {
  let n = normalizeIngredientName(rawName);
  if (!n || isNonIngredientText(n)) return null;
  if (/^(wasser|leitungswasser|stilles\s+wasser|sprudelwasser)\b/i.test(n)) return null;
  if (/^(gehackt|gekocht|gegart|gebraten|gedünstet|geduenstet|gewürfelt|gewuerfelt|geschnitten|frisch|optional)$/i.test(n)) return null;
  n = n.replace(/\s*-\s*/g, "-").trim();
  const lower = n.toLowerCase();
  for (const [re, rule] of INGREDIENT_RULES) {
    if (re.test(lower)) return rule;
  }
  return { key: lower, display: titleCase(n), category: categoryFor(n) };
}

function normalizeQuantity(quantity: Quantity | null, rule: IngredientRule, opts: { cooked: boolean; rawHadSlice: boolean; rawHadPinch: boolean }): Quantity {
  let q = quantity ? { ...quantity } : null;
  if (!q) {
    if (rule.spice || rule.pantry) return { amount: 1, unit: "Vorrat" };
    if (rule.preferredUnit === "Bund") return { amount: 1, unit: "Bund" };
    return { amount: 1, unit: rule.preferredUnit ?? "Stück" };
  }

  if (rule.key === "eier") {
    if (q.unit === "g") q = { amount: Math.max(1, Math.round(q.amount / 60) || 1), unit: "Stück", estimated: true };
    else q.unit = "Stück";
    return q;
  }

  if (opts.rawHadSlice || rule.preferredUnit === "Scheiben") {
    if (q.unit === "g" && rule.sliceGram) return { amount: Math.max(1, Math.round(q.amount / rule.sliceGram)), unit: "Scheiben", estimated: true };
    if (q.unit === "Stück") q.unit = "Scheiben";
    return q;
  }

  if (rule.spice) {
    if (q.unit === "Stück") q.unit = opts.rawHadPinch ? "Prise" : "TL";
    if (q.unit === "EL") return { amount: q.amount * 3, unit: "TL" };
    return q;
  }

  if (rule.preferredUnit === "Bund") {
    if (q.unit === "Stück" || q.unit === "Prise") return { amount: 1, unit: "Bund" };
    return q;
  }

  if (q.unit === "EL" && rule.tablespoonGram) return { amount: q.amount * rule.tablespoonGram, unit: "g", estimated: true };
  if (q.unit === "TL" && rule.teaspoonGram) return { amount: q.amount * rule.teaspoonGram, unit: "g", estimated: true };
  if (q.unit === "EL" && rule.tablespoonMl) return { amount: q.amount * rule.tablespoonMl, unit: "ml", estimated: true };
  if (q.unit === "TL" && rule.teaspoonMl) return { amount: q.amount * rule.teaspoonMl, unit: "ml", estimated: true };

  if (opts.cooked && q.unit === "g" && rule.cookedToRawFactor) {
    return { amount: q.amount * rule.cookedToRawFactor, unit: "g", estimated: true };
  }

  if (rule.preferredUnit === "Stück" && q.unit === "g" && rule.pieceGram) {
    return { amount: Math.max(0.5, q.amount / rule.pieceGram), unit: "Stück", estimated: true };
  }
  if (rule.preferredUnit === "Stück" && q.unit !== "Stück" && !["g", "ml"].includes(q.unit)) {
    return { amount: q.amount, unit: "Stück", estimated: true };
  }
  return q;
}

function parseShoppingItem(source: ShoppingItem): { rule: IngredientRule; quantities: Quantity[]; checked: boolean } | null {
  const rawName = compactText(source.name);
  if (!rawName || isNonIngredientText(rawName)) return null;
  const inline = takeQuantityFromText(rawName);
  const quantitiesFromField = source.quantity ? parseQuantityList(source.quantity) : [];
  const rule = canonicalize(inline.name || rawName);
  if (!rule) return null;
  const rawQuantities = quantitiesFromField.length ? quantitiesFromField : [inline.quantity];
  const quantities = rawQuantities.map((quantity) =>
    normalizeQuantity(quantity, rule, {
      cooked: inline.cooked,
      rawHadSlice: inline.rawHadSlice,
      rawHadPinch: inline.rawHadPinch,
    }),
  );
  return { rule, quantities, checked: !!source.checked };
}

function addQuantity(map: Map<Unit, { amount: number; estimated: boolean }>, q: Quantity) {
  if (q.unit === "Vorrat" && map.size > 0) return;
  if (q.unit !== "Vorrat" && map.has("Vorrat")) map.delete("Vorrat");
  const existing = map.get(q.unit) ?? { amount: 0, estimated: false };
  map.set(q.unit, { amount: existing.amount + q.amount, estimated: existing.estimated || !!q.estimated });
}

function resolveMixedUnits(rule: IngredientRule, units: Map<Unit, { amount: number; estimated: boolean }>) {
  const g = units.get("g");
  const ml = units.get("ml");
  const pieces = units.get("Stück");
  const slices = units.get("Scheiben");
  const el = units.get("EL");
  const tl = units.get("TL");
  const pinches = units.get("Prise");

  if (pieces && g && rule.pieceGram) {
    if (rule.preferredUnit === "Stück") {
      units.set("Stück", { amount: pieces.amount + g.amount / rule.pieceGram, estimated: true });
      units.delete("g");
    } else {
      units.set("g", { amount: g.amount + pieces.amount * rule.pieceGram, estimated: true });
      units.delete("Stück");
    }
  }
  if (slices && g && rule.sliceGram) {
    units.set("Scheiben", { amount: slices.amount + g.amount / rule.sliceGram, estimated: true });
    units.delete("g");
  }
  if (el && tl) {
    units.set("EL", { amount: el.amount + tl.amount / 3, estimated: el.estimated || tl.estimated });
    units.delete("TL");
  }
  if (pinches && tl) {
    units.set("TL", { amount: tl.amount + pinches.amount * 0.25, estimated: true });
    units.delete("Prise");
  }
  if (ml && el) {
    units.set("ml", { amount: ml.amount + el.amount * 15, estimated: true });
    units.delete("EL");
  }
  if (ml && tl) {
    units.set("ml", { amount: ml.amount + tl.amount * 5, estimated: true });
    units.delete("TL");
  }
}

function formatAmount(n: number) {
  const rounded = Math.round(n * 10) / 10;
  if (Math.abs(rounded - 0.25) < 0.01) return "¼";
  if (Math.abs(rounded - 0.5) < 0.01) return "½";
  if (Math.abs(rounded - 0.75) < 0.01) return "¾";
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1).replace(".", ",");
}

function formatUnit(unit: Unit, amount: number) {
  if (unit === "Prise") return Math.abs(amount - 1) < 0.01 ? "Prise" : "Prisen";
  if (unit === "Scheiben") return Math.abs(amount - 1) < 0.01 ? "Scheibe" : "Scheiben";
  return unit;
}

function formatQuantities(rule: IngredientRule, units: Map<Unit, { amount: number; estimated: boolean }>) {
  resolveMixedUnits(rule, units);
  if (!units.size) return "Vorrat";
  const parts: string[] = [];
  const order: Unit[] = ["g", "ml", "Stück", "Scheiben", "Bund", "EL", "TL", "Prise", "Vorrat"];
  for (const unit of order) {
    const entry = units.get(unit);
    if (!entry) continue;
    if (unit === "Vorrat") {
      parts.push("Vorrat");
      continue;
    }
    let amount = entry.amount;
    let outUnit: Unit | "kg" | "l" = unit;
    if (unit === "g" && amount >= 1000) {
      amount /= 1000;
      outUnit = "kg";
    }
    if (unit === "ml" && amount >= 1000) {
      amount /= 1000;
      outUnit = "l";
    }
    const rounded = unit === "Stück" || unit === "Scheiben" || unit === "Bund" ? Math.round(amount * 2) / 2 : amount;
    parts.push(`${entry.estimated ? "ca. " : ""}${formatAmount(rounded)} ${formatUnit(outUnit as Unit, rounded)}`);
  }
  return parts.join(" + ");
}

export function normalizeShoppingListItems(items: ShoppingItem[]): ShoppingItem[] {
  const groups = new Map<
    string,
    { rule: IngredientRule; units: Map<Unit, { amount: number; estimated: boolean }>; checked: boolean }
  >();

  for (const source of items) {
    const parsed = parseShoppingItem(source);
    if (!parsed) continue;
    const group = groups.get(parsed.rule.key) ?? {
      rule: parsed.rule,
      units: new Map<Unit, { amount: number; estimated: boolean }>(),
      checked: false,
    };
    for (const quantity of parsed.quantities) addQuantity(group.units, quantity);
    group.checked = group.checked || parsed.checked;
    groups.set(parsed.rule.key, group);
  }

  const out = Array.from(groups.values()).map((group) => ({
    name: group.rule.display,
    quantity: formatQuantities(group.rule, group.units),
    category: group.rule.category || categoryFor(group.rule.display),
    checked: group.checked || undefined,
  }));

  out.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    const ra = ca === -1 ? 99 : ca;
    const rb = cb === -1 ? 99 : cb;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "de");
  });
  return out;
}

export function cleanShoppingItems(items: ShoppingItem[]): ShoppingItem[] {
  return normalizeShoppingListItems(items);
}

function categoryFor(name: string) {
  const n = name.toLowerCase();
  if (/hähnchen|pute|rind|hack|filet|fisch|lachs|thunfisch|garnelen/.test(n)) return "Fleisch & Fisch";
  if (/skyr|quark|joghurt|käse|feta|mozzarella|parmesan|proteinpudding|eier?|milch/.test(n)) return "Eier & Milchprodukte";
  if (/reis|nudel|couscous|quinoa|brot|tortilla|wrap|hafer|müsli|reiswaffel|linsen|kichererbsen|bohnen/.test(n)) return "Getreide & Beilagen";
  if (/salz|pfeffer|zimt|paprikapulver|öl|butter|nuss|nüss|mandel|cashew|walnuss|erdnuss|kern|samen|honig|sirup|pesto|senf|ketchup/.test(n)) return "Vorrat & Gewürze";
  if (/salat|gemüse|brokkoli|karotte|paprika|spargel|beeren|erdbeer|banane|apfel|äpfel|tomate|zucchini|gurke|spinat|erbse|kartoffel|zwiebel|knoblauch|avocado|aubergine|kräuter|petersilie/.test(n)) return "Obst & Gemüse";
  return "Sonstiges";
}

function splitIngredientParts(text: string) {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0 && !/\d/.test(text[i + 1] ?? "")) {
      parts.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function fallbackItemsFromLines(lines: string[]): ShoppingItem[] {
  const items: ShoppingItem[] = [];
  for (const line of lines) {
    const hasIngredientMarker = line.includes(" | Zutaten: ");
    const partsText = hasIngredientMarker ? line.split(" | Zutaten: ")[1] : line.includes(" | ") ? line.split(" | ")[1] : "";
    for (const rawPart of splitIngredientParts(partsText)) {
      const part = stripNonIngredientNotes(rawPart);
      if (!part || isNonIngredientText(part)) continue;
      const parsed = takeQuantityFromText(part);
      if (!hasIngredientMarker && !parsed.quantity) continue;
      if (!canonicalize(parsed.name)) continue;
      items.push({
        name: part,
        quantity: "",
        category: categoryFor(parsed.name),
      });
    }
  }
  return items;
}

function extractItems(parsed: any): ShoppingItem[] {
  const candidate = Array.isArray(parsed)
    ? parsed
    : (parsed?.items ?? parsed?.shopping_list ?? parsed?.einkaufsliste ?? parsed?.list ?? []);
  return (Array.isArray(candidate) ? candidate : [])
    .map((item: any) => {
      let name = String(item?.name ?? item?.ingredient ?? item?.zutat ?? "").trim();
      let quantity = String(item?.quantity ?? item?.amount ?? item?.menge ?? "").trim();
      const egg = name.match(/^(\d+)\s+eier?$/i);
      if (egg) {
        name = "Eier";
        quantity = `${egg[1]} Stück`;
      }
      return {
        name,
        quantity,
        category:
          String(item?.category ?? item?.kategorie ?? categoryFor(name)).trim() ||
          categoryFor(name),
      };
    })
    .filter((item) => item.name);
}

async function fetchMealLines(planId: string, windowDays: number): Promise<string[]> {
  const { data: days } = await supabaseAdmin
    .from("nutrition_plan_days")
    .select("id, sort_order")
    .eq("plan_id", planId)
    .order("sort_order");
  const dayIds = (days ?? []).slice(0, windowDays).map((d: any) => d.id);
  if (!dayIds.length) return [];
  const { data: meals } = await supabaseAdmin
    .from("nutrition_plan_meals")
    .select("day_id, name, description, recipe_ingredients, sort_order")
    .in("day_id", dayIds)
    .order("sort_order");
  const dayOrder = new Map(dayIds.map((id, index) => [id, index]));
  return (meals ?? [])
    .sort(
      (a: any, b: any) =>
        (dayOrder.get(a.day_id) ?? 0) - (dayOrder.get(b.day_id) ?? 0) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    .map((m: any) => {
      const ing = (m.recipe_ingredients ?? []).join(", ");
      return `- ${m.name}${ing ? " | Zutaten: " + ing : m.description ? " | " + m.description : ""}`;
    });
}

async function callAi(prompt: string, apiKey: string): Promise<ShoppingItem[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (res.status === 429) throw new Error("Rate-Limit erreicht");
  if (res.status === 402) throw new Error("Guthaben aufgebraucht");
  if (!res.ok) throw new Error(`Fehler [${res.status}]`);
  const raw = (await res.json())?.choices?.[0]?.message?.content ?? "{}";
  try {
    const clean =
      typeof raw === "string"
        ? raw
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/```$/i, "")
            .trim()
        : raw;
    const parsed = typeof clean === "string" ? JSON.parse(clean) : clean;
    return extractItems(parsed);
  } catch {
    return [];
  }
}

export async function generateShoppingListForPlan(opts: {
  /** Kept for API compatibility; engine uses the admin client internally. */
  supabase?: any;
  apiKey: string;
  planId: string;
  windowDays: number;
}): Promise<{ items: ShoppingItem[]; days: number }> {
  const { apiKey, planId, windowDays } = opts;

  const lines = await fetchMealLines(planId, windowDays);
  if (!lines.length) throw new Error("Plan enthält keine Mahlzeiten.");

  const prompt = `Du bist Ernährungsassistent. Erstelle aus den folgenden Mahlzeiten EINE konsolidierte Einkaufsliste für ${windowDays} Tage.

WICHTIG — Mengen sauber zusammenfassen:
- Identische Zutaten in EINER Zeile mit summierter Menge (nie 3× "250 g Hähnchen", sondern "750 g Hähnchen").
- Einheiten vereinheitlichen (g, kg, ml, l, Stück).
- Kategorien: Obst & Gemüse, Fleisch & Fisch, Eier & Milchprodukte, Getreide & Beilagen, Vorrat & Gewürze, Getränke, Sonstiges.

MAHLZEITEN:
${lines.join("\n")}

Antworte ausschließlich mit gültigem JSON:
{"items":[{"name":"Hähnchenbrust","quantity":"1.4 kg","category":"Fleisch & Fisch"}]}`;

  const parsedItems = fallbackItemsFromLines(lines);
  const items = normalizeShoppingListItems(parsedItems.length ? parsedItems : await callAi(prompt, apiKey));

  await supabaseAdmin.from("shopping_lists").upsert(
    {
      plan_id: planId,
      scope: "individual",
      items,
      days: windowDays,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "plan_id,scope" },
  );

  return { items, days: windowDays };
}

/** Combined shopping list summing two partner plans. Stored on BOTH plans with scope='partner_combined'. */
export async function generateCombinedShoppingList(opts: {
  supabase?: any;
  apiKey: string;
  planAId: string;
  planBId: string;
  userA: string;
  userB: string;
  windowDays: number;
  /** Optional: nur diese Slots gelten als gemeinsam (z. B. nur "dinner"). */
  sharedSlots?: Array<"breakfast" | "lunch" | "dinner" | "snack">;
}): Promise<{ items: ShoppingItem[]; days: number }> {
  const { apiKey, planAId, planBId, userA, userB, windowDays } = opts;

  const [linesA, linesB] = await Promise.all([
    fetchMealLines(planAId, windowDays),
    fetchMealLines(planBId, windowDays),
  ]);
  if (!linesA.length && !linesB.length) throw new Error("Keine Mahlzeiten für die Partnerpläne.");

  const mealsText = [
    "# Person A (eigene Mahlzeiten):",
    ...linesA,
    "",
    "# Person B (eigene Mahlzeiten):",
    ...linesB,
  ].join("\n");

  const prompt = `Du bist Ernährungsassistent. Erstelle aus den folgenden Mahlzeiten ZWEIER Partner eine EINZIGE gemeinsame Einkaufsliste für ${windowDays} Tage.

WICHTIG:
- Identische/ähnliche Zutaten beider Personen IN EINER Zeile zusammenfassen und Mengen ADDIEREN (z. B. 500 g + 900 g Hähnchen = 1.4 kg Hähnchenbrust).
- Gemeinsame Mahlzeiten (z. B. Abendessen) sind im Plan oft mit "Gemeinsam mit ..." markiert — Mengen so kalkulieren, dass beide Personen davon essen können (also für 2 Portionen, nicht doppelt).
- Einheiten vereinheitlichen (g, kg, ml, l, Stück).
- Kategorien: Obst & Gemüse, Fleisch & Fisch, Eier & Milchprodukte, Getreide & Beilagen, Vorrat & Gewürze, Getränke, Sonstiges.

MAHLZEITEN BEIDER PERSONEN:
${mealsText}

Antworte ausschließlich mit gültigem JSON:
{"items":[{"name":"Hähnchenbrust","quantity":"1.4 kg","category":"Fleisch & Fisch"}]}`;

  const parsedItems = fallbackItemsFromLines([...linesA, ...linesB]);
  const items = normalizeShoppingListItems(parsedItems.length ? parsedItems : await callAi(prompt, apiKey));

  const now = new Date().toISOString();
  await supabaseAdmin.from("shopping_lists").upsert(
    [
      {
        plan_id: planAId,
        scope: "partner_combined",
        partner_user_id: userB,
        items,
        days: windowDays,
        generated_at: now,
      },
      {
        plan_id: planBId,
        scope: "partner_combined",
        partner_user_id: userA,
        items,
        days: windowDays,
        generated_at: now,
      },
    ],
    { onConflict: "plan_id,scope" },
  );

  return { items, days: windowDays };
}
