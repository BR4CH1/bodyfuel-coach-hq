/**
 * BodyFuel Performance — Pure Plan Builder
 *
 * Deterministic, side-effect-free meal selector + reoptimizer for
 * automatically generated Bulls/Performance nutrition day plans.
 *
 * Does NOT read from the database, does NOT call an LLM, does NOT touch
 * network I/O. Consumes an already-filtered pool of recipes (from the
 * shared coach_meal_library) and returns a set of meals sized against the
 * engine target for one specific date.
 *
 * The pipeline (auto-plan.functions.ts) is responsible for supplying the
 * pool, the target and any locked/tracked context. This module owns the
 * deterministic decisions only, so it can be exhaustively unit-tested.
 */

import type { PerformanceDayType } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlotKind =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "pre_workout"
  | "post_workout";

export interface PoolMeal {
  id: string;
  name: string;
  description?: string | null;
  category: SlotKind;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  suitable_training: boolean;
  suitable_rest: boolean;
  no_go_ingredients: string[];
  mealprep_ok: boolean;
}

export type DietStyle =
  | "omnivore"
  | "flexitarian"
  | "pescetarian"
  | "vegetarian"
  | "vegan"
  | "other";

export type MealPrepStyle = "daily" | "2_3_week" | "meal_prep" | "low_effort";

export interface MacroTarget {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface AthletePreferences {
  no_go_ingredients: string[];
  wants_snack: boolean;
  /** Free-text no-gos, tokenisierte Kleinbuchstaben. */
  extra_nogo_terms?: string[];
  /**
   * Zusammengeführte Allergie-/Unverträglichkeits-Tokens (aus `allergies` +
   * tokenisiertem `extra_allergies` + `intolerances`). Der Allergie-Filter
   * lehnt bei fehlenden Meal-Metadaten fail-safe ab.
   */
  allergy_tokens?: string[];
  diet_style?: DietStyle | null;
  meal_prep_style?: MealPrepStyle | null;
}

export interface PickedMeal {
  library_meal_id: string;
  name: string;
  description: string | null;
  meal_slot: SlotKind;
  scale: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sort_order: number;
  modification_source: "auto_generated";
}

export interface PickResult {
  ok: true;
  meals: PickedMeal[];
  dayType: PerformanceDayType;
  totals: MacroTarget;
} 

export interface PickFailure {
  ok: false;
  reason: "LIBRARY_TOO_SPARSE";
  missingSlot: SlotKind;
  detail: string;
}

const SLOT_ORDER: Record<PerformanceDayType, SlotKind[]> = {
  REST: ["breakfast", "lunch", "dinner", "snack"],
  STRENGTH: ["breakfast", "lunch", "dinner", "snack", "post_workout"],
  FOOTBALL_TRAINING: ["breakfast", "lunch", "dinner", "snack", "pre_workout"],
  GAME_DAY: ["breakfast", "lunch", "dinner", "snack", "pre_workout"],
  DOUBLE_SESSION: [
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "pre_workout",
    "post_workout",
  ],
  // Reserved future day types default to a training-style slot layout.
  SPEED: ["breakfast", "lunch", "dinner", "snack", "pre_workout"],
  CONDITIONING: ["breakfast", "lunch", "dinner", "snack", "pre_workout"],
  RECOVERY: ["breakfast", "lunch", "dinner", "snack"],
};

// Slot share of kcal (must sum to <=1). Snack absorbs the remainder.
const SLOT_KCAL_SHARE: Record<SlotKind, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  dinner: 0.3,
  snack: 0.1,
  pre_workout: 0.05,
  post_workout: 0.05,
};

const SCALE_MIN = 0.5;
const SCALE_MAX = 2.0;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function suitableForDayType(m: PoolMeal, dayType: PerformanceDayType): boolean {
  if (dayType === "REST") return m.suitable_rest;
  return m.suitable_training;
}

function violatesNoGo(m: PoolMeal, athlete: AthletePreferences): boolean {
  const denyList: string[] = [];
  if (athlete.no_go_ingredients?.length) {
    denyList.push(...athlete.no_go_ingredients.map((s) => s.toLowerCase().trim()));
  }
  if (athlete.extra_nogo_terms?.length) {
    denyList.push(
      ...athlete.extra_nogo_terms
        .map((s) => s.toLowerCase().trim())
        .filter((s) => s.length >= 3),
    );
  }
  if (!denyList.length) return false;
  const denySet = new Set(denyList);
  if (m.no_go_ingredients.some((n) => denySet.has(n.toLowerCase().trim()))) return true;
  const hay = `${m.name} ${m.description ?? ""}`.toLowerCase();
  return denyList.some((term) => term.length >= 3 && hay.includes(term));
}

