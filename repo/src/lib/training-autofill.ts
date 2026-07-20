// Client-side auto-fill helper for the manual training plan builder.
// Pure function — no server call. Uses a curated exercise library +
// simple movement-pattern split logic based on training frequency.

import type {
  BuilderTrainingDay,
  BuilderTrainingExercise,
  CustomerTrainingContext,
  LibraryExercise,
} from "./training-plan-builder.functions";

type MP = "squat" | "hinge" | "lunge" | "push_h" | "push_v" | "pull_h" | "pull_v" | "core" | "carry" | "cardio" | "isolation";

const WEEK_CAP_FACTOR: Record<number, number> = { 1: 1.0, 2: 1.05, 3: 1.10, 4: 1.0 /* deload */ };

function weekFactor(week: number): number {
  return WEEK_CAP_FACTOR[week] ?? 1.0;
}

function pickByPattern(lib: LibraryExercise[], mp: MP, exclude: Set<string>): LibraryExercise | null {
  const pool = lib.filter((e) => (e.movement_pattern as MP) === mp && !exclude.has(e.id));
  if (!pool.length) return null;
  // Prefer beginner/intermediate barbell/machine over advanced first
  const sorted = [...pool].sort((a, b) => {
    const rank = (x: LibraryExercise) =>
      (x.difficulty === "beginner" ? 0 : x.difficulty === "intermediate" ? 1 : 2) +
      (x.category === "machine" ? 0 : 0.1);
    return rank(a) - rank(b);
  });
  return sorted[0];
}

function baselineForExercise(name: string, ctx: CustomerTrainingContext): number | null {
  const n = name.toLowerCase();
  const b = ctx.baseline;
  if (/(bankdr|bench)/.test(n)) return b.bench_press_kg;
  if (/(schulterpr|shoulder|overhead|military)/.test(n)) return b.shoulder_press_kg;
  if (/(kniebeuge|squat)/.test(n)) return b.squat_kg;
  if (/(kreuzheb|deadlift|rdl|rum(ä|a)nisch)/.test(n)) return b.deadlift_kg;
  if (/(latzug|pulldown)/.test(n)) return b.lat_pulldown_kg;
  if (/(rudern|row)/.test(n)) return b.row_kg;
  if (/(beinpresse|leg[- ]?press|hackenschmidt)/.test(n)) return b.leg_press_kg;
  if (/(beinbeuger|leg[- ]?curl)/.test(n)) return b.leg_curl_kg;
  return null;
}

function toBuilderEx(lib: LibraryExercise, ctx: CustomerTrainingContext, week: number): BuilderTrainingExercise {
  const base = baselineForExercise(lib.name, ctx);
  const factor = weekFactor(week);
  let weightStr: string | null = null;
  if (base && base > 0) {
    const w = Math.max(2.5, Math.round((base * factor) / 2.5) * 2.5);
    weightStr = Number.isInteger(w) ? String(w) : w.toFixed(1);
  }
  return {
    library_exercise_id: lib.id,
    name: lib.name,
    category: lib.category,
    target_sets: lib.default_sets,
    target_reps: lib.default_reps,
    target_weights: weightStr,
    target_rir: 2,
    rest_seconds: lib.default_rest_seconds,
    notes: lib.notes,
    is_locked: false,
    linked_partner_group: null,
  };
}

