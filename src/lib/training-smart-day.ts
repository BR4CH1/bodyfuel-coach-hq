import type {
  BuilderTrainingDay,
  BuilderTrainingExercise,
  CustomerTrainingContext,
  LibraryExercise,
} from "@/lib/training-plan-builder.functions";

export type SmartDayFocus =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "push"
  | "pull"
  | "upper"
  | "lower"
  | "fullbody";

export const SMART_DAY_PRESETS: Array<{ key: SmartDayFocus; label: string }> = [
  { key: "chest", label: "Brust" },
  { key: "back", label: "Rücken" },
  { key: "legs", label: "Beine" },
  { key: "shoulders", label: "Schultern" },
  { key: "arms", label: "Arme" },
  { key: "push", label: "Push" },
  { key: "pull", label: "Pull" },
  { key: "upper", label: "Oberkörper" },
  { key: "lower", label: "Unterkörper" },
  { key: "fullbody", label: "Ganzkörper" },
];

type CanonicalPattern =
  | "push_h"
  | "push_v"
  | "pull_h"
  | "pull_v"
  | "squat"
  | "hinge"
  | "lunge"
  | "core"
  | "isolation"
  | "carry"
  | "cardio"
  | "other";

type GoalMode = "strength" | "hypertrophy" | "fatloss" | "general";

type SmartSlot = {
  patterns?: CanonicalPattern[];
  muscles?: string[];
  hints?: RegExp[];
};

const PRESET_SLOTS: Record<SmartDayFocus, SmartSlot[]> = {
  chest: [
    { patterns: ["push_h"], muscles: ["chest", "upper_chest"] },
    { patterns: ["push_h"], muscles: ["chest", "upper_chest"] },
    { muscles: ["chest", "upper_chest"], hints: [/fly|flieg|butterfly|pec/i] },
    { muscles: ["chest", "upper_chest"] },
    { muscles: ["triceps"] },
  ],
  back: [
    { patterns: ["pull_v"], muscles: ["lats", "back"] },
    { patterns: ["pull_h"], muscles: ["back", "lats"] },
    { patterns: ["pull_v"], muscles: ["lats", "back"] },
    { patterns: ["pull_h"], muscles: ["back", "lats", "traps"] },
    { muscles: ["rear_delts", "traps", "back"] },
    { muscles: ["biceps"] },
  ],
  legs: [
    { patterns: ["squat", "lunge"], muscles: ["quads", "glutes"] },
    { muscles: ["quads"] },
    { patterns: ["hinge"], muscles: ["hamstrings", "glutes"] },
    { muscles: ["hamstrings"] },
    { muscles: ["glutes", "adductors", "abductors"] },
    { muscles: ["calves"] },
  ],
  shoulders: [
    { patterns: ["push_v"], muscles: ["shoulders", "front_delts"] },
    { muscles: ["side_delts", "shoulders"], hints: [/seitheb|lateral/i] },
    { muscles: ["side_delts", "shoulders"] },
    { muscles: ["rear_delts"], hints: [/reverse|rear|face pull/i] },
    { muscles: ["rear_delts", "traps"] },
  ],
  arms: [
    { muscles: ["biceps"] },
    { muscles: ["triceps"] },
    { muscles: ["biceps"] },
    { muscles: ["triceps"] },
    { muscles: ["biceps", "forearms"] },
    { muscles: ["triceps"] },
  ],
  push: [
    { patterns: ["push_h"], muscles: ["chest", "upper_chest"] },
    { patterns: ["push_h"], muscles: ["chest", "upper_chest"] },
    { patterns: ["push_v"], muscles: ["shoulders", "front_delts"] },
    { muscles: ["side_delts", "shoulders"] },
    { muscles: ["triceps"] },
    { muscles: ["triceps"] },
  ],
  pull: [
    { patterns: ["pull_v"], muscles: ["lats", "back"] },
    { patterns: ["pull_h"], muscles: ["back", "lats"] },
    { patterns: ["pull_v"], muscles: ["lats", "back"] },
    { patterns: ["pull_h"], muscles: ["back", "traps"] },
    { muscles: ["rear_delts"] },
    { muscles: ["biceps"] },
  ],
  upper: [
    { patterns: ["push_h"], muscles: ["chest", "upper_chest"] },
    { patterns: ["pull_v"], muscles: ["lats", "back"] },
    { patterns: ["pull_h"], muscles: ["back", "lats"] },
    { patterns: ["push_v"], muscles: ["shoulders", "front_delts"] },
    { muscles: ["side_delts", "rear_delts"] },
    { muscles: ["biceps", "triceps"] },
  ],
  lower: [
    { patterns: ["squat", "lunge"], muscles: ["quads", "glutes"] },
    { muscles: ["quads"] },
    { patterns: ["hinge"], muscles: ["hamstrings", "glutes"] },
    { muscles: ["hamstrings"] },
    { muscles: ["glutes"] },
    { muscles: ["calves", "core"] },
  ],
  fullbody: [
    { patterns: ["squat", "lunge"], muscles: ["quads", "glutes"] },
    { patterns: ["push_h"], muscles: ["chest", "upper_chest"] },
    { patterns: ["pull_v"], muscles: ["lats", "back"] },
    { patterns: ["pull_h"], muscles: ["back", "lats"] },
    { patterns: ["push_v"], muscles: ["shoulders"] },
    { patterns: ["hinge"], muscles: ["hamstrings", "glutes"] },
    { patterns: ["core"], muscles: ["core", "obliques"] },
  ],
};