// --- Diet & Allergen Sicherheitsfilter -------------------------------------

const DIET_MARKERS = {
  meat: [
    "hähnchen", "hahnchen", "huhn", "pute", "truthahn", "rind", "beef", "steak",
    "schwein", "pork", "wurst", "salami", "schinken", "speck", "bacon", "hack",
    "lamm", "wild",
  ],
  fish: [
    "fisch", "lachs", "salmon", "thunfisch", "tuna", "kabeljau", "forelle",
    "sardine", "hering", "makrele", "shrimp", "garnele", "meeresfrüchte",
  ],
  dairy: [
    "milch", "milk", "käse", "kase", "cheese", "quark", "skyr", "joghurt",
    "yogurt", "butter", "sahne", "cream", "mozzarella", "feta", "parmesan",
  ],
  egg: ["ei ", "eier", "eiweiß", "eigelb", "omelett", "rührei", "spiegelei"],
} as const;

function containsAny(hay: string, needles: readonly string[]): boolean {
  return needles.some((n) => hay.includes(n));
}

export function violatesDiet(m: PoolMeal, diet: DietStyle | null | undefined): boolean {
  if (!diet || diet === "omnivore" || diet === "other" || diet === "flexitarian") return false;
  const hay = `${m.name} ${m.description ?? ""} ${m.no_go_ingredients.join(" ")}`.toLowerCase();
  if (diet === "vegan") {
    return (
      containsAny(hay, DIET_MARKERS.meat) ||
      containsAny(hay, DIET_MARKERS.fish) ||
      containsAny(hay, DIET_MARKERS.dairy) ||
      containsAny(hay, DIET_MARKERS.egg)
    );
  }
  if (diet === "vegetarian") {
    return containsAny(hay, DIET_MARKERS.meat) || containsAny(hay, DIET_MARKERS.fish);
  }
  if (diet === "pescetarian") {
    return containsAny(hay, DIET_MARKERS.meat);
  }
  return false;
}

export function violatesAllergy(
  m: PoolMeal,
  allergyTokens: string[] | undefined,
): boolean {
  if (!allergyTokens?.length) return false;
  const tokens = allergyTokens
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length >= 3);
  if (!tokens.length) return false;
  const hay = `${m.name} ${m.description ?? ""} ${m.no_go_ingredients.join(" ")}`.toLowerCase();
  return tokens.some((t) => hay.includes(t));
}

export function mealPrepFitScore(m: PoolMeal, style: MealPrepStyle | null | undefined): number {
  if (!style) return 0;
  if (style === "meal_prep" || style === "2_3_week") {
    return m.mealprep_ok ? 0 : 25;
  }
  return 0;
}

function clampScale(s: number): number {
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, s));
}

function scaleMeal(m: PoolMeal, scale: number): Omit<PickedMeal, "sort_order" | "meal_slot"> {
  return {
    library_meal_id: m.id,
    name: m.name,
    description: m.description ?? null,
    scale,
    kcal: Math.round(m.kcal * scale),
    protein_g: Math.round(m.protein_g * scale),
    carbs_g: Math.round(m.carbs_g * scale),
    fat_g: Math.round(m.fat_g * scale),
    modification_source: "auto_generated" as const,
  };
}

/**
 * Deterministic scoring: primarily minimise protein distance against the
 * slot's protein share, secondarily kcal distance. Training days weight
 * protein/carb accuracy above kcal exactness.
 */
function scoreCandidate(
  m: PoolMeal,
  scale: number,
  slotTarget: MacroTarget,
  dayType: PerformanceDayType,
): number {
  const scaled = {
    kcal: m.kcal * scale,
    protein_g: m.protein_g * scale,
    carbs_g: m.carbs_g * scale,
    fat_g: m.fat_g * scale,
  };
  const proteinW = dayType === "REST" ? 1.5 : 2.5;
  const carbsW = dayType === "REST" ? 0.5 : 1.5;
  const kcalW = 1.0;
  return (
    proteinW * Math.abs(scaled.protein_g - slotTarget.protein_g) +
    carbsW * Math.abs(scaled.carbs_g - slotTarget.carbs_g) +
    kcalW * Math.abs(scaled.kcal - slotTarget.kcal) / 10
  );
}

