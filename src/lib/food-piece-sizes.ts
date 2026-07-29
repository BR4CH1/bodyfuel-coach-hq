import { normalizeFoodTerm } from "@/lib/food-search.logic";

export type PiecePreset = {
  /** Gramm pro Stück (Durchschnittswert für die Portionsauswahl). */
  grams: number;
  /** Anzeige-Label, z.B. "Stück", "Scheibe". */
  label: string;
};

type Rule = PiecePreset & { match: string[] };

/**
 * Durchschnittliche Stückgrößen für die Mengenauswahl.
 * Wichtig: Diese Werte skalieren NUR die Portionsgröße (Gramm) —
 * kcal/Makros stammen weiterhin unverändert aus dem Katalog (pro 100 g).
 */
const RULES: Rule[] = [
  { match: ["wachtelei"], grams: 12, label: "Stück" },
  { match: ["ei", "eier", "vollei", "spiegelei", "ruehrei", "huehnerei"], grams: 58, label: "Stück" },
  { match: ["eigelb", "eidotter"], grams: 18, label: "Stück" },
  { match: ["eiweiss", "eiklar"], grams: 33, label: "Stück" },
  { match: ["banane"], grams: 118, label: "Stück" },
  { match: ["apfel"], grams: 150, label: "Stück" },
  { match: ["birne"], grams: 150, label: "Stück" },
  { match: ["orange"], grams: 180, label: "Stück" },
  { match: ["mandarine", "clementine"], grams: 70, label: "Stück" },
  { match: ["kiwi"], grams: 75, label: "Stück" },
  { match: ["tomate"], grams: 85, label: "Stück" },
  { match: ["paprika"], grams: 150, label: "Stück" },
  { match: ["gurke"], grams: 300, label: "Stück" },
  { match: ["zwiebel"], grams: 90, label: "Stück" },
  { match: ["moehre", "karotte"], grams: 70, label: "Stück" },
  { match: ["kartoffel"], grams: 100, label: "Stück" },
  { match: ["avocado"], grams: 150, label: "Stück" },
  { match: ["toast", "toastbrot"], grams: 25, label: "Scheibe" },
  { match: ["knaeckebrot"], grams: 10, label: "Scheibe" },
  { match: ["broetchen", "semmel"], grams: 60, label: "Stück" },
  { match: ["brot", "vollkornbrot", "mischbrot"], grams: 45, label: "Scheibe" },
  { match: ["scheibletten", "schmelzkaese scheibe"], grams: 20, label: "Scheibe" },
  { match: ["reiswaffel"], grams: 8, label: "Stück" },
  { match: ["proteinriegel", "riegel"], grams: 60, label: "Stück" },
  { match: ["wiener", "bockwurst"], grams: 50, label: "Stück" },
];

/**
 * Liefert eine sinnvolle Stückgröße für Lebensmittel, die üblicherweise
 * in Stück/Scheiben gegessen werden. Sonst null (nur Gramm-Eingabe).
 */
export function piecePresetFor(food: {
  name: string;
  brand?: string | null;
  unit?: string | null;
  serving_g?: number | null;
}): PiecePreset | null {
  if (food.unit === "ml") return null;
  if (food.serving_g != null && Number(food.serving_g) > 0) {
    return { grams: Number(food.serving_g), label: "Stück" };
  }

  const tokens = new Set(normalizeFoodTerm(`${food.name} ${food.brand ?? ""}`).split(/\s+/));
  for (const rule of RULES) {
    if (rule.match.some((term) => tokens.has(term))) {
      return { grams: rule.grams, label: rule.label };
    }
  }
  return null;
}

export function piecesToGrams(pieces: number, preset: PiecePreset): number {
  return Math.max(0, Number(pieces) || 0) * preset.grams;
}
