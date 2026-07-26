import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FoodAmountUnit } from "@/lib/food-units";
import { checkFoodEnergy } from "@/lib/food-energy";

/**
 * AI-Gerichtserkennung per Foto + intelligentes Matching mit der
 * Lebensmitteldatenbank (`nutrition_foods`).
 *
 * Ablauf:
 *  1. Foto → Vision-AI erkennt Zutaten, Mengen, Einheiten.
 *  2. Namen werden normalisiert (Kleinschreibung, Diakritika, Plural,
 *     Synonyme) und mit einer Kombination aus Alias/Exakt-Match,
 *     Token-Overlap, Trigram-Similarity und Levenshtein gescored.
 *  3. Zusätzlich wird die Lern-Tabelle `food_alias_learning` einbezogen,
 *     damit Nutzerentscheidungen künftige Automatik verbessern.
 *  4. Ergebnis: pro Zutat ein Best-Match plus bis zu 5 Kandidaten mit
 *     Confidence-Score und `match_status`.
 *
 * Kalorien/Makros werden ausschließlich aus der Datenbank berechnet;
 * die KI schätzt nur Namen und Mengen.
 */

export type MatchStatus =
  | "auto_matched" // >= 90%
  | "auto_matched_editable" // 75–90%
  | "needs_choice" // < 75%, aber Kandidaten vorhanden
  | "not_found"; // keine Kandidaten

export type FoodMatch = {
  id: string;
  name: string;
  source: string;
  verified_by_coach: boolean;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  unit: FoodAmountUnit;
  density_g_per_ml: number | null;
  score: number; // 0..1
};

export type MealPhotoIngredient = {
  name: string;
  estimated_amount: number;
  unit: FoodAmountUnit;
  confidence: number;
  needs_confirmation: boolean;
  match_status: MatchStatus;
  matched: FoodMatch | null;
  candidates: FoodMatch[];
};

export type MealPhotoResult = {
  dish_name: string;
  confidence: number;
  ingredients: MealPhotoIngredient[];
  questions: string[];
  needs_review: boolean;
};

const AI_MODEL = "google/gemini-2.5-flash";

// ────────────────────────────────────────────────────────────────────────────
// Normalisierung + Synonym-Map
// ────────────────────────────────────────────────────────────────────────────

/** Redaktionelle Synonym-Map: „was Nutzer/AI sagen" → „was in der DB stehen könnte". */
const SYNONYMS: Record<string, string> = {
  // Getränke
  kaffeegetraenk: "kaffee",
  milchkaffee: "kaffee mit milch",
  "cafe au lait": "kaffee mit milch",
  "café au lait": "kaffee mit milch",
  cappucino: "cappuccino",
  capuccino: "cappuccino",
  "coca cola zero": "coca-cola zero",
  "cola zero": "coca-cola zero",
  "coke zero": "coca-cola zero",
  "cola ohne zucker": "coca-cola zero",
  "coca cola": "coca-cola",
  cola: "coca-cola",
  coke: "coca-cola",
  // Lebensmittel
  kirschen: "süßkirschen",
  kirsche: "süßkirschen",
  chicken: "hähnchenbrust",
  hähnchen: "hähnchenbrust",
  haehnchen: "hähnchenbrust",
  magerquark: "quark mager",
  "skyr natur": "skyr",
};

/** Füllwörter, die entfernt werden. */
const STOP_WORDS = new Set([
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "mit",
  "und",
  "oder",
  "aus",
  "von",
  "im",
  "in",
  "an",
  "am",
  "zum",
  "zur",
  "bei",
  "auf",
  "of",
  "the",
  "a",
]);

function stripDiacritics(s: string) {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalize(v: string): string {
  const base = stripDiacritics(v)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return base;
}

/** Sehr einfache DE-Singularisierung als Fallback (nicht linguistisch perfekt, aber wirksam). */
function singularize(tok: string): string {
  // rohe → roh; -innen/-en/-er/-e/-n am Ende
  const patterns = [/innen$/, /nen$/, /ern$/, /er$/, /en$/, /e$/, /n$/, /s$/];
  for (const p of patterns) {
    const r = tok.replace(p, "");
    if (r.length >= 3) return r;
  }
  return tok;
}

function tokens(v: string): string[] {
  return normalize(v)
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOP_WORDS.has(t));
}

/** Wendet Synonyme auf den kompletten Ausdruck und einzelne Tokens an. */
function applySynonyms(raw: string): string {
  const n = normalize(raw);
  if (SYNONYMS[n]) return normalize(SYNONYMS[n]);
  // Token-Level
  const parts = n.split(/\s+/).map((t) => SYNONYMS[t] ?? t);
  return normalize(parts.join(" "));
}

