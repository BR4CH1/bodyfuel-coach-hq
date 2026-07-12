import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI-Gerichtserkennung per Foto.
 *
 * Ablauf:
 *  1. Client schickt Foto (data URL, base64) an diese Server-Function.
 *  2. Wir rufen Lovable AI Gateway (google/gemini-2.5-flash, vision) mit
 *     einem strengen JSON-Prompt.
 *  3. Für jede erkannte Zutat suchen wir in `nutrition_foods` einen Match
 *     (Alias-fähig) und liefern verifizierte kcal/Makros pro 100 g mit.
 *  4. Der Client rechnet mit `nutrition-compute` die finalen Werte und
 *     zeigt sie zur Bestätigung an – NIE automatisch tracken.
 *
 * Wichtig: Keine KI-Schätzwerte für Makros. Die Vision-AI erkennt nur
 * Name + Menge; kcal/Makros kommen aus BLS/USDA/coach-verifiziert.
 */

export type MealPhotoIngredient = {
  name: string;
  estimated_amount: number;
  unit: "g" | "ml" | "piece";
  confidence: number;
  needs_confirmation: boolean;
  /** Optional: gefundener Datenbank-Match für diese Zutat */
  matched?: {
    id: string;
    name: string;
    source: string;
    verified_by_coach: boolean;
    kcal_per_100g: number;
    protein_per_100g: number;
    carbs_per_100g: number;
    fat_per_100g: number;
    piece_g: number | null;
  } | null;
};

export type MealPhotoResult = {
  dish_name: string;
  confidence: number;
  ingredients: MealPhotoIngredient[];
  questions: string[];
  needs_review: boolean;
};

const AI_MODEL = "google/gemini-2.5-flash";

