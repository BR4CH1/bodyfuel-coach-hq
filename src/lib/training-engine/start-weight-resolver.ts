/**
 * Datenbasierter Startgewichts-Resolver.
 *
 * Priorität:
 *   1. Historie aus `training_set_logs` — Median-Working-Set-Gewicht
 *      der letzten 3 Sessions für die passende Übung / das passende
 *      Movement-Pattern.
 *   2. e1RM-Startgewichte (aus Strength-Check, e1RM × 0,75).
 *   3. null → UI-Notiz "Wähle Gewicht für RPE 7 / ~3 RIR".
 *
 * Wochen-Progression:
 *   W1 = 1.00 · W2 = 1.05 · W3 = 1.10 · W4 (Deload) = 0.85 des W3-Zielwerts.
 */

import type { MovementPattern, MovementSlot } from "./movement-framework";

export type SetLogRow = {
  exercise_id: string;
  weight_kg: number | null;
  reps: number | null;
  performed_at: string;
};

export type HistoryEntry = {
  name: string;
  pattern: MovementPattern | null;
  weight_kg: number;
  reps: number;
  date: string; // ISO date (day)
};

export type StartWeights = {
  bench_press_kg: number | null;
  shoulder_press_kg: number | null;
  squat_kg: number | null;
  deadlift_kg: number | null;
  lat_pulldown_kg: number | null;
  row_kg: number | null;
  leg_press_kg: number | null;
  leg_curl_kg: number | null;
};

/** Übungs-Name → Movement-Pattern (best-effort Regex-Klassifikation). */
export function patternFromName(name: string): MovementPattern | null {
  const n = name.toLowerCase();
  if (/(bankdr(u|ü)ck|brustpress|bench[- ]?press|chest[- ]?press|brustdr(u|ü)ck|dip)/.test(n)) return "horizontal_push";
  if (/(schulterdr(u|ü)ck|schulterpress|shoulder[- ]?press|overhead|military|arnold)/.test(n)) return "vertical_push";
  if (/(latzug|pull[- ]?down|pull ?up|klimmzug|chin ?up)/.test(n)) return "vertical_pull";
  if (/(rudern|row|kabelruder|seated ?row|t[- ]?bar)/.test(n)) return "horizontal_pull";
  if (/(kniebeuge|squat|beinpresse|leg[- ]?press|hackenschmidt)/.test(n)) return "squat";
  if (/(kreuzheb|deadlift|rdl|romanian|hip ?thrust|good ?morning)/.test(n)) return "hinge";
  if (/(ausfallschritt|lunge|split ?squat|step[- ]?up|bulgarian)/.test(n)) return "single_leg";
  if (/(beinbeuger|leg ?curl|hamstring ?curl|nordic)/.test(n)) return "hamstring_isolation";
  if (/(wadenheb|calf)/.test(n)) return "calf";
  if (/(fly|butterfly|(brust|chest).*(isol|iso)|krossover)/.test(n)) return "chest_isolation";
  if (/(seitheb|lateral ?raise|reverse ?fly|face ?pull)/.test(n)) return "shoulder_isolation";
  if (/(bizeps|biceps|curl)/.test(n)) return "biceps";
  if (/(trizeps|triceps|pushdown|french|skull)/.test(n)) return "triceps";
  if (/(plank|crunch|leg ?raise|dead ?bug|hollow|pallof|ab ?wheel|core)/.test(n)) return "core";
  if (/(farmer|carry)/.test(n)) return "carry_conditioning";
  if (/(straight[- ]?arm|pullover|back|r(u|ü)ckenstrecker)/.test(n)) return "back_isolation";
  return null;
}

/** Ordnet e1RM-basierte Startgewichte einem Movement-Pattern zu. */
function e1rmForPattern(pattern: MovementPattern | null, start: StartWeights): number | null {
  switch (pattern) {
    case "horizontal_push": return start.bench_press_kg;
    case "vertical_push": return start.shoulder_press_kg;
    case "squat": return start.leg_press_kg ?? start.squat_kg;
    case "hinge": return start.deadlift_kg;
    case "vertical_pull": return start.lat_pulldown_kg;
    case "horizontal_pull": return start.row_kg;
    case "hamstring_isolation": return start.leg_curl_kg;
    default: return null;
  }
}

function weekFactor(weekNumber: number, isDeload: boolean): number {
  if (isDeload) return 0.85;
  switch (weekNumber) {
    case 1: return 1.0;
    case 2: return 1.05;
    case 3: return 1.10;
    default: return 1.10;
  }
}