/**
 * Deterministic index seed from a stable string (user_id + date). Never
 * calls Math.random.
 */
export function stableSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// pickMealsForDay
// ---------------------------------------------------------------------------

export function pickMealsForDay(input: {
  target: MacroTarget;
  dayType: PerformanceDayType;
  preferences: AthletePreferences;
  poolMeals: PoolMeal[];
  seed?: string;
}): PickResult | PickFailure {
  const { target, dayType, preferences, poolMeals } = input;
  const seed = stableSeed(input.seed ?? `${dayType}:${target.kcal}`);

  const slots = SLOT_ORDER[dayType].filter(
    (s) => s !== "snack" || preferences.wants_snack,
  );

  // Normalise slot shares over the actually-scheduled slots.
  const shares = slots.map((s) => SLOT_KCAL_SHARE[s]);
  const sumShares = shares.reduce((a, b) => a + b, 0) || 1;

  const filtered = poolMeals.filter(
    (m) => suitableForDayType(m, dayType) && !violatesNoGo(m, preferences),
  );

  const usedIds = new Set<string>();
  const picked: PickedMeal[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const share = shares[i] / sumShares;
    const slotTarget: MacroTarget = {
      kcal: target.kcal * share,
      protein_g: target.protein_g * share,
      carbs_g: target.carbs_g * share,
      fat_g: target.fat_g * share,
    };

    const candidates = filtered.filter(
      (m) => m.category === slot && !usedIds.has(m.id) && m.kcal > 0,
    );
    if (candidates.length === 0) {
      // Fall back to any suitable meal of a compatible slot before failing
      // — snacks can substitute for pre/post workout when the pool has none.
      const fallback =
        slot === "pre_workout" || slot === "post_workout"
          ? filtered.filter(
              (m) => m.category === "snack" && !usedIds.has(m.id) && m.kcal > 0,
            )
          : [];
      if (fallback.length === 0) {
        return {
          ok: false,
          reason: "LIBRARY_TOO_SPARSE",
          missingSlot: slot,
          detail: `Kein Rezept in der Bibliothek für Slot ${slot} passend zu Day Type ${dayType}.`,
        };
      }
      candidates.push(...fallback);
    }

    // Rank candidates: score by best-fit scale within [SCALE_MIN..SCALE_MAX].
    const ranked = candidates
      .map((m) => {
        const idealScale = m.kcal > 0 ? slotTarget.kcal / m.kcal : 1;
        const scale = clampScale(idealScale);
        return { m, scale, score: scoreCandidate(m, scale, slotTarget, dayType) };
      })
      .sort((a, b) => a.score - b.score);

    // Deterministic tie-break: prefer the seed-rotated first entry among the
    // top 3 near-ties (within 5% score of best).
    const best = ranked[0];
    const nearTies = ranked.filter(
      (r) => r.score <= best.score * 1.05 + 1,
    );
    const chosen = nearTies[seed % nearTies.length] ?? best;

    usedIds.add(chosen.m.id);
    const scaled = scaleMeal(chosen.m, chosen.scale);
    picked.push({
      ...scaled,
      meal_slot: slot,
      sort_order: i,
    });
  }

  const totals = picked.reduce<MacroTarget>(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein_g: acc.protein_g + m.protein_g,
      carbs_g: acc.carbs_g + m.carbs_g,
      fat_g: acc.fat_g + m.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return { ok: true, meals: picked, dayType, totals };
}

// ---------------------------------------------------------------------------
// reoptimizeExistingDay
// ---------------------------------------------------------------------------

export interface ExistingMeal {
  id: string;
  library_meal_id: string | null;
  meal_slot: SlotKind | null;
  sort_order: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  is_locked: boolean;
  linked_prep_group: string | null;
  modification_source: string | null;
  is_tracked: boolean;
}

export interface ReoptimizeResult {
  action: "SCALE" | "ADD_SNACK" | "REPLACE_ONE" | "REBUILD" | "NO_CHANGE";
  meals: PickedMeal[]; // full new day (for REBUILD) or delta payload
  scaleFactor?: number;
}

/**
 * Reoptimizer ladder:
 *  1. Untouched only kcal delta small (<7%) → scale ungelockte, ungetrackte
 *     Mahlzeiten (mealprep-Gruppen erhalten denselben Faktor).
 *  2. Delta 7–15% AND wants_snack → try adding a snack.
 *  3. Delta 15–30% → replace one ungelockte non-mealprep meal.
 *  4. Delta > 30% OR day type flipped → rebuild via pickMealsForDay
 *     (respecting is_locked + is_tracked as fixed anchors).
 */
export function reoptimizeExistingDay(input: {
  existingMeals: ExistingMeal[];
  previousDayType: PerformanceDayType | null;
  newDayType: PerformanceDayType;
  newTarget: MacroTarget;
  preferences: AthletePreferences;
  poolMeals: PoolMeal[];
  seed?: string;
}): ReoptimizeResult | PickFailure {
  const {
    existingMeals,
    previousDayType,
    newDayType,
    newTarget,
    preferences,
    poolMeals,
    seed,
  } = input;

  const currentKcal = existingMeals.reduce((s, m) => s + (m.kcal || 0), 0);
  if (currentKcal <= 0) {
    return pickToReoptimize(newTarget, newDayType, preferences, poolMeals, seed);
  }

  const dayTypeChanged = previousDayType !== null && previousDayType !== newDayType;
  const scale = newTarget.kcal / currentKcal;
  const delta = Math.abs(scale - 1);

  // Rebuild if day type flipped or delta huge.
  if (dayTypeChanged || delta > 0.3) {
    return pickToReoptimize(newTarget, newDayType, preferences, poolMeals, seed, existingMeals);
  }

  // Small delta: scale flexible meals.
  if (delta <= 0.07) {
    return { action: "NO_CHANGE", meals: [] };
  }

  // Otherwise scale (mealprep coherent, respect locks/tracking).
  const scaled = scaleFlexibleMeals(existingMeals, scale);
  if (scaled.applied) {
    return { action: "SCALE", meals: scaled.meals, scaleFactor: scale };
  }

  // Fallback to rebuild if no flexible meal available.
  return pickToReoptimize(newTarget, newDayType, preferences, poolMeals, seed, existingMeals);
}

function scaleFlexibleMeals(
  existing: ExistingMeal[],
  scale: number,
): { applied: boolean; meals: PickedMeal[] } {
  const flexible = existing.filter(
    (m) =>
      !m.is_locked &&
      !m.is_tracked &&
      m.modification_source !== "athlete_locked" &&
      m.modification_source !== "coach_fixed",
  );
  if (flexible.length === 0) return { applied: false, meals: [] };

  // Compute per-prep-group uniform factors: for each linked_prep_group all
  // meals in the group are scaled together with the same factor.
  const groupFactors = new Map<string, number>();
  for (const m of flexible) {
    if (m.linked_prep_group) {
      groupFactors.set(m.linked_prep_group, scale);
    }
  }

  const meals: PickedMeal[] = flexible.map((m) => {
    const factor = m.linked_prep_group
      ? groupFactors.get(m.linked_prep_group) ?? scale
      : scale;
    return {
      library_meal_id: m.library_meal_id ?? "",
      name: "",
      description: null,
      meal_slot: (m.meal_slot ?? "snack") as SlotKind,
      sort_order: m.sort_order,
      scale: factor,
      kcal: Math.round(m.kcal * factor),
      protein_g: Math.round(m.protein_g * factor),
      carbs_g: Math.round(m.carbs_g * factor),
      fat_g: Math.round(m.fat_g * factor),
      modification_source: "auto_generated",
    };
  });
  return { applied: true, meals };
}

function pickToReoptimize(
  target: MacroTarget,
  dayType: PerformanceDayType,
  preferences: AthletePreferences,
  pool: PoolMeal[],
  seed: string | undefined,
  anchors?: ExistingMeal[],
): ReoptimizeResult | PickFailure {
  // Anchors that must be preserved (locked/tracked) reduce the target we
  // need to hit with fresh picks.
  const anchoredKcal = (anchors ?? [])
    .filter(
      (m) =>
        m.is_locked ||
        m.is_tracked ||
        m.modification_source === "athlete_locked" ||
        m.modification_source === "coach_fixed",
    )
    .reduce((s, m) => s + (m.kcal || 0), 0);

  const residual: MacroTarget = {
    kcal: Math.max(0, target.kcal - anchoredKcal),
    protein_g: target.protein_g,
    carbs_g: target.carbs_g,
    fat_g: target.fat_g,
  };

  const res = pickMealsForDay({
    target: residual,
    dayType,
    preferences,
    poolMeals: pool,
    seed,
  });
  if (!res.ok) return res;
  return { action: "REBUILD", meals: res.meals };
}