function normalize(v: string): string {
  return v
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

function tokens(v: string): string[] {
  return normalize(v).split(/\s+/).filter(Boolean);
}

function scoreMatch(candidateName: string, aliases: string[] | null, query: string): number {
  const q = normalize(query);
  if (!q) return -1;
  const qTokens = tokens(query);
  const hays = [candidateName, ...(aliases ?? [])].map(normalize).filter(Boolean);
  let best = -1;
  for (const h of hays) {
    let s = 0;
    if (h === q) s = 100;
    else if (h.startsWith(q)) s = 70;
    else if (h.includes(q)) s = 50;
    else {
      const hits = qTokens.filter((t) => h.includes(t)).length;
      if (hits === 0) continue;
      s = 20 + hits * 15 - Math.max(0, qTokens.length - hits) * 5;
    }
    // kürzere Namen bevorzugen (generischer)
    s -= Math.min(15, Math.max(0, h.length - q.length) / 4);
    if (s > best) best = s;
  }
  return best;
}

function sourcePrio(s: string | null | undefined): number {
  const prio: Record<string, number> = {
    bodyfuel_verified: 0,
    bls_4_0: 1,
    open_food_facts: 2,
    usda: 3,
    manual: 4,
    ai_estimate: 9,
  };
  return prio[s ?? ""] ?? 5;
}

const PROMPT = `Du bist ein Ernährungs-Assistent bei BodyFuel. Analysiere das Foto der Mahlzeit.

Erkenne:
- Das Gesamtgericht (dish_name), knapper Name auf Deutsch (z.B. "Hähnchen mit Reis und Gemüse").
- Alle sichtbaren Zutaten & Getränke einzeln (Hauptgericht, Beilagen, Sauce, Getränk, Dessert).
- Für jede Zutat: geschätzte Menge in Gramm (g), Milliliter (ml) für Flüssigkeiten, oder Stück (piece) wenn zählbar (Eier, Scheiben, Nuggets).
- Konfidenz (0.0–1.0) pro Zutat und für das Gesamtgericht.
- needs_confirmation = true, wenn du dir bei der Zutat oder Menge nicht sicher bist (confidence < 0.7 oder Zutat teilweise verdeckt).

Stelle 0 bis 3 kurze, gezielte Rückfragen in "questions", wenn Öl, Sauce, Zubereitung (roh/gekocht), Käsesorte, Zucker/Dressing, Getränkeart, o.ä. nicht eindeutig ist. Fragen auf Deutsch, kurz.

Wichtig:
- Kalorien oder Makros NICHT schätzen — das übernimmt die Datenbank.
- Gib nur Zutaten aus, die real sichtbar sind.
- Getränke (Wasser, Softdrink, Zero, Saft, Milch, Shake, Alkohol) niemals blind als kalorienfrei annehmen. Wenn unklar, kurze Rückfrage stellen und Zutat mit needs_confirmation=true zurückgeben.
- Namen auf Deutsch, generisch (z.B. "Hähnchenbrust, gebraten", "Reis, gekocht", "Brokkoli", "Tomatensauce"). Kein Marken-Rätselraten.

Antworte ausschließlich als valides JSON mit exakt diesem Schema:
{
  "dish_name": string,
  "confidence": number,
  "ingredients": [
    { "name": string, "estimated_amount": number, "unit": "g"|"ml"|"piece", "confidence": number, "needs_confirmation": boolean }
  ],
  "questions": string[]
}`;

export const analyzeMealPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { image_data_url: string; note?: string }) =>
    z
      .object({
        // data:image/jpeg;base64,... (kein http-URL — Fotos sind privat)
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

    const userText = data.note?.trim()
      ? `${PROMPT}\n\nZusatzinfo vom Nutzer: ${data.note.trim()}`
      : PROMPT;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
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

    const rawIngredients: (MealPhotoIngredient | null)[] = Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map((i: any): MealPhotoIngredient | null => {
          const name = String(i?.name ?? "").trim();
          const amt = Number(i?.estimated_amount);
          if (!name || !isFinite(amt) || amt <= 0) return null;
          const unit: "g" | "ml" | "piece" =
            i?.unit === "ml" ? "ml" : i?.unit === "piece" ? "piece" : "g";
          const conf = Math.max(0, Math.min(1, Number(i?.confidence ?? 0.5)));
          return {
            name,
            estimated_amount: amt,
            unit,
            confidence: conf,
            needs_confirmation: Boolean(i?.needs_confirmation) || conf < 0.7,
            matched: null,
          };
        })
      : [];
    const ingredients: MealPhotoIngredient[] = rawIngredients.filter(
      (x: MealPhotoIngredient | null): x is MealPhotoIngredient => x !== null,
    );

    // DB-Matching für Makros — ein Fetch, dann in-Memory Score.
    if (ingredients.length > 0) {
      const { data: rows } = await context.supabase
        .from("nutrition_foods")
        .select(
          "id, name, source, verified_by_coach, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, aliases, unit_type, default_state",
        )
        .eq("needs_review", false)
        .limit(2000);
      const candidates = (rows ?? []) as any[];

      for (const ing of ingredients) {
        let bestRow: any = null;
        let bestScore = 30; // Mindestscore, sonst kein Match
        for (const r of candidates) {
          const s = scoreMatch(String(r.name ?? ""), (r.aliases ?? null) as string[] | null, ing.name);
          const adjusted = s - sourcePrio(r.source) * 2;
          if (adjusted > bestScore) {
            bestScore = adjusted;
            bestRow = r;
          }
        }
        if (bestRow) {
          ing.matched = {
            id: bestRow.id,
            name: bestRow.name,
            source: bestRow.source ?? "manual",
            verified_by_coach: !!bestRow.verified_by_coach,
            kcal_per_100g: Number(bestRow.kcal_per_100g) || 0,
            protein_per_100g: Number(bestRow.protein_per_100g) || 0,
            carbs_per_100g: Number(bestRow.carbs_per_100g) || 0,
            fat_per_100g: Number(bestRow.fat_per_100g) || 0,
            piece_g:
              typeof bestRow.piece_g === "number" && bestRow.piece_g > 0
                ? Number(bestRow.piece_g)
                : null,
          };
        } else {
          ing.needs_confirmation = true;
        }
      }
    }

    return {
      dish_name: String(parsed.dish_name ?? "Erkanntes Gericht").slice(0, 120),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.6))),
      ingredients,
      questions: Array.isArray(parsed.questions)
        ? parsed.questions.map((q: any) => String(q)).filter(Boolean).slice(0, 3)
        : [],
      needs_review: ingredients.some((i) => i.needs_confirmation) || !ingredients.length,
    };
  });