function roundToStep(v: number, step = 2.5): number {
  return Math.round(v / step) * step;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Baut den Historien-Index aus SetLogs + Name-Map. */
export function buildHistoryIndex(
  logs: SetLogRow[],
  nameById: Map<string, string>,
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const s of logs) {
    const name = nameById.get(String(s.exercise_id));
    if (!name) continue;
    const w = Number(s.weight_kg);
    const r = Number(s.reps);
    if (!Number.isFinite(w) || w <= 0) continue;
    if (!Number.isFinite(r) || r <= 0) continue;
    out.push({
      name,
      pattern: patternFromName(name),
      weight_kg: w,
      reps: Math.round(r),
      date: String(s.performed_at).slice(0, 10),
    });
  }
  return out;
}

/** Findet die letzten 3 Sessions einer Übung/eines Patterns und liefert Median-Top-Set. */
function historyMedianWeight(
  history: HistoryEntry[],
  chosenName: string,
  pattern: MovementPattern | null,
): number | null {
  const nameLower = chosenName.toLowerCase().trim();

  // 1. Exakte / enge Namensübereinstimmung
  const nameMatches = history.filter((h) => {
    const hn = h.name.toLowerCase();
    return hn === nameLower || hn.includes(nameLower) || nameLower.includes(hn);
  });

  const pickTopPerSession = (rows: HistoryEntry[]): number[] => {
    const byDate = new Map<string, number>();
    for (const r of rows) {
      const cur = byDate.get(r.date) ?? 0;
      if (r.weight_kg > cur) byDate.set(r.date, r.weight_kg);
    }
    return [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // desc by date
      .slice(0, 3)
      .map(([, w]) => w);
  };

  const nameTops = pickTopPerSession(nameMatches);
  if (nameTops.length >= 2) {
    return median(nameTops);
  }

  // 2. Fallback auf gleiches Movement-Pattern
  if (!pattern) return null;
  const patternMatches = history.filter((h) => h.pattern === pattern);
  const patternTops = pickTopPerSession(patternMatches);
  if (patternTops.length >= 2) {
    return median(patternTops);
  }

  return null;
}

export type ResolvedStartWeight = {
  weights: string | null;
  source: "history" | "e1rm" | "llm" | "none";
  note: string | null;
};

/**
 * Kernfunktion: pro Slot Startgewicht bestimmen.
 * `llmWeights` = kommaseparierter String vom LLM (kann null sein).
 */
export function resolveStartWeight(opts: {
  slot: MovementSlot;
  chosenName: string;
  history: HistoryEntry[];
  startWeights: StartWeights;
  weekNumber: number;
  isDeload: boolean;
  llmWeights: string | null;
}): ResolvedStartWeight {
  const { slot, chosenName, history, startWeights, weekNumber, isDeload, llmWeights } = opts;
  const factor = weekFactor(weekNumber, isDeload);

  // Nur für Compound / Secondary sinnvoll — Isolation/Core ohne Baseline lassen wir dem User.
  if (slot.tier === "core") {
    return { weights: null, source: "none", note: null };
  }

  // 1. Historie
  const histW = historyMedianWeight(history, chosenName, slot.pattern);
  if (histW && histW > 0) {
    const target = roundToStep(histW * factor);
    const line = fillWeights(target, slot.sets);
    return {
      weights: line,
      source: "history",
      note: `Basierend auf letzten ${histW.toFixed(1).replace(".0", "")} kg (Median letzte Sessions).`,
    };
  }

  // 2. e1RM
  const base = e1rmForPattern(slot.pattern, startWeights);
  if (base && base > 0) {
    const target = roundToStep(base * factor);
    return {
      weights: fillWeights(target, slot.sets),
      source: "e1rm",
      note: null,
    };
  }

  // 3. LLM-Vorschlag akzeptieren, wenn vorhanden
  if (llmWeights && llmWeights.trim().length) {
    return { weights: llmWeights, source: "llm", note: null };
  }

  // 4. Keine Basis → Notiz
  return {
    weights: null,
    source: "none",
    note: "Wähle ein Gewicht für RPE 7 / ~3 RIR.",
  };
}

function fillWeights(kg: number, sets: number): string {
  const n = Math.max(1, Math.min(20, Math.round(sets)));
  const val = Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
  return Array(n).fill(val).join(",");
}