// ────────────────────────────────────────────────────────────────────────────
// Fuzzy Distance
// ────────────────────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s}  `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function trigramSim(a: string, b: string): number {
  if (!a || !b) return 0;
  const A = trigrams(a);
  const B = trigrams(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (2 * inter) / (A.size + B.size);
}

// ────────────────────────────────────────────────────────────────────────────
// Scoring
// ────────────────────────────────────────────────────────────────────────────

/** Returns 0..1 confidence score. */
function scoreMatch(candidateName: string, aliases: string[] | null, query: string): number {
  const rawQ = normalize(query);
  const synQ = applySynonyms(query);
  const qCandidates = Array.from(new Set([rawQ, synQ].filter(Boolean)));
  if (qCandidates.length === 0) return 0;

  const hays = [candidateName, ...(aliases ?? [])]
    .filter(Boolean)
    .map((h) => normalize(String(h)))
    .filter(Boolean);
  if (hays.length === 0) return 0;

  let best = 0;
  for (const q of qCandidates) {
    const qTokens = q.split(/\s+/).filter(Boolean);
    const qSingular = qTokens.map(singularize).join(" ");

    for (const h of hays) {
      const hTokens = h.split(/\s+/).filter(Boolean);
      const hSingular = hTokens.map(singularize).join(" ");

      let s = 0;
      // exakt
      if (h === q || hSingular === qSingular) s = 1.0;
      else if (h.startsWith(q) || q.startsWith(h)) s = 0.9;
      else if (h.includes(q) || q.includes(h)) s = 0.82;
      else {
        // Token-Overlap + Fuzzy
        const hSet = new Set(hTokens.map(singularize));
        const overlap = qTokens.map(singularize).filter((t) => hSet.has(t)).length;
        const tokenScore = overlap === 0 ? 0 : (2 * overlap) / (qTokens.length + hTokens.length);

        const tri = trigramSim(q, h);
        const lev = levenshtein(q, h);
        const levNorm = 1 - Math.min(1, lev / Math.max(q.length, h.length));

        s = Math.max(tokenScore * 0.9, tri * 0.85, levNorm * 0.75);
      }

      // kürzere/generischere Namen leicht bevorzugen
      const lenPenalty = Math.min(0.08, Math.max(0, h.length - q.length) / 100);
      s -= lenPenalty;

      if (s > best) best = s;
    }
  }
  return Math.max(0, Math.min(1, best));
}

function sourceBoost(s: string | null | undefined): number {
  // kleine Boosts, damit verifizierte Quellen bei gleichem Score gewinnen.
  const map: Record<string, number> = {
    bodyfuel_verified: 0.05,
    bls_4_0: 0.04,
    open_food_facts: 0.02,
    usda: 0.02,
    manual: 0.0,
    ai_estimate: -0.1,
  };
  return map[s ?? ""] ?? 0;
}

function statusFromScore(score: number, hasAny: boolean): MatchStatus {
  if (!hasAny) return "not_found";
  if (score >= 0.9) return "auto_matched";
  if (score >= 0.75) return "auto_matched_editable";
  return "needs_choice";
}

// ────────────────────────────────────────────────────────────────────────────
// Kandidatenpool laden + Matching
// ────────────────────────────────────────────────────────────────────────────

type CandidateRow = {
  id: string;
  name: string;
  aliases: string[] | null;
  source: string | null;
  verified_by_coach: boolean;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  unit_type: string | null;
  density_g_per_ml: number | null;
};

const PREPARATION_WORDS = new Set([
  "frisch",
  "roh",
  "gekocht",
  "gegart",
  "gebraten",
  "gebacken",
  "gegrillt",
  "geduenstet",
  "gedünstet",
]);

function catalogTerms(query: string): string[] {
  const full = applySynonyms(query);
  const withoutPreparation = full
    .split(/\s+/)
    .filter((word) => !PREPARATION_WORDS.has(word))
    .join(" ")
    .trim();
  return Array.from(new Set([full, withoutPreparation].filter(Boolean)));
}

async function loadCandidatePool(supabase: any, queries: string[]): Promise<CandidateRow[]> {
  const terms = Array.from(new Set(queries.flatMap(catalogTerms))).slice(0, 30);
  const responses = await Promise.all(
    terms.map((term) =>
      (supabase.rpc as any)("search_nutrition_foods", {
        _q: term,
        _max_results: 50,
      }),
    ),
  );
  const unique = new Map<string, CandidateRow>();
  for (const response of responses) {
    if (response.error) continue;
    for (const row of (response.data ?? []) as CandidateRow[]) unique.set(row.id, row);
  }
  return [...unique.values()];
}

