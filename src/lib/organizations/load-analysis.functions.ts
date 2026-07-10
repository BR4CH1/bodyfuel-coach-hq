import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Smart Load Analysis — schlägt eine wochenweise Belastungsverteilung vor.
 *
 * Strategie:
 *  1) Wenn Match-Termine (Spieltage) für die Woche bekannt sind, wird eine
 *     deterministische Heuristik angewendet (MD-Zyklus). Kein AI-Aufruf nötig.
 *  2) Wenn keine Match-Termine bekannt sind ODER der Coach explizit "AI"
 *     wählt, fragen wir das Lovable AI Gateway mit dem Wochenkontext an und
 *     bekommen einen strukturierten Vorschlag zurück.
 *
 * Ausgabe ist eine reine Empfehlung — nichts wird geschrieben. Der Coach
 * bestätigt & wendet sie per bestehendem `upsertLoadDay` an.
 */

export type LoadLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type LoadSuggestionDay = {
  date: string;
  load_level: LoadLevel;
  session_type: string | null;
  notes: string | null;
};

export type LoadSuggestion = {
  source: "heuristic" | "ai";
  reasoning: string;
  days: LoadSuggestionDay[];
};

/**
 * Standard-MD-Zyklus, gemessen an Tagen Abstand zum nächsten Match.
 * Positive Werte = Tage VOR dem Match. 0 = Matchday. Negative = nach Match.
 */
function heuristicLevelForMdOffset(offset: number, phase: "pre" | "post"): {
  level: LoadLevel;
  session: string;
  note: string;
} {
  if (offset === 0) return { level: 5, session: "Spiel", note: "Matchday" };
  if (phase === "post") {
    // Tage nach dem Spiel
    if (offset === 1) return { level: 1, session: "Regeneration", note: "MD+1: aktive Regeneration" };
    if (offset === 2) return { level: 2, session: "Leichtes Training", note: "MD+2: leichte Belastung" };
    return { level: 3, session: "Training", note: `MD+${offset}` };
  }
  // Tage vor dem Spiel
  if (offset === 1) return { level: 2, session: "Aktivierung", note: "MD-1: Aktivierung, kurz & knackig" };
  if (offset === 2) return { level: 3, session: "Taktik/Standards", note: "MD-2: mittlere Belastung" };
  if (offset === 3) return { level: 4, session: "Hauptbelastung", note: "MD-3: harte Einheit" };
  if (offset === 4) return { level: 3, session: "Kraft/Ausdauer", note: "MD-4: mittelhart" };
  return { level: 2, session: "Grundlage", note: `MD-${offset}` };
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

/** Heuristik: Für jeden Tag der Woche wählen wir den nächsten Match-Tag. */
export function buildHeuristicSuggestion(
  weekDates: string[],
  matchDates: string[],
): LoadSuggestion {
  const matches = [...matchDates].sort();
  const days: LoadSuggestionDay[] = weekDates.map((d) => {
    if (matches.includes(d)) {
      return { date: d, load_level: 5, session_type: "Spiel", notes: "Matchday" };
    }
    // Nächster Match: kleinster Abstand (Betrag)
    let bestOffset: number | null = null;
    let bestPhase: "pre" | "post" = "pre";
    for (const m of matches) {
      const diff = daysBetween(d, m); // >0 = vor Match
      const abs = Math.abs(diff);
      if (bestOffset === null || abs < bestOffset) {
        bestOffset = abs;
        bestPhase = diff >= 0 ? "pre" : "post";
      }
    }
    if (bestOffset === null) {
      return { date: d, load_level: 3, session_type: "Training", notes: "Standard" };
    }
    const h = heuristicLevelForMdOffset(bestOffset, bestPhase);
    return { date: d, load_level: h.level, session_type: h.session, notes: h.note };
  });

  return {
    source: "heuristic",
    reasoning:
      matches.length > 0
        ? `MD-Zyklus um ${matches.length} Spieltag(e) (${matches.join(", ")}).`
        : "Standard-Trainingswoche ohne Spieltag.",
    days,
  };
}

/** Alle 7 Tage einer Woche als ISO-Strings. */
function weekDatesFrom(weekStart: string): string[] {
  const start = new Date(weekStart + "T00:00:00Z");
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    out.push(isoDate(d));
  }
  return out;
}

