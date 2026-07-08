/**
 * Smart-Progression: Auswertung einer abgeschlossenen Übung.
 *
 * Wird pro Übung EINMAL beim Session-Abschluss aufgerufen. Bewertet ALLE
 * Working-Sets gemeinsam (Gewicht, Reps, RPE, Satzabfall, Ziel-Reprange) und
 * gibt eine nachvollziehbare Progressionsentscheidung zurück. Keine DB-Zugriffe.
 */

export type LoggedSet = {
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
};

export type ProgressionAction =
  | "increase_load"
  | "keep_load"
  | "reduce_load"
  | "increase_reps_target"
  | "reduce_volume"
  | "hold_for_more_data";

export type ProgressionDecision = {
  action: ProgressionAction;
  previous_load: number | null;
  next_load: number | null;
  /** Ein Wert pro Working-Set, kommasepariert für target_weights. */
  next_target_weights: string | null;
  /** Optional angepasstes Ziel-Rep-Schema (z. B. "10-12" → "12"). */
  next_target_reps: string | null;
  reason: string;
};

export type ProgressionInput = {
  exerciseName: string;
  sets: LoggedSet[];
  /** z. B. "6-8", "8-12", "12-15". */
  repRange: string;
  targetSets: number;
  /** Optional: Ziel-RIR aus Plan (z. B. 2 → RPE ~8). */
  targetRir?: number | null;
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
  if (/kurzhantel|dumbbell|\bkh\b|\bdb\b/.test(n)) return 2;
  if (/(seitheb|reverse ?fly|face ?pull|curl|trizeps|triceps|bizeps|biceps|wadenheb|calf)/.test(n)) return 2.5;
  if (/(kniebeuge|squat|kreuzheb|deadlift|beinpresse|leg[- ]?press|hip ?thrust)/.test(n)) {
    return currentWeightKg >= 60 ? 5 : 2.5;
  }
  return 2.5;
}