function canonicalPattern(raw: string | null | undefined): CanonicalPattern {
  const p = (raw ?? "").trim().toLowerCase();
  if (["push_h", "horizontal_push", "horizontal push"].includes(p)) return "push_h";
  if (["push_v", "vertical_push", "vertical push"].includes(p)) return "push_v";
  if (["pull_h", "horizontal_pull", "horizontal pull"].includes(p)) return "pull_h";
  if (["pull_v", "vertical_pull", "vertical pull"].includes(p)) return "pull_v";
  if (p.includes("squat")) return "squat";
  if (p.includes("hinge")) return "hinge";
  if (p.includes("lunge")) return "lunge";
  if (p.includes("core")) return "core";
  if (p.includes("isol")) return "isolation";
  if (p.includes("carry")) return "carry";
  if (p.includes("cardio")) return "cardio";
  return "other";
}

function goalMode(goal: string | null): GoalMode {
  const g = (goal ?? "").toLowerCase();
  if (/kraft|strength|maximalkraft|stärker/.test(g)) return "strength";
  if (/muskel|hypertroph|aufbau|bodybuilding|masse/.test(g)) return "hypertrophy";
  if (/abnehm|fett|gewicht.*redu|definition|definieren|fat.?loss/.test(g)) return "fatloss";
  return "general";
}

export function hasStrengthTestBaseline(ctx: CustomerTrainingContext | null | undefined): boolean {
  if (!ctx) return false;
  return Object.values(ctx.baseline).some((value) => typeof value === "number" && value > 0);
}