async function loadLearnedAliases(
  supabase: any,
  terms: string[],
): Promise<Map<string, Map<string, number>>> {
  const map = new Map<string, Map<string, number>>();
  if (terms.length === 0) return map;
  const { data } = await supabase
    .from("food_alias_learning")
    .select("normalized_term, food_id")
    .in("normalized_term", terms);
  for (const row of (data ?? []) as { normalized_term: string; food_id: string }[]) {
    const bucket = map.get(row.normalized_term) ?? new Map<string, number>();
    bucket.set(row.food_id, (bucket.get(row.food_id) ?? 0) + 1);
    map.set(row.normalized_term, bucket);
  }
  return map;
}

function toFoodMatch(row: CandidateRow, score: number): FoodMatch {
  return {
    id: row.id,
    name: row.name,
    source: row.source ?? "manual",
    verified_by_coach: !!row.verified_by_coach,
    kcal_per_100g: checkFoodEnergy({
      kcal_per_100g: Number(row.kcal_per_100g) || 0,
      protein_per_100g: Number(row.protein_per_100g) || 0,
      carbs_per_100g: Number(row.carbs_per_100g) || 0,
      fat_per_100g: Number(row.fat_per_100g) || 0,
    }).kcal_per_100g,
    protein_per_100g: Number(row.protein_per_100g) || 0,
    carbs_per_100g: Number(row.carbs_per_100g) || 0,
    fat_per_100g: Number(row.fat_per_100g) || 0,
    unit: row.unit_type === "ml" ? "ml" : "g",
    density_g_per_ml:
      row.unit_type === "ml" && Number(row.density_g_per_ml) > 0
        ? Number(row.density_g_per_ml)
        : null,
    score: Math.round(score * 100) / 100,
  };
}