export const suggestLoadWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      orgId: string;
      teamId?: string | null;
      weekStart: string;
      matchDates?: string[];
      notes?: string | null;
      mode?: "auto" | "heuristic" | "ai";
    }) => data,
  )
  .handler(async ({ data }) => {
    const weekDates = weekDatesFrom(data.weekStart);
    const matchDates = (data.matchDates ?? []).filter((d) => weekDates.includes(d));
    const mode = data.mode ?? "auto";

    // Heuristik-Pfad: wenn Matches bekannt und Modus es zulässt.
    if ((mode === "auto" || mode === "heuristic") && matchDates.length > 0) {
      return buildHeuristicSuggestion(weekDates, matchDates);
    }
    if (mode === "heuristic") {
      return buildHeuristicSuggestion(weekDates, matchDates);
    }

    // AI-Fallback (auto ohne Matches, oder explizit ai)
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      // Ohne AI-Key fallen wir auf eine sinnvolle Standardwoche zurück.
      return buildHeuristicSuggestion(weekDates, matchDates);
    }

    const system = `Du bist Athletiktrainer und planst die wöchentliche Belastung eines Team-Sport-Kaders.
Antworte AUSSCHLIESSLICH als JSON-Objekt mit dem Feld "days" — ein Array mit 7 Einträgen in Wochen-Reihenfolge.
Jeder Eintrag: { "date": "YYYY-MM-DD", "load_level": 0..5, "session_type": string|null, "notes": string|null }.
Skala: 0=Rest, 1=Regeneration, 2=Leicht, 3=Mittel, 4=Hart, 5=Matchday.
Nur Werte 0..5 verwenden. Kurze, konkrete Notizen auf Deutsch.`;

    const userPrompt = `Wochenbeginn: ${data.weekStart}
Wochendaten (Mo–So): ${weekDates.join(", ")}
Bekannte Spieltage: ${matchDates.length > 0 ? matchDates.join(", ") : "keine"}
Coach-Kontext: ${data.notes?.trim() || "keiner"}

Erstelle einen realistischen Wochenplan (MD-Zyklus, wenn Spieltag vorhanden; sonst progressive Trainingswoche mit einem harten Tag und mindestens einem Ruhetag).`;

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (aiRes.status === 429 || aiRes.status === 402 || !aiRes.ok) {
        return buildHeuristicSuggestion(weekDates, matchDates);
      }
      const aiJson = await aiRes.json();
      const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const rawDays: unknown[] = Array.isArray(parsed?.days) ? parsed.days : [];

      const days: LoadSuggestionDay[] = weekDates.map((d) => {
        const match = rawDays.find(
          (r) => typeof r === "object" && r !== null && (r as { date?: string }).date === d,
        ) as { load_level?: number; session_type?: string | null; notes?: string | null } | undefined;
        const level = Math.max(0, Math.min(5, Math.round(match?.load_level ?? 3))) as LoadLevel;
        return {
          date: d,
          load_level: level,
          session_type: match?.session_type ?? null,
          notes: match?.notes ?? null,
        };
      });

      return {
        source: "ai",
        reasoning: "KI-Vorschlag basierend auf Wochenkontext.",
        days,
      };
    } catch {
      return buildHeuristicSuggestion(weekDates, matchDates);
    }
  });

/**
 * Nutrition-Integration Helper: Belastungsstufe → grober Tagestyp-Kontext,
 * damit Orgs ohne `smart_training` trotzdem eine Belastungsinfo an die
 * Nutrition-Engine geben können.
 */
export function loadLevelToDayContext(level: number | null | undefined): {
  sessionIntensity: "rest" | "light" | "moderate" | "hard" | "match";
  dayType: "rest" | "training" | "match";
} {
  const l = level ?? 0;
  if (l >= 5) return { sessionIntensity: "match", dayType: "match" };
  if (l >= 4) return { sessionIntensity: "hard", dayType: "training" };
  if (l >= 3) return { sessionIntensity: "moderate", dayType: "training" };
  if (l >= 2) return { sessionIntensity: "light", dayType: "training" };
  if (l >= 1) return { sessionIntensity: "light", dayType: "training" };
  return { sessionIntensity: "rest", dayType: "rest" };
}