function normalizeMuscle(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isIsolation(exercise: LibraryExercise): boolean {
  const n = exercise.name.toLowerCase();
  return (
    canonicalPattern(exercise.movement_pattern) === "isolation" ||
    /curl|extension|strecken|beugen|seitheb|lateral|fly|flieg|butterfly|pec|kickback|addukt|abdukt|waden|calf/.test(n)
  );
}

function equipmentText(exercise: LibraryExercise): string {
  return `${exercise.category ?? ""} ${(exercise.equipment ?? []).join(" ")}`.toLowerCase();
}

function strengthBaseForExercise(
  exercise: LibraryExercise,
  ctx: CustomerTrainingContext,
): { kg: number; transfer: number } | null {
  const b = ctx.baseline;
  const n = exercise.name.toLowerCase();
  const p = canonicalPattern(exercise.movement_pattern);
  const m = normalizeMuscle(exercise.primary_muscle);
  const equipment = equipmentText(exercise);
  const dumbbell = /dumbbell|kurzhantel/.test(equipment);
  const barbell = /barbell|langhantel/.test(equipment);
  const machine = /machine|maschine|selector|plate/.test(equipment);

  if (/brustpresse|chest press/.test(n) && b.bench_press_kg) return { kg: b.bench_press_kg, transfer: 1 };
  if (/schulterpresse|shoulder press/.test(n) && b.shoulder_press_kg)
    return { kg: b.shoulder_press_kg, transfer: 1 };
  if (/latzug|lat pulldown|pulldown/.test(n) && b.lat_pulldown_kg)
    return { kg: b.lat_pulldown_kg, transfer: 1 };
  if (/rudern|row/.test(n) && b.row_kg) return { kg: b.row_kg, transfer: 1 };
  if (/beinpresse|leg press/.test(n) && b.leg_press_kg) return { kg: b.leg_press_kg, transfer: 1 };
  if (/beinbeuger|leg curl/.test(n) && b.leg_curl_kg) return { kg: b.leg_curl_kg, transfer: 1 };

  if (p === "push_h" || m === "chest" || m === "upper_chest") {
    if (!b.bench_press_kg) return null;
    if (isIsolation(exercise)) return { kg: b.bench_press_kg, transfer: 0.32 };
    return { kg: b.bench_press_kg, transfer: dumbbell ? 0.38 : barbell ? 0.8 : machine ? 0.92 : 0.75 };
  }
  if (p === "push_v" || ["shoulders", "front_delts", "side_delts"].includes(m)) {
    if (!b.shoulder_press_kg) return null;
    if (/seitheb|lateral/.test(n)) return { kg: b.shoulder_press_kg, transfer: 0.18 };
    if (isIsolation(exercise)) return { kg: b.shoulder_press_kg, transfer: 0.28 };
    return { kg: b.shoulder_press_kg, transfer: dumbbell ? 0.42 : barbell ? 0.8 : machine ? 0.92 : 0.75 };
  }
  if (p === "pull_v" || m === "lats") {
    if (!b.lat_pulldown_kg) return null;
    return { kg: b.lat_pulldown_kg, transfer: isIsolation(exercise) ? 0.35 : dumbbell ? 0.45 : 0.9 };
  }
  if (p === "pull_h" || ["back", "traps", "rear_delts"].includes(m)) {
    if (!b.row_kg) return null;
    if (m === "rear_delts" || /reverse|face pull/.test(n)) return { kg: b.row_kg, transfer: 0.3 };
    return { kg: b.row_kg, transfer: isIsolation(exercise) ? 0.35 : dumbbell ? 0.45 : 0.9 };
  }
  if (["biceps", "forearms"].includes(m)) {
    const base = b.row_kg ?? b.lat_pulldown_kg;
    return base ? { kg: base, transfer: dumbbell ? 0.18 : 0.28 } : null;
  }
  if (m === "triceps") {
    const base = b.bench_press_kg ?? b.shoulder_press_kg;
    return base ? { kg: base, transfer: dumbbell ? 0.18 : 0.28 } : null;
  }
  if (p === "squat" || p === "lunge" || ["quads", "glutes"].includes(m)) {
    if (!b.leg_press_kg) return null;
    if (/beinstrecker|leg extension/.test(n)) return { kg: b.leg_press_kg, transfer: 0.36 };
    if (p === "lunge") return { kg: b.leg_press_kg, transfer: dumbbell ? 0.12 : 0.3 };
    return { kg: b.leg_press_kg, transfer: machine ? 0.75 : barbell ? 0.45 : dumbbell ? 0.18 : 0.55 };
  }
  if (m === "hamstrings" || p === "hinge") {
    if (/curl|beuger/.test(n) && b.leg_curl_kg) return { kg: b.leg_curl_kg, transfer: 1 };
    return null;
  }
  if (m === "calves" && b.leg_press_kg) return { kg: b.leg_press_kg, transfer: 0.45 };
  return null;
}

function roundLoad(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const rounded = Math.max(2.5, Math.round(value / 2.5) * 2.5);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function weekLoadFactor(week: number): number {
  const phase = ((Math.max(1, week) - 1) % 4) + 1;
  if (phase === 2) return 1.025;
  if (phase === 3) return 1.05;
  if (phase === 4) return 0.9;
  return 1;
}

function programmingFor(
  exercise: LibraryExercise,
  ctx: CustomerTrainingContext,
  week: number,
): Pick<BuilderTrainingExercise, "target_sets" | "target_reps" | "target_weights" | "target_rir" | "rest_seconds"> {
  const mode = goalMode(ctx.mainGoal);
  const isolation = isIsolation(exercise);
  let sets = 3;
  let reps = isolation ? "10-15" : "8-12";
  let rir = 2;
  let rest = isolation ? 75 : 120;
  let loadFactor = 0.92;

  if (mode === "strength") {
    sets = isolation ? 3 : 4;
    reps = isolation ? "8-12" : "5-8";
    rir = 2;
    rest = isolation ? 90 : 180;
    loadFactor = isolation ? 0.92 : 1.06;
  } else if (mode === "hypertrophy") {
    sets = isolation ? 3 : 4;
    reps = isolation ? "10-15" : "8-12";
    rir = 2;
    rest = isolation ? 75 : 120;
    loadFactor = isolation ? 0.88 : 0.96;
  } else if (mode === "fatloss") {
    sets = 3;
    reps = isolation ? "12-15" : "10-12";
    rir = 2;
    rest = isolation ? 60 : 90;
    loadFactor = 0.84;
  }

  const base = strengthBaseForExercise(exercise, ctx);
  const targetWeight = base
    ? roundLoad(base.kg * base.transfer * loadFactor * weekLoadFactor(week))
    : null;

  return {
    target_sets: sets,
    target_reps: reps,
    target_weights: targetWeight,
    target_rir: rir,
    rest_seconds: rest,
  };
}

function candidateScore(
  exercise: LibraryExercise,
  slot: SmartSlot,
  ctx: CustomerTrainingContext,
): number {
  const pattern = canonicalPattern(exercise.movement_pattern);
  const muscle = normalizeMuscle(exercise.primary_muscle);
  const name = exercise.name.toLowerCase();
  let score = 0;

  if (slot.patterns?.includes(pattern)) score += 90;
  if (slot.muscles?.map(normalizeMuscle).includes(muscle)) score += 75;
  if (slot.hints?.some((rx) => rx.test(name))) score += 45;
  if (strengthBaseForExercise(exercise, ctx)) score += 18;

  const mode = goalMode(ctx.mainGoal);
  if (mode === "strength" && !isIsolation(exercise)) score += 8;
  if (mode === "hypertrophy" && isIsolation(exercise)) score += 3;
  if (exercise.difficulty === "beginner") score += 3;
  if (exercise.difficulty === "advanced") score -= 3;

  const equipment = equipmentText(exercise);
  if ((ctx.bodyweightKg ?? 0) >= 100 && /bodyweight|körpergewicht/.test(equipment)) score -= 14;
  return score;
}

function slotMatches(exercise: LibraryExercise, slot: SmartSlot): boolean {
  const pattern = canonicalPattern(exercise.movement_pattern);
  const muscle = normalizeMuscle(exercise.primary_muscle);
  const name = exercise.name.toLowerCase();
  return Boolean(
    slot.patterns?.includes(pattern) ||
      slot.muscles?.map(normalizeMuscle).includes(muscle) ||
      slot.hints?.some((rx) => rx.test(name)),
  );
}

function toBuilderExercise(
  exercise: LibraryExercise,
  ctx: CustomerTrainingContext,
  week: number,
): BuilderTrainingExercise {
  const programming = programmingFor(exercise, ctx, week);
  return {
    library_exercise_id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    ...programming,
    notes: exercise.notes,
    is_locked: false,
    smart_lock: "none",
    linked_partner_group: null,
  };
}

function pickForSlot(
  library: LibraryExercise[],
  slot: SmartSlot,
  ctx: CustomerTrainingContext,
  used: Set<string>,
): LibraryExercise | null {
  const candidates = library
    .filter((exercise) => exercise.is_active !== false && !used.has(exercise.id) && slotMatches(exercise, slot))
    .map((exercise) => ({ exercise, score: candidateScore(exercise, slot, ctx) }))
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, "de"));
  return candidates[0]?.exercise ?? null;
}