/** Rankt den Pool für einen Query. Liefert Best + Top-5 Kandidaten. */
function rankCandidates(
  query: string,
  pool: CandidateRow[],
  learnedForTerm: Map<string, number> | undefined,
): { best: FoodMatch | null; candidates: FoodMatch[]; bestScore: number } {
  if (!query.trim() || pool.length === 0) {
    return { best: null, candidates: [], bestScore: 0 };
  }

  // Scoring aller Kandidaten
  const scored = pool
    .map((r) => {
      const base = scoreMatch(r.name, r.aliases, query);
      const boost = sourceBoost(r.source);
      const learnedBoost = learnedForTerm?.has(r.id)
        ? Math.min(0.25, 0.1 + (learnedForTerm.get(r.id) ?? 0) * 0.05)
        : 0;
      return { row: r, score: Math.min(1, base + boost + learnedBoost) };
    })
    .filter((x) => x.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (scored.length === 0) return { best: null, candidates: [], bestScore: 0 };

  const top = scored[0];
  const candidates = scored.slice(0, 5).map((x) => toFoodMatch(x.row, x.score));
  return { best: toFoodMatch(top.row, top.score), candidates, bestScore: top.score };
}

// ────────────────────────────────────────────────────────────────────────────
// Prompt
// ────────────────────────────────────────────────────────────────────────────

const PROMPT = `Du bist Ernährungs-Assistent bei BodyFuel. Analysiere das Foto der Mahlzeit.

Erkenne:
- Gesamtgericht (dish_name), knapp auf Deutsch (z.B. "Hähnchen mit Reis und Gemüse").
- Alle sichtbaren Zutaten & Getränke einzeln.
- Für jede Zutat: geschätzte Gesamtmenge. Flüssigkeiten ausschließlich in ml, alles andere
  ausschließlich in g. Auch zählbare Lebensmittel (Ei, Banane, Scheibe Brot) als Gesamtgewicht in g.
- Konfidenz (0.0–1.0) pro Zutat und für das Gesamtgericht.

Wichtig:
- Kalorien/Makros NICHT schätzen — das übernimmt die Datenbank.
- Namen so konkret wie möglich, deutsch, Singular möglich (z.B. "Süßkirschen, frisch", "Hähnchenbrust, gebraten", "Reis, gekocht", "Milchkaffee").
- Getränke präzise benennen ("Cappuccino", "Cola Zero", "Kaffee mit Milch"). Wenn Getränkeart nur "Kaffeegetränk" oder ähnlich unklar ist, stelle in "questions" eine kurze Rückfrage.
- Stelle 0–3 kurze Rückfragen auf Deutsch für Öl/Sauce/Zubereitung/Getränkeart, wenn unsicher.

Antworte ausschließlich als valides JSON:
{
  "dish_name": string,
  "confidence": number,
  "ingredients": [
    { "name": string, "estimated_amount": number, "unit": "g"|"ml", "confidence": number }
  ],
  "questions": string[]
}`;

// ────────────────────────────────────────────────────────────────────────────
// Server-Function: Foto analysieren
// ────────────────────────────────────────────────────────────────────────────

export const analyzeMealPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { image_data_url: string; note?: string }) =>
    z
      .object({
        image_data_url: z
          .string()
          .startsWith("data:image/")
          .max(15_000_000, "Bild zu groß (max ~10 MB)"),
        note: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<MealPhotoResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");

    const userText = data.note?.trim() ? `${PROMPT}\n\nZusatzinfo: ${data.note.trim()}` : PROMPT;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: data.image_data_url } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("AI-Limit erreicht — bitte gleich nochmal versuchen.");
    if (res.status === 402) throw new Error("AI-Credits aufgebraucht.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI-Fehler ${res.status}: ${t.slice(0, 160)}`);
    }

    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    // Vor-Verarbeitung der AI-Rohzutaten
    const preIngredients = (Array.isArray(parsed.ingredients) ? parsed.ingredients : [])
      .map((i: any) => {
        const name = String(i?.name ?? "").trim();
        const amt = Number(i?.estimated_amount);
        if (!name || !isFinite(amt) || amt <= 0) return null;
        const unit: FoodAmountUnit = i?.unit === "ml" ? "ml" : "g";
        const conf = Math.max(0, Math.min(1, Number(i?.confidence ?? 0.5)));
        return { name, estimated_amount: amt, unit, confidence: conf };
      })
      .filter((x: any): x is NonNullable<typeof x> => x !== null);

    const terms = preIngredients.map((i: { name: string }) => normalize(applySynonyms(i.name)));
    const [pool, learned] = await Promise.all([
      loadCandidatePool(
        context.supabase,
        preIngredients.map((i: { name: string }) => i.name),
      ),
      loadLearnedAliases(context.supabase, terms),
    ]);

    const ingredients: MealPhotoIngredient[] = preIngredients.map(
      (i: { name: string; estimated_amount: number; unit: FoodAmountUnit; confidence: number }) => {
        const term = normalize(applySynonyms(i.name));
        const ranked = rankCandidates(i.name, pool, learned.get(term));
        const status = statusFromScore(ranked.bestScore, !!ranked.best);
        return {
          name: i.name,
          estimated_amount: i.estimated_amount,
          unit: ranked.best?.unit ?? i.unit,
          confidence: i.confidence,
          needs_confirmation:
            status === "needs_choice" || status === "not_found" || i.confidence < 0.6,
          match_status: status,
          matched:
            status === "auto_matched" || status === "auto_matched_editable" ? ranked.best : null,
          candidates: ranked.candidates,
        };
      },
    );

    return {
      dish_name: String(parsed.dish_name ?? "Erkanntes Gericht").slice(0, 120),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.6))),
      ingredients,
      questions: Array.isArray(parsed.questions)
        ? parsed.questions
            .map((q: any) => String(q))
            .filter(Boolean)
            .slice(0, 3)
        : [],
      needs_review: ingredients.some((i) => i.needs_confirmation),
    };
  });

// ────────────────────────────────────────────────────────────────────────────
// Server-Function: Text → Match (Rückfragen, Rename, Freitext)
// ────────────────────────────────────────────────────────────────────────────

export type MatchIngredientResult = {
  best: FoodMatch | null;
  candidates: FoodMatch[];
  match_status: MatchStatus;
};

export const matchIngredientName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) =>
    z.object({ name: z.string().trim().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<MatchIngredientResult> => {
    const term = normalize(applySynonyms(data.name));
    const [pool, learned] = await Promise.all([
      loadCandidatePool(context.supabase, [data.name]),
      loadLearnedAliases(context.supabase, [term]),
    ]);
    const ranked = rankCandidates(data.name, pool, learned.get(term));
    return {
      best: ranked.best,
      candidates: ranked.candidates,
      match_status: statusFromScore(ranked.bestScore, !!ranked.best),
    };
  });

// ────────────────────────────────────────────────────────────────────────────
// Server-Function: Nutzerauswahl als Alias lernen
// ────────────────────────────────────────────────────────────────────────────

export const learnFoodAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { term: string; food_id: string }) =>
    z
      .object({
        term: z.string().trim().min(1).max(200),
        food_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const term = normalize(applySynonyms(data.term));
    if (!term) return { ok: false };
    await context.supabase
      .from("food_alias_learning")
      .upsert(
        { normalized_term: term, food_id: data.food_id, user_id: context.userId },
        { onConflict: "user_id,normalized_term,food_id" },
      );
    return { ok: true };
  });
