/**
 * Double-Progression-Logik für Working Sets.
 *
 * Entscheidet nach einer abgeschlossenen Übung, welches Gewicht in der
 * NÄCHSTEN Session dieser Übung angesetzt werden soll.
 *
 *   • Alle Working-Sets an ODER über der oberen Rep-Grenze  → +Increment
 *   • Alle Working-Sets im Zielbereich (untere ≤ x < obere) → Gewicht halten
 *   • Mindestens ein Set UNTER der unteren Rep-Grenze       → −5 % (kurzer Deload)
 *
 * Reine Funktion — keine DB-Zugriffe.
 */

export type LoggedSet = {
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
};

export type ProgressionDecision = {
  action: "progress" | "hold" | "deload";
  next_weight_kg: number | null;
  /** Ein Wert pro Working-Set, kommasepariert für target_weights. */
  next_target_weights: string | null;
  reason: string;
};

export type ProgressionInput = {
  exerciseName: string;
  sets: LoggedSet[];
  /** z. B. "6-8", "8-12", "12-15". */
  repRange: string;
  targetSets: number;
};

/** Rep-Range "8-12" → {min:8, max:12}. Toleriert "8–12", "8" (single). */
export function parseRepRange(range: string): { min: number; max: number } {
  const s = String(range ?? "").replace(/[–—]/g, "-").trim();
  const m = s.match(/(\d+)\s*-\s*(\d+)/);
  if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
  const single = s.match(/(\d+)/);
  if (single) {
    const v = parseInt(single[1], 10);
    return { min: v, max: v };
  }
  return { min: 8, max: 12 };
}

/** Passenden Gewichts-Sprung wählen basierend auf Übungstyp. */
export function incrementFor(exerciseName: string, currentWeightKg: number): number {
  const n = exerciseName.toLowerCase();
  // Kurzhantel-Paar: +1 kg pro Seite → +2 kg gesamt
  if (/kurzhantel|dumbbell|\bkh\b|\bdb\b/.test(n)) return 2;
  // Kleine Isolationen: +2,5 kg
  if (/(seitheb|reverse ?fly|face ?pull|curl|trizeps|triceps|bizeps|biceps|wadenheb|calf)/.test(n)) return 2.5;
  // Große Compounds mit LH/Maschine: +5 kg bei ≥60 kg, sonst +2,5
  if (/(kniebeuge|squat|kreuzheb|deadlift|beinpresse|leg[- ]?press|hip ?thrust)/.test(n)) {
    return currentWeightKg >= 60 ? 5 : 2.5;
  }
  // Alles andere: +2,5 kg
  return 2.5;
}

function roundStep(v: number, step: number): number {
  return Math.round(v / step) * step;
}

export function progressExerciseAfterSession(input: ProgressionInput): ProgressionDecision {
  const { min, max } = parseRepRange(input.repRange);

  const workingSets = input.sets
    .filter((s) => Number.isFinite(s.reps ?? NaN))
    .slice(0, input.targetSets);

  if (workingSets.length === 0) {
    return {
      action: "hold",
      next_weight_kg: null,
      next_target_weights: null,
      reason: "Keine Sets geloggt — Vorschlag unverändert.",
    };
  }

  // Referenzgewicht: höchstes tatsächlich verwendetes Gewicht des Top-Sets.
  const weights = workingSets
    .map((s) => Number(s.weight_kg))
    .filter((n) => Number.isFinite(n) && n > 0);
  const topWeight = weights.length ? Math.max(...weights) : null;

  const allAtOrAboveMax = workingSets.every((s) => (s.reps ?? 0) >= max);
  const anyBelowMin = workingSets.some((s) => (s.reps ?? 0) < min);

  const step = topWeight != null && topWeight > 0 ? (incrementFor(input.exerciseName, topWeight) >= 5 ? 2.5 : 2.5) : 2.5;

  const buildLine = (kg: number | null): string | null => {
    if (kg == null) return null;
    const val = Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
    return Array(Math.max(1, input.targetSets)).fill(val).join(",");
  };

  // Bodyweight / weight not tracked → nur Rep-Progression sinnvoll
  if (topWeight == null) {
    return {
      action: allAtOrAboveMax ? "progress" : anyBelowMin ? "deload" : "hold",
      next_weight_kg: null,
      next_target_weights: null,
      reason: allAtOrAboveMax
        ? "Reps erreicht — nächste Session +1–2 Wdh oder schwerere Variante."
        : anyBelowMin
        ? "Reps unter Ziel — Ausführung/Regeneration prüfen."
        : "Im Zielbereich — Volumen halten.",
    };
  }

  if (allAtOrAboveMax) {
    const inc = incrementFor(input.exerciseName, topWeight);
    const next = roundStep(topWeight + inc, step);
    return {
      action: "progress",
      next_weight_kg: next,
      next_target_weights: buildLine(next),
      reason: `Alle Sätze ≥ ${max} Wdh → +${inc} kg (${topWeight} → ${next} kg).`,
    };
  }

  if (anyBelowMin) {
    const next = roundStep(topWeight * 0.95, step);
    return {
      action: "deload",
      next_weight_kg: next,
      next_target_weights: buildLine(next),
      reason: `Ein Satz < ${min} Wdh → kurzer Deload auf ${next} kg (−5 %).`,
    };
  }

  return {
    action: "hold",
    next_weight_kg: topWeight,
    next_target_weights: buildLine(topWeight),
    reason: `Im Zielbereich ${min}–${max} — Gewicht ${topWeight} kg halten, nächste Woche +1 Wdh anpeilen.`,
  };
}