export function buildSmartTrainingDay(args: {
  ctx: CustomerTrainingContext;
  library: LibraryExercise[];
  day: BuilderTrainingDay;
  focus: SmartDayFocus;
}): BuilderTrainingDay {
  const { ctx, library, day, focus } = args;
  if (!hasStrengthTestBaseline(ctx)) {
    throw new Error("Für Smart Days ist zuerst ein abgeschlossener Strength Test erforderlich.");
  }

  const locked = day.exercises.filter(
    (exercise) => exercise.is_locked || exercise.smart_lock === "locked",
  );
  const used = new Set(locked.map((exercise) => exercise.library_exercise_id).filter(Boolean) as string[]);
  const generated: BuilderTrainingExercise[] = [];

  for (const slot of PRESET_SLOTS[focus]) {
    const picked = pickForSlot(library, slot, ctx, used);
    if (!picked) continue;
    used.add(picked.id);
    generated.push(toBuilderExercise(picked, ctx, day.week_number));
  }

  const presetLabel = SMART_DAY_PRESETS.find((item) => item.key === focus)?.label ?? "Training";
  return {
    ...day,
    type: "training",
    name: presetLabel,
    exercises: [...locked, ...generated],
  };
}

export function smartSwapExercise(args: {
  ctx: CustomerTrainingContext;
  library: LibraryExercise[];
  current: BuilderTrainingExercise;
  week: number;
  usedLibraryIds?: string[];
}): BuilderTrainingExercise | null {
  const { ctx, library, current, week, usedLibraryIds = [] } = args;
  if (!hasStrengthTestBaseline(ctx)) return null;
  if (current.is_locked || current.smart_lock === "locked") return null;

  const currentLibrary = current.library_exercise_id
    ? library.find((exercise) => exercise.id === current.library_exercise_id)
    : library.find((exercise) => exercise.name.trim().toLowerCase() === current.name.trim().toLowerCase());
  if (!currentLibrary) return null;

  const pattern = canonicalPattern(currentLibrary.movement_pattern);
  const muscle = normalizeMuscle(currentLibrary.primary_muscle);
  const used = new Set(usedLibraryIds.filter(Boolean));
  used.delete(currentLibrary.id);

  const candidates = library
    .filter((exercise) => {
      if (exercise.id === currentLibrary.id || used.has(exercise.id) || exercise.is_active === false) return false;
      const samePattern = canonicalPattern(exercise.movement_pattern) === pattern && pattern !== "other";
      const sameMuscle = normalizeMuscle(exercise.primary_muscle) === muscle && Boolean(muscle);
      return samePattern || sameMuscle;
    })
    .map((exercise) => {
      let score = 0;
      if (canonicalPattern(exercise.movement_pattern) === pattern) score += 80;
      if (normalizeMuscle(exercise.primary_muscle) === muscle) score += 60;
      if (strengthBaseForExercise(exercise, ctx)) score += 15;
      return { exercise, score };
    })
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, "de"));

  const replacement = candidates[0]?.exercise;
  if (!replacement) return null;
  const smart = toBuilderExercise(replacement, ctx, week);
  return {
    ...smart,
    target_sets: current.target_sets ?? smart.target_sets,
    target_reps: current.target_reps ?? smart.target_reps,
    target_rir: current.target_rir ?? smart.target_rir,
    rest_seconds: current.rest_seconds ?? smart.rest_seconds,
    smart_lock: current.smart_lock ?? "none",
  };
}