// Split templates by training day count per week
const SPLITS: Record<number, MP[][]> = {
  1: [["squat", "push_h", "pull_h", "core"]],
  2: [
    ["squat", "push_h", "pull_h", "core"],
    ["hinge", "push_v", "pull_v", "core"],
  ],
  3: [
    ["squat", "hinge", "core"],                 // Legs
    ["push_h", "push_v", "isolation"],          // Push
    ["pull_h", "pull_v", "isolation"],          // Pull
  ],
  4: [
    ["push_h", "push_v", "isolation"],          // Upper A (Push)
    ["squat", "hinge", "core"],                 // Lower A
    ["pull_h", "pull_v", "isolation"],          // Upper B (Pull)
    ["lunge", "hinge", "core"],                 // Lower B
  ],
  5: [
    ["push_h", "push_v", "isolation"],
    ["pull_h", "pull_v", "isolation"],
    ["squat", "hinge", "core"],
    ["push_h", "push_v", "isolation"],
    ["pull_h", "pull_v", "isolation"],
  ],
  6: [
    ["push_h", "push_v"],
    ["pull_h", "pull_v"],
    ["squat", "hinge"],
    ["push_h", "isolation"],
    ["pull_h", "isolation"],
    ["lunge", "core"],
  ],
};

function focusLabel(day: MP[]): string {
  if (day.includes("squat") || day.includes("hinge") || day.includes("lunge")) return "Unterkörper";
  if (day.includes("push_h") && day.includes("pull_h")) return "Ganzkörper";
  if (day.includes("push_h") || day.includes("push_v")) return "Push";
  if (day.includes("pull_h") || day.includes("pull_v")) return "Pull";
  if (day.includes("core")) return "Core";
  return "Training";
}

const WD_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function autoFillTrainingPlan(
  ctx: CustomerTrainingContext,
  library: LibraryExercise[],
  weeksCount: number,
  weekdays: number[], // training weekdays (0..6)
  existing?: BuilderTrainingDay[],
): BuilderTrainingDay[] {
  const trainingCount = Math.max(1, Math.min(6, weekdays.length));
  const split = SPLITS[trainingCount] ?? SPLITS[3];
  const sortedWd = [...weekdays].sort((a, b) => {
    // Mo..So order
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.indexOf(a) - order.indexOf(b);
  });

  const preserveLocked = new Map<string, BuilderTrainingExercise[]>();
  if (existing) {
    for (const d of existing) {
      const locked = d.exercises?.filter((e) => e.is_locked) ?? [];
      if (locked.length) preserveLocked.set(`${d.week_number}:${d.weekday}`, locked);
    }
  }

  const out: BuilderTrainingDay[] = [];
  for (let w = 1; w <= weeksCount; w++) {
    // Every weekday 0..6
    for (let wd = 0; wd < 7; wd++) {
      const isTraining = sortedWd.includes(wd);
      if (!isTraining) {
        out.push({ week_number: w, weekday: wd, name: `${WD_SHORT[wd]} — Ruhetag`, type: "rest", exercises: [] });
        continue;
      }
      const dayIdx = sortedWd.indexOf(wd);
      const patterns = split[dayIdx % split.length];
      const locked = preserveLocked.get(`${w}:${wd}`) ?? [];
      const usedLib = new Set<string>(locked.map((l) => l.library_exercise_id ?? "").filter(Boolean));
      const exercises: BuilderTrainingExercise[] = [...locked];
      for (const mp of patterns) {
        const lib = pickByPattern(library, mp, usedLib);
        if (!lib) continue;
        usedLib.add(lib.id);
        exercises.push(toBuilderEx(lib, ctx, w));
      }
      out.push({
        week_number: w,
        weekday: wd,
        name: `${WD_SHORT[wd]} — ${focusLabel(patterns)}${w === 4 ? " (Deload)" : ""}`,
        type: "training",
        exercises,
      });
    }
  }
  return out;
}

export function emptyPlan(weeksCount: number, weekdays: number[]): BuilderTrainingDay[] {
  const out: BuilderTrainingDay[] = [];
  for (let w = 1; w <= weeksCount; w++) {
    for (let wd = 0; wd < 7; wd++) {
      const isTraining = weekdays.includes(wd);
      out.push({
        week_number: w,
        weekday: wd,
        name: `${WD_SHORT[wd]} — ${isTraining ? "Training" : "Ruhetag"}`,
        type: isTraining ? "training" : "rest",
        exercises: [],
      });
    }
  }
  return out;
}
