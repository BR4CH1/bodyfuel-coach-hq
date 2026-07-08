/**
 * Erkennt den Trainingsfokus aus Titel/Beschreibung einer Coach-Einheit.
 * Client- und server-safe (keine Imports).
 */

export type TrainingFocus =
  | "football"
  | "strength"
  | "speed"
  | "agility"
  | "conditioning"
  | "mobility"
  | "recovery"
  | "none";

export const FOCUS_LABEL: Record<TrainingFocus, string> = {
  football: "Football",
  strength: "Strength",
  speed: "Speed",
  agility: "Agility",
  conditioning: "Conditioning",
  mobility: "Mobility",
  recovery: "Recovery",
  none: "Kein automatischer Athletikplan",
};

export const FOCUS_CHOICES: TrainingFocus[] = [
  "football",
  "strength",
  "speed",
  "agility",
  "conditioning",
  "mobility",
  "recovery",
  "none",
];

// Reihenfolge = Priorität (Recovery vor Strength, weil "Recovery Lift" primär Recovery meint,
// aber laut Beispiel des Users soll bei "Recovery Lift" Strength erkannt werden.
// Daher: Strength Signalwörter > Recovery, Recovery nur wenn kein Strength/Speed-Wort da ist.
// Wir gewichten nach Score, nicht Reihenfolge.)
const KEYWORDS: Record<Exclude<TrainingFocus, "none">, string[]> = {
  football: [
    "football", "team training", "team-training", "practice", "playbook",
    "offense drill", "defense drill", "special teams", "position drill",
    "7-on-7", "walkthrough", "scrimmage",
  ],
  strength: [
    "strength", "kraft", "gym", "gewichte", "hantel", "lift", "lifting",
    "squat", "kniebeuge", "deadlift", "kreuzheben", "bench", "bankdrücken",
    "press", "row", "pull-up", "klimmzüge", "hip thrust", "power clean",
    "olympic lift", "upper body", "lower body", "push day", "pull day",
  ],
  speed: [
    "speed", "schnelligkeit", "sprint", "acceleration", "beschleunigung",
    "flying sprint", "top speed", "max velocity",
  ],
  agility: [
    "agility", "cod ", " cod", "change of direction", "richtungswechsel",
    "footwork", "cone drill", "ladder drill", "reaktion", "cutting",
  ],
  conditioning: [
    "conditioning", "ausdauer", "cardio", "intervall", "hiit", "gassers",
    "tempo run", "endurance", "aerob", "anaerob", "gasser",
  ],
  mobility: [
    "mobility", "mobilität", "beweglichkeit", "mobilisier", "stretch",
    "dehnen", "yoga", "flexibility", "hüfte mobil", "thoracic",
  ],
  recovery: [
    "recovery", "regeneration", "active recovery", "deload", "cool down",
    "foam roll", "sauna", "ice bath", "walk", "spaziergang",
  ],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectTrainingFocus(
  title: string | null | undefined,
  description?: string | null,
): { focus: TrainingFocus; confidence: "high" | "medium" | "low"; matched: string[] } {
  const hay = normalize([title ?? "", description ?? ""].join(" "));
  if (!hay) return { focus: "none", confidence: "low", matched: [] };

  const scores: Partial<Record<TrainingFocus, { score: number; matched: string[] }>> = {};
  for (const [focus, words] of Object.entries(KEYWORDS) as [
    Exclude<TrainingFocus, "none">,
    string[],
  ][]) {
    const matched: string[] = [];
    let score = 0;
    for (const w of words) {
      const nw = normalize(w);
      if (!nw) continue;
      if (hay.includes(nw)) {
        matched.push(w);
        // Längere Treffer werten stärker.
        score += Math.max(1, Math.ceil(nw.length / 4));
      }
    }
    if (score > 0) scores[focus] = { score, matched };
  }

  const entries = Object.entries(scores) as [TrainingFocus, { score: number; matched: string[] }][];
  if (!entries.length) return { focus: "none", confidence: "low", matched: [] };

  entries.sort((a, b) => b[1].score - a[1].score);
  const [top, second] = entries;
  const conf: "high" | "medium" | "low" =
    top[1].score >= 6 || !second || top[1].score >= second[1].score * 2
      ? "high"
      : top[1].score >= 3
      ? "medium"
      : "low";
  return { focus: top[0], confidence: conf, matched: top[1].matched };
}

/** true = System generiert für diesen Fokus automatisch Athleten-Sessions. */
export function focusTriggersAthleteSession(focus: TrainingFocus | null | undefined): boolean {
  if (!focus) return false;
  return focus !== "football" && focus !== "none";
}