function roundStep(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function fmtNum(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function avg(nums: number[]): number | null {
  const clean = nums.filter((n) => Number.isFinite(n));
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

export function progressExerciseAfterSession(input: ProgressionInput): ProgressionDecision {
  const { min, max } = parseRepRange(input.repRange);
  const targetSets = Math.max(1, input.targetSets || input.sets.length || 3);

  const working = input.sets
    .filter((s) => Number.isFinite(s.reps ?? NaN))
    .slice(0, targetSets);

  // 1) Zu wenig Daten
  if (working.length < Math.min(2, targetSets)) {
    return {
      action: "hold_for_more_data",
      previous_load: null,
      next_load: null,
      next_target_weights: null,
      next_target_reps: null,
      reason: `Nur ${working.length} von ${targetSets} Working-Sets geloggt — keine Entscheidung.`,
    };
  }

  const weights = working.map((s) => Number(s.weight_kg)).filter((n) => Number.isFinite(n) && n > 0);
  const topWeight = weights.length ? Math.max(...weights) : null;
  const repsArr = working.map((s) => Number(s.reps) || 0);
  const firstReps = repsArr[0] ?? 0;
  const lastReps = repsArr[repsArr.length - 1] ?? 0;
  const avgReps = avg(repsArr) ?? 0;

  const rpeArr = working.map((s) => Number(s.rpe)).filter((n) => Number.isFinite(n) && n > 0);
  const avgRpe = avg(rpeArr);
  const maxRpe = rpeArr.length ? Math.max(...rpeArr) : null;

  const allAtOrAboveMax = working.every((s) => (s.reps ?? 0) >= max);
  const anyBelowMin = working.some((s) => (s.reps ?? 0) < min);
  const dropRatio = firstReps > 0 ? lastReps / firstReps : 1;
  const bigDropoff = firstReps >= min && dropRatio <= 0.6; // z. B. 12 → 6

  const rpeSuffix = avgRpe != null ? ` Durchschnitt-RPE ${avgRpe.toFixed(1)}.` : "";
  const dropSuffix =
    firstReps > 0 && lastReps > 0 ? ` Satzabfall ${firstReps}→${lastReps} Wdh.` : "";

  const step = 2.5;
  const buildLine = (kg: number | null): string | null => {
    if (kg == null) return null;
    return Array(targetSets).fill(fmtNum(kg)).join(",");
  };

  // 2) Bodyweight / kein Gewicht → nur Rep-Progression
  if (topWeight == null) {
    if (allAtOrAboveMax) {
      return {
        action: "increase_reps_target",
        previous_load: null,
        next_load: null,
        next_target_weights: null,
        next_target_reps: String(max + 1),
        reason: `Alle Sätze ≥ ${max} Wdh ohne Zusatzgewicht — Ziel-Reprange auf ${max + 1} anheben.${rpeSuffix}`,
      };
    }
    if (anyBelowMin) {
      return {
        action: "reduce_volume",
        previous_load: null,
        next_load: null,
        next_target_weights: null,
        next_target_reps: null,
        reason: `Sätze unter ${min} Wdh — Volumen reduzieren, Ausführung prüfen.${dropSuffix}${rpeSuffix}`,
      };
    }
    return {
      action: "keep_load",
      previous_load: null,
      next_load: null,
      next_target_weights: null,
      next_target_reps: null,
      reason: `Im Zielbereich ${min}–${max} Wdh (Ø ${avgReps.toFixed(1)}) — Vorgabe halten.${rpeSuffix}`,
    };
  }

  // 3) Starker Satzabfall + hohes RPE → Belastung reduzieren
  if (bigDropoff && (maxRpe == null || maxRpe >= 9)) {
    const next = roundStep(topWeight * 0.9, step);
    return {
      action: "reduce_load",
      previous_load: topWeight,
      next_load: next,
      next_target_weights: buildLine(next),
      next_target_reps: null,
      reason: `Starker Wiederholungsabfall${dropSuffix}${
        maxRpe != null ? ` bei Max-RPE ${maxRpe.toFixed(1)}` : ""
      }. Gewicht auf ${fmtNum(next)} kg reduzieren.`,
    };
  }

  // 4) Alle Sätze ≥ Rep-Max UND RPE nicht überkritisch → Gewicht rauf
  if (allAtOrAboveMax && (avgRpe == null || avgRpe <= 9)) {
    const inc = incrementFor(input.exerciseName, topWeight);
    const next = roundStep(topWeight + inc, step);
    return {
      action: "increase_load",
      previous_load: topWeight,
      next_load: next,
      next_target_weights: buildLine(next),
      next_target_reps: null,
      reason: `Alle ${working.length} Working-Sets erreichten ≥ ${max} Wdh${
        avgRpe != null ? ` bei Ø-RPE ${avgRpe.toFixed(1)}` : ""
      }. Gewicht wird erhöht: ${fmtNum(topWeight)} → ${fmtNum(next)} kg (+${inc}).`,
    };
  }

  // 5) Reps erreicht, aber RPE zu hoch → halten
  if (allAtOrAboveMax && avgRpe != null && avgRpe > 9) {
    return {
      action: "keep_load",
      previous_load: topWeight,
      next_load: topWeight,
      next_target_weights: buildLine(topWeight),
      next_target_reps: null,
      reason: `Reps erreicht, aber Ø-RPE ${avgRpe.toFixed(1)} zu hoch — Gewicht ${fmtNum(topWeight)} kg halten und Technik/Regeneration festigen.`,
    };
  }

  // 6) Sätze unter Rep-Min ohne extreme Dropoff → Volumen reduzieren
  if (anyBelowMin) {
    return {
      action: "reduce_volume",
      previous_load: topWeight,
      next_load: topWeight,
      next_target_weights: buildLine(topWeight),
      next_target_reps: null,
      reason: `Mindestens ein Satz unter ${min} Wdh${dropSuffix}${rpeSuffix} — Gewicht halten, Volumen/Pausen prüfen.`,
    };
  }

  // 7) Alles im Zielbereich → halten
  return {
    action: "keep_load",
    previous_load: topWeight,
    next_load: topWeight,
    next_target_weights: buildLine(topWeight),
    next_target_reps: null,
    reason: `Im Zielbereich ${min}–${max} Wdh (Ø ${avgReps.toFixed(1)})${rpeSuffix} — Gewicht ${fmtNum(topWeight)} kg halten.`,
  };
}
