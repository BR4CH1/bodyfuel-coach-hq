// Server-only helper: prüft KI-generierte Mahlzeiten-Beschreibungen
// gegen unsere geprüfte BodyFuel-DB (nutrition_foods, BLS 4.0 + verified).
// Berechnet den Anteil verlässlich erkannter Zutaten und klassifiziert
// die Mahlzeit als db_verified / db_mixed / ai_estimate.
//
// WICHTIG: Wir überschreiben die KI-Makros (noch) nicht — wir kennzeichnen
// nur die Datenqualität, damit Coach & Kunde sehen, ob sie sich darauf
// verlassen können.

export type DataSource = "db_verified" | "db_mixed" | "ai_estimate" | "coach_verified";

export type VerifyResult = {
  data_source: DataSource;
  verified_ratio: number; // 0..1
  matched: string[];
  unmatched: string[];
};

const INGREDIENT_LINE = /(\d+[.,]?\d*)\s*(g|ml|stk|stück|el|tl|kcal|portion|portionen)?\s*([a-zäöüß][a-zäöüß \-'/().0-9]+)/gi;

/** Sehr einfache Tokenisierung der „Zutat" — letzte 1-3 Wörter werden für Suche genutzt */
function ingredientKeyword(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, "")
    .replace(/[0-9]+/g, "")
    .replace(/\b(roh|gekocht|gegart|gebraten|frisch|trocken|tk|dose)\b/gi, "")
    .trim()
    .toLowerCase();
}

export function parseIngredients(description: string | null | undefined): string[] {
  if (!description) return [];
  const out: string[] = [];
  const text = description.replace(/\n/g, ",");
  for (const part of text.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // Erstes match in jedem Komma-Segment
    INGREDIENT_LINE.lastIndex = 0;
    const m = INGREDIENT_LINE.exec(trimmed);
    if (m) {
      const kw = ingredientKeyword(m[3] ?? "");
      if (kw && kw.length >= 3) out.push(kw);
    }
  }
  return out;
}

/**
 * Schlägt jede Zutat in nutrition_foods nach (ILIKE).
 * Gibt verified_ratio + Datenquellen-Label zurück.
 */
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
  // Bulk-Query: ein OR-Filter pro Zutat — bei wenigen Zutaten pro Mahlzeit ok.
  for (const kw of items) {
    const head = kw.split(/\s+/).slice(-2).join(" "); // letzte 1-2 Wörter ≙ Substantiv
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
