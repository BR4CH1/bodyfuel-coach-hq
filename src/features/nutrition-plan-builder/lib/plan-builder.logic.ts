import type {
  LibraryMeal,
  CustomerPlanContext,
  BuilderDay,
  BuilderMeal,
} from "@/lib/plan-builder.functions";
import { isMealCompatibleWithDiet } from "@/lib/diet-compat";
import {
  resolveTrainingDay,
  scheduleFromWeekdays,
  type TrainingWeekSchedule,
} from "@/lib/training-schedule.logic";

/** Zentrale Ernährungsform-Prüfung für Picker, Auto-Fill und Scoring. */
export function mealFitsDiet(
  m: LibraryMeal,
  dietStyle: string | null | undefined,
): boolean {
  return isMealCompatibleWithDiet(
    {
      name: m.name,
      description: m.description,
      tags: m.tags,
      ingredients: m.ingredients,
      main_protein: m.main_protein,
      no_go_ingredients: m.no_go_ingredients,
    },
    dietStyle,
  );
}


export type Slot = "breakfast" | "lunch" | "dinner" | "snack";
export const SLOTS: { key: Slot; label: string }[] = [
  { key: "breakfast", label: "Frühstück" },
  { key: "lunch", label: "Mittagessen" },
  { key: "dinner", label: "Abendessen" },
  { key: "snack", label: "Snack" },
];

// Partner coupling ops per slot (passed to DayCard/MealSlotRow only in partner mode)
export type PartnerSlotLink = {
  selfName: string;
  partnerName: string;
  isCoupled: boolean;
  onCouple: () => void;
  onUncouple: () => void;
  onSwapForBoth: (lib: LibraryMeal) => void;
};

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

/**
 * Baut die Kalendertage des Ernährungsplans.
 *
 * Trainingstag/Ruhetag UND Splitbezeichnung stammen ausschließlich aus dem
 * Wochenplan (`schedule`), der pro Wochentag (0=So…6=Sa) hinterlegt ist —
 * es wird nichts zyklisch nach Array-Reihenfolge rotiert. Fehlt der Wochenplan,
 * greift der abwärtskompatible Fallback über `trainingWeekdays`
 * (dann nur Trainingstag/Ruhetag, ohne Split).
 *
 * Manuell umgeschaltete Tage (`typeOverride`) bleiben bei Re-Renders erhalten.
 * Für einen bewussten Neuaufbau `forceRecompute = true` setzen.
 */
export function buildBuilderDays(
  previous: BuilderDay[],
  startDate: string,
  numDays: number,
  trainingWeekdays: number[],
  schedule?: TrainingWeekSchedule | null,
  forceRecompute = false,
): BuilderDay[] {
  const next: BuilderDay[] = [];
  const weekdayLabels = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const effectiveSchedule =
    schedule && Object.keys(schedule).length > 0
      ? schedule
      : scheduleFromWeekdays(trainingWeekdays);

  for (let index = 0; index < numDays; index += 1) {
    const iso = addDays(startDate, index);
    const date = new Date(`${iso}T00:00:00Z`);
    const weekday = date.getUTCDay();
    const existing = previous[index];
    const planned = resolveTrainingDay(effectiveSchedule, iso);
    const keepOverride = !forceRecompute && existing?.typeOverride === true;
    const type = keepOverride ? existing!.type : planned.type;
    // Ruhetage tragen nie eine alte Splitbezeichnung.
    const split = type === "training" ? (planned.split ?? null) : null;
    const dateLabel = `${weekdayLabels[weekday]} ${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

    next.push({
      name: `Tag ${index + 1} · ${dateLabel}`,
      type,
      split,
      typeOverride: keepOverride,
      meals: existing?.meals ?? [],
      prepCoupleLunchDinner: existing?.prepCoupleLunchDinner ?? false,
      customTargets: existing?.customTargets ?? null,
      slotKcalTargets: existing?.slotKcalTargets ?? null,

    });
  }

  return next;
}

export function cloneBuilderDays(days: BuilderDay[]): BuilderDay[] {
  return days.map((day) => ({
    ...day,
    meals: day.meals.map((meal) => ({
      ...meal,
      ingredients: meal.ingredients.map((ingredient) => ({ ...ingredient })),
    })),
  }));
}
export function makeGroupId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `grp_${Math.random().toString(36).slice(2)}`;
}

export function mealFromLibrary(
  lib: LibraryMeal,
  slot: Slot,
  factor = 1,
  group: string | null = null,
): BuilderMeal {
  return {
    slot,
    name: lib.name,
    description: lib.description,
    library_meal_id: lib.id,
    portion_factor: factor,
    linked_prep_group: group,
    ingredients: (lib.ingredients ?? []).map((i) => ({
      name: i.name,
      grams: Math.round(i.amount_g ?? 0),
    })),
  };
}

export function mealMacros(m: BuilderMeal, library: LibraryMeal[]) {
  const f = m.portion_factor && m.portion_factor > 0 ? m.portion_factor : 1;
  // Individuell angepasste Zutatenmengen haben Vorrang vor Bibliothekswerten.
  if (m.macro_override) {
    return {
      kcal: Math.max(0, Number(m.macro_override.kcal) || 0) * f,
      p: Math.max(0, Number(m.macro_override.protein_g) || 0) * f,
      c: Math.max(0, Number(m.macro_override.carbs_g) || 0) * f,
      f: Math.max(0, Number(m.macro_override.fat_g) || 0) * f,
    };
  }
  const lib = library.find((x) => x.id === m.library_meal_id);
  if (!lib) {
    const kcal = Number(m.kcal ?? 0);
    const p = Number(m.protein_g ?? 0);
    const c = Number(m.carbs_g ?? 0);
    const fat = Number(m.fat_g ?? 0);
    if (![kcal, p, c, fat].some((value) => Number.isFinite(value) && value > 0)) {
      return { kcal: 0, p: 0, c: 0, f: 0 };
    }
    return {
      kcal: Number.isFinite(kcal) ? kcal * f : 0,
      p: Number.isFinite(p) ? p * f : 0,
      c: Number.isFinite(c) ? c * f : 0,
      f: Number.isFinite(fat) ? fat * f : 0,
    };
  }
  return {
    kcal: Number(lib.kcal) * f,
    p: Number(lib.protein_g) * f,
    c: Number(lib.carbs_g) * f,
    f: Number(lib.fat_g) * f,
  };
}

export type AutoFillMode = "empty_only" | "all_unlocked";

export function targetsFor(day: BuilderDay, ctx: CustomerPlanContext) {
  if (day.customTargets) {
    const t = day.customTargets;
    return {
      kcal: Math.max(0, Math.round(Number(t.kcal) || 0)),
      p: Math.max(0, Math.round(Number(t.p) || 0)),
      c: Math.max(0, Math.round(Number(t.c) || 0)),
      f: Math.max(0, Math.round(Number(t.f) || 0)),
    };
  }
  return day.type === "training"
    ? {
        kcal: ctx.targets.kcal_train,
        p: ctx.targets.protein_train,
        c: ctx.targets.carbs_train,
        f: ctx.targets.fat_train,
      }
    : {
        kcal: ctx.targets.kcal_rest,
        p: ctx.targets.protein_rest,
        c: ctx.targets.carbs_rest,
        f: ctx.targets.fat_rest,
      };
}


export type MacroValues = { kcal: number; p: number; c: number; f: number };

export type DayNutritionSummary = {
  totals: MacroValues;
  target: MacroValues;
  filledSlots: number;
  totalSlots: number;
  isComplete: boolean;
  isBalanced: boolean;
};

export function summarizeDay(
  day: BuilderDay,
  ctx: CustomerPlanContext,
  library: LibraryMeal[],
): DayNutritionSummary {
  const target = targetsFor(day, ctx);
  const totals = day.meals.reduce<MacroValues>(
    (acc, meal) => {
      const macros = mealMacros(meal, library);
      return {
        kcal: acc.kcal + macros.kcal,
        p: acc.p + macros.p,
        c: acc.c + macros.c,
        f: acc.f + macros.f,
      };
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  const filledSlots = new Set(day.meals.map((meal) => meal.slot)).size;
  const relativeDifference = (value: number, targetValue: number) =>
    targetValue ? Math.abs(value - targetValue) / targetValue : 0;
  const macrosBalanced =
    relativeDifference(totals.kcal, target.kcal) <= 0.08 &&
    relativeDifference(totals.p, target.p) <= 0.12 &&
    relativeDifference(totals.c, target.c) <= 0.12 &&
    relativeDifference(totals.f, target.f) <= 0.12;

  return {
    totals,
    target,
    filledSlots,
    totalSlots: SLOTS.length,
    isComplete: filledSlots === SLOTS.length,
    isBalanced: filledSlots === SLOTS.length && macrosBalanced,
  };
}

export function macroProgress(value: number, target: number): number {
  if (!target) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

/* ---------------- Mahlzeiten-Zielverteilung (Slot-Ziele) ---------------- */

/** Standardverteilung des Tagesziels auf die vier Mahlzeiten-Slots. */
export const DEFAULT_SLOT_SHARES: Record<Slot, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  dinner: 0.3,
  snack: 0.15,
};

/** Untergrenze pro Slot, damit keine 0-kcal-Restslots entstehen. */
export const MIN_SLOT_KCAL = 100;

/** Optionale, im Builder-State gehaltene kcal-Overrides pro Slot (keine DB-Migration nötig). */
export type SlotKcalTargets = Partial<Record<Slot, number>>;

const SLOT_KEYS: Slot[] = SLOTS.map((slot) => slot.key);

/** Rundet Werte auf ganze Zahlen und gleicht die Rundungsdifferenz zur Summe aus. */
function distributeRounded(values: number[], total: number): number[] {
  const rounded = values.map((value) => Math.max(0, Math.round(Number(value) || 0)));
  const targetTotal = Math.max(0, Math.round(Number(total) || 0));
  let diff = targetTotal - rounded.reduce((sum, value) => sum + value, 0);
  if (diff === 0 || rounded.length === 0) return rounded;
  const order = rounded.map((_, index) => index).sort((a, b) => rounded[b] - rounded[a]);
  let cursor = 0;
  let guard = 0;
  while (diff !== 0 && guard < 10000) {
    const index = order[cursor % order.length];
    const step = diff > 0 ? 1 : -1;
    if (rounded[index] + step >= 0) {
      rounded[index] += step;
      diff -= step;
    }
    cursor += 1;
    guard += 1;
  }
  return rounded;
}

function toSlotRecord(values: number[]): Record<Slot, number> {
  return SLOT_KEYS.reduce(
    (acc, key, index) => {
      acc[key] = values[index] ?? 0;
      return acc;
    },
    {} as Record<Slot, number>,
  );
}

/**
 * Leitet die kcal-Ziele je Slot aus dem Tagesziel ab. Vorhandene Overrides
 * werden proportional auf das aktuelle Tagesziel normalisiert, sodass die
 * Summe der Slot-Ziele immer exakt dem Tagesziel entspricht.
 */
export function resolveSlotKcalTargets(
  dayKcal: number,
  overrides?: SlotKcalTargets | null,
): Record<Slot, number> {
  const total = Math.max(0, Math.round(Number(dayKcal) || 0));
  const raw = SLOT_KEYS.map((key) => {
    const override = Number(overrides?.[key]);
    return Number.isFinite(override) && override > 0 ? override : DEFAULT_SLOT_SHARES[key] * total;
  });
  const sum = raw.reduce((acc, value) => acc + value, 0);
  const scaled =
    sum > 0
      ? raw.map((value) => (value * total) / sum)
      : SLOT_KEYS.map((key) => DEFAULT_SLOT_SHARES[key] * total);
  return toSlotRecord(distributeRounded(scaled, total));
}

/**
 * Setzt das kcal-Ziel eines Slots und verteilt die Differenz proportional auf
 * die übrigen Slots, ohne die Mindestgrenze zu unterschreiten.
 */
export function setSlotKcalTarget(
  current: Record<Slot, number>,
  slot: Slot,
  value: number,
  dayKcal: number,
): Record<Slot, number> {
  const total = Math.max(0, Math.round(Number(dayKcal) || 0));
  if (total <= 0) return resolveSlotKcalTargets(0, null);
  const others = SLOT_KEYS.filter((key) => key !== slot);
  const minSlot =
    total >= MIN_SLOT_KCAL * SLOT_KEYS.length
      ? MIN_SLOT_KCAL
      : Math.floor(total / (SLOT_KEYS.length * 2));
  const maxForSlot = Math.max(minSlot, total - minSlot * others.length);
  const wanted = Math.max(minSlot, Math.min(maxForSlot, Math.round(Number(value) || 0)));
  const rest = Math.max(0, total - wanted);

  const currentOthers = others.map((key) => Math.max(0, Number(current[key]) || 0));
  const otherSum = currentOthers.reduce((acc, item) => acc + item, 0);
  let values = currentOthers.map((item) =>
    otherSum > 0 ? (item * rest) / otherSum : rest / others.length,
  );
  // Mindestgrenze anheben und Überschuss bei den größeren Slots abziehen.
  values = values.map((item) => Math.max(minSlot, item));
  let excess = values.reduce((acc, item) => acc + item, 0) - rest;
  let guard = 0;
  while (excess > 0.0001 && guard < 50) {
    const reducible = values.reduce((acc, item) => acc + Math.max(0, item - minSlot), 0);
    if (reducible <= 0.0001) break;
    values = values.map((item) => item - (Math.max(0, item - minSlot) / reducible) * excess);
    excess = values.reduce((acc, item) => acc + item, 0) - rest;
    guard += 1;
  }

  const combined = SLOT_KEYS.map((key) =>
    key === slot ? wanted : values[others.indexOf(key)] ?? 0,
  );
  return toSlotRecord(distributeRounded(combined, total));
}

/**
 * Leitet aus dem Tagesziel und der kcal-Verteilung die vollständigen
 * Makro-Ziele je Slot ab (Summe entspricht exakt dem Tagesziel).
 */
export function slotMacroTargets(
  dayTarget: MacroValues,
  overrides?: SlotKcalTargets | null,
): Record<Slot, MacroValues> {
  const kcals = resolveSlotKcalTargets(dayTarget.kcal, overrides);
  const totalKcal = SLOT_KEYS.reduce((sum, key) => sum + kcals[key], 0);
  const shares = SLOT_KEYS.map((key) =>
    totalKcal > 0 ? kcals[key] / totalKcal : DEFAULT_SLOT_SHARES[key],
  );
  const protein = distributeRounded(
    shares.map((share) => share * dayTarget.p),
    dayTarget.p,
  );
  const carbs = distributeRounded(
    shares.map((share) => share * dayTarget.c),
    dayTarget.c,
  );
  const fat = distributeRounded(
    shares.map((share) => share * dayTarget.f),
    dayTarget.f,
  );
  return SLOT_KEYS.reduce(
    (acc, key, index) => {
      acc[key] = { kcal: kcals[key], p: protein[index], c: carbs[index], f: fat[index] };
      return acc;
    },
    {} as Record<Slot, MacroValues>,
  );
}

/** Slot-Ziele eines konkreten Tages (inkl. individueller Tagesziele/Overrides). */
export function daySlotTargets(
  day: BuilderDay,
  ctx: CustomerPlanContext,
): Record<Slot, MacroValues> {
  return slotMacroTargets(targetsFor(day, ctx), day.slotKcalTargets ?? null);
}

/** Ist-Makros aller Mahlzeiten eines Slots. */
export function slotTotals(
  day: BuilderDay,
  slot: Slot,
  library: LibraryMeal[],
): MacroValues {
  return day.meals
    .filter((meal) => meal.slot === slot)
    .reduce<MacroValues>(
      (acc, meal) => {
        const macros = mealMacros(meal, library);
        return {
          kcal: acc.kcal + macros.kcal,
          p: acc.p + macros.p,
          c: acc.c + macros.c,
          f: acc.f + macros.f,
        };
      },
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
}

export type SlotStatus = "on_target" | "under" | "over";

/** Bewertet eine Ist-/Ziel-Kombination mit ±10 % kcal-Toleranz. */
export function slotStatus(actualKcal: number, targetKcal: number, tolerance = 0.1): SlotStatus {
  if (!targetKcal) return "on_target";
  const diff = (actualKcal - targetKcal) / targetKcal;
  if (diff > tolerance) return "over";
  if (diff < -tolerance) return "under";
  return "on_target";
}

const clampFactor = (value: number) => Math.min(8, Math.max(0.25, value));
const roundQuarter = (value: number) => Math.round(value * 4) / 4;

/** Portionsfaktor, der eine Mahlzeit möglichst nah an ein kcal-Ziel bringt. */
export function suggestedPortionFactor(unitKcal: number, targetKcal: number): number {
  const kcal = Number(unitKcal) || 0;
  const target = Number(targetKcal) || 0;
  if (kcal <= 0 || target <= 0) return 1;
  return clampFactor(roundQuarter(target / kcal)) || 1;
}

/**
 * Zusatzbewertung für Auto-Fill: Kandidaten, die mit realistischer Portion
 * nah am Slot-Ziel liegen, werden bevorzugt; sehr kleine oder sehr große
 * Gerichte werden deutlich abgewertet.
 */
export function slotSizeScore(unitKcal: number, slotTargetKcal: number): number {
  const kcal = Number(unitKcal) || 0;
  const target = Number(slotTargetKcal) || 0;
  if (kcal <= 0 || target <= 0) return 0;
  const rawRatio = target / kcal;
  const factor = suggestedPortionFactor(kcal, target);
  const achieved = kcal * factor;
  const kcalError = Math.abs(achieved - target) / target;
  // Portionsnähe an 1.0 belohnen, extreme Skalierung bestrafen.
  const scalePenalty = Math.abs(Math.log(Math.max(0.05, rawRatio))) * 22;
  return 25 - kcalError * 120 - scalePenalty;
}


export type AutoFillSelectionContext = {
  usageCount?: ReadonlyMap<string, number>;
  selectionSeed?: number;
};

function seededMealNoise(mealId: string, seed: number): number {
  let hash = 2166136261;
  const value = `${mealId}:${seed}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 1000) / 1000;
}

function adjustedMealScore(
  meal: LibraryMeal,
  baseScore: number,
  ctx: CustomerPlanContext,
  selection?: AutoFillSelectionContext,
): number {
  const usageCount = selection?.usageCount?.get(meal.id) ?? 0;
  const varietyPenalty = ctx.varietyLevel === "high" ? 55 : ctx.varietyLevel === "low" ? 8 : 28;
  const noiseRange = ctx.varietyLevel === "high" ? 12 : ctx.varietyLevel === "low" ? 2 : 6;
  const noise = seededMealNoise(meal.id, selection?.selectionSeed ?? 0) * noiseRange;
  return baseScore - usageCount * varietyPenalty + noise;
}

export function mealRepeatSpan(ctx: CustomerPlanContext): number {
  const style = (ctx.mealPrepStyle ?? "").toLowerCase();
  const eatingStyle = (ctx.eatingStyle ?? "").toLowerCase();
  let span = 1;

  if (eatingStyle === "meal_prep") span = ctx.mealPrepDays ?? 3;
  else if (style === "meal_prep") span = 3;
  else if (style === "2_3_week") span = 2;
  else if (style === "low_effort") span = 3;

  if (ctx.varietyLevel === "low") span = Math.max(2, span);
  if (ctx.varietyLevel === "high") span = span > 1 ? Math.min(2, span) : 1;

  return Math.max(1, Math.min(7, Math.round(span)));
}

// Returns { day, missing: Slot[] } — never touches locked meals.
export function autoFillDayImpl(
  day: BuilderDay,
  ctx: CustomerPlanContext,
  library: LibraryMeal[],
  mode: AutoFillMode,
  selection?: AutoFillSelectionContext,
): { day: BuilderDay; missing: Slot[] } {
  let meals: BuilderMeal[] = day.meals.map((m) => ({ ...m }));
  // In "all_unlocked" mode: remove unlocked meals before filling
  if (mode === "all_unlocked") {
    meals = meals.filter((m) => m.is_locked);
  }
  const slotTargets = daySlotTargets(day, ctx);
  const slotOrder: Slot[] = ["breakfast", "lunch", "dinner", "snack"];
  const missing: Slot[] = [];

  // Kandidaten werden gegen das Ziel des jeweiligen Slots bewertet — nicht
  // gegen den Rest des ganzen Tages. Das verhindert 150-kcal-/800-kcal-Ausreißer.
  const slotRemaining = (slot: Slot) => {
    const planned = meals
      .filter((m) => m.slot === slot)
      .reduce(
        (acc, m) => {
          const mm = mealMacros(m, library);
          return { kcal: acc.kcal + mm.kcal, p: acc.p + mm.p, c: acc.c + mm.c, f: acc.f + mm.f };
        },
        { kcal: 0, p: 0, c: 0, f: 0 },
      );
    const st = slotTargets[slot];
    return {
      kcal: st.kcal - planned.kcal,
      p: st.p - planned.p,
      c: st.c - planned.c,
      f: st.f - planned.f,
    };
  };

  for (const slot of slotOrder) {
    const existing = meals.find((m) => m.slot === slot);
    if (existing) continue; // locked or (empty_only) user meal → keep

    const remainingForSlot = slotRemaining(slot);
    const candidates = library
      .filter((m) => m.category === slot)
      .map((m) => {
        const result = scoreMeal(m, ctx, day.type, remainingForSlot);
        const sizeScore = slotSizeScore(Number(m.kcal), remainingForSlot.kcal);
        return {
          meal: m,
          ...result,
          adjustedScore: adjustedMealScore(m, result.score + sizeScore, ctx, selection),
        };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.adjustedScore - a.adjustedScore);
    const best = candidates[0];
    if (!best) {
      missing.push(slot);
      continue;
    }

    const initialFactor = suggestedPortionFactor(Number(best.meal.kcal), remainingForSlot.kcal);

    if (day.prepCoupleLunchDinner && (slot === "lunch" || slot === "dinner")) {
      const partner = meals.find((m) => m.slot === (slot === "lunch" ? "dinner" : "lunch"));
      if (partner && partner.library_meal_id) {
        // Partner already set (probably locked) → mirror it into this slot
        const src = library.find((x) => x.id === partner.library_meal_id);
        if (src) {
          const groupId = partner.linked_prep_group ?? makeGroupId();
          meals = meals.map((m) =>
            m.slot === partner.slot ? { ...m, linked_prep_group: groupId } : m,
          );
          const clone = mealFromLibrary(
            src,
            slot,
            suggestedPortionFactor(Number(src.kcal), remainingForSlot.kcal),
            groupId,
          );
          if (slot === "dinner")
            clone.description = (src.description ?? "") + " (Portion 2 aus Mealprep)";
          meals.push(clone);
        }
        continue;
      }
      const groupId = makeGroupId();
      const lunch = mealFromLibrary(
        best.meal,
        "lunch",
        suggestedPortionFactor(Number(best.meal.kcal), slotTargets.lunch.kcal),
        groupId,
      );
      const dinner = mealFromLibrary(
        best.meal,
        "dinner",
        suggestedPortionFactor(Number(best.meal.kcal), slotTargets.dinner.kcal),
        groupId,
      );
      dinner.description = (best.meal.description ?? "") + " (Portion 2 aus Mealprep)";
      meals = meals.filter((m) => (m.slot !== "lunch" && m.slot !== "dinner") || m.is_locked);
      meals.push(lunch, dinner);
      continue;
    }
    meals.push(mealFromLibrary(best.meal, slot, initialFactor));
  }

  return { day: { ...day, meals }, missing };
}

export function autoFillWeekImpl(
  days: BuilderDay[],
  ctx: CustomerPlanContext,
  library: LibraryMeal[],
  mode: AutoFillMode,
): { days: BuilderDay[]; missing: number } {
  const nextDays: BuilderDay[] = [];
  const usageCount = new Map<string, number>();
  const repeatSpan = mealRepeatSpan(ctx);
  let missing = 0;

  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const sourceDay = days[dayIndex];
    let workingDay: BuilderDay = {
      ...sourceDay,
      meals:
        mode === "all_unlocked"
          ? sourceDay.meals
              .filter((meal) => meal.is_locked)
              .map((meal) => ({
                ...meal,
                ingredients: meal.ingredients.map((ingredient) => ({ ...ingredient })),
              }))
          : sourceDay.meals.map((meal) => ({
              ...meal,
              ingredients: meal.ingredients.map((ingredient) => ({ ...ingredient })),
            })),
    };

    if (dayIndex > 0 && repeatSpan > 1 && dayIndex % repeatSpan !== 0) {
      const occupiedSlots = new Set(workingDay.meals.map((meal) => meal.slot));
      const copiedMeals = remapMealsForCopy(nextDays[dayIndex - 1].meals, new Map(), new Map())
        .filter((meal) => {
          if (occupiedSlots.has(meal.slot) || !meal.library_meal_id) return false;
          const libraryMeal = library.find((candidate) => candidate.id === meal.library_meal_id);
          if (!libraryMeal?.mealprep_ok) return false;
          return workingDay.type === "training"
            ? libraryMeal.suitable_training
            : libraryMeal.suitable_rest;
        })
        .map((meal) => ({ ...meal, is_locked: false, linked_partner_group: null }));

      workingDay = {
        ...workingDay,
        meals: [...workingDay.meals, ...copiedMeals],
      };
    }

    const result = autoFillDayImpl(workingDay, ctx, library, "empty_only", {
      usageCount,
      selectionSeed: dayIndex + 1,
    });
    const balancedDay = rebalanceDay(result.day, ctx, library);
    missing += result.missing.length;
    nextDays.push(balancedDay);

    for (const meal of balancedDay.meals) {
      if (!meal.library_meal_id) continue;
      usageCount.set(meal.library_meal_id, (usageCount.get(meal.library_meal_id) ?? 0) + 1);
    }
  }

  return { days: nextDays, missing };
}

// Auto-fill for two linked days (partner mode).
// Strategy per slot: prefer a shared meal (score > 0 for both, quantities scaled per person).
// Fallback: independent picks per person.
export type SharedSlotsMap = Record<Slot, boolean>;
export type AutoFillPairSelectionContext = {
  client?: AutoFillSelectionContext;
  partner?: AutoFillSelectionContext;
};

export function autoFillDayPair(
  clientDay: BuilderDay,
  partnerDay: BuilderDay,
  clientCtx: CustomerPlanContext,
  partnerCtx: CustomerPlanContext,
  library: LibraryMeal[],
  mode: AutoFillMode,
  sharedSlots: SharedSlotsMap = { breakfast: true, lunch: true, dinner: true, snack: true },
  selection?: AutoFillPairSelectionContext,
): { client: BuilderDay; partner: BuilderDay; missing: number } {
  const filterKeep = (arr: BuilderMeal[]) =>
    mode === "all_unlocked" ? arr.filter((m) => m.is_locked) : arr.map((m) => ({ ...m }));
  const clientMeals: BuilderMeal[] = filterKeep(clientDay.meals);
  const partnerMeals: BuilderMeal[] = filterKeep(partnerDay.meals);

  const slotOrder: Slot[] = ["breakfast", "lunch", "dinner", "snack"];
  let missing = 0;

  const clientSlotTargets = daySlotTargets(clientDay, clientCtx);
  const partnerSlotTargets = daySlotTargets(partnerDay, partnerCtx);

  // Pro Person deren eigenes Slot-Ziel als Referenz verwenden.
  const remainingFor = (
    meals: BuilderMeal[],
    slot: Slot,
    slotTargets: Record<Slot, MacroValues>,
  ) => {
    const t = slotTargets[slot];
    const cur = meals
      .filter((m) => m.slot === slot)
      .reduce(
        (acc, m) => {
          const mm = mealMacros(m, library);
          return { kcal: acc.kcal + mm.kcal, p: acc.p + mm.p, c: acc.c + mm.c, f: acc.f + mm.f };
        },
        { kcal: 0, p: 0, c: 0, f: 0 },
      );
    return { kcal: t.kcal - cur.kcal, p: t.p - cur.p, c: t.c - cur.c, f: t.f - cur.f };
  };


  for (const slot of slotOrder) {
    const cExisting = clientMeals.find((m) => m.slot === slot);
    const pExisting = partnerMeals.find((m) => m.slot === slot);
    // Only fill where BOTH slots are empty (locked/existing on either side → skip shared logic)
    if (cExisting && pExisting) continue;

    if (sharedSlots[slot] && !cExisting && !pExisting) {
      const cRem = remainingFor(clientMeals, slot, clientSlotTargets);
      const pRem = remainingFor(partnerMeals, slot, partnerSlotTargets);
      const scored = library
        .filter((m) => m.category === slot)
        .map((m) => {
          const sc = scoreMeal(m, clientCtx, clientDay.type, cRem);
          const sp = scoreMeal(m, partnerCtx, partnerDay.type, pRem);
          const cSize = slotSizeScore(Number(m.kcal), cRem.kcal);
          const pSize = slotSizeScore(Number(m.kcal), pRem.kcal);
          return {
            meal: m,
            combined:
              adjustedMealScore(m, sc.score + cSize, clientCtx, selection?.client) +
              adjustedMealScore(m, sp.score + pSize, partnerCtx, selection?.partner),
            sc: sc.score,
            sp: sp.score,
          };
        })
        .filter((x) => x.sc > 0 && x.sp > 0)
        .sort((a, b) => b.combined - a.combined);
      const best = scored[0];
      if (best) {
        const group = makeGroupId();
        // per-person kcal scaling
        const scale = (rem: { kcal: number }, kcal: number) =>
          suggestedPortionFactor(kcal, rem.kcal);
        const clientFactor = scale(cRem, best.meal.kcal);
        const partnerFactor = scale(pRem, best.meal.kcal);
        const cMeal = mealFromLibrary(best.meal, slot, clientFactor, null);
        cMeal.linked_partner_group = group;
        const pMeal = mealFromLibrary(best.meal, slot, partnerFactor, null);
        pMeal.linked_partner_group = group;
        clientMeals.push(cMeal);
        partnerMeals.push(pMeal);
        continue;
      }
    }
    // Fallback: independent picks per side (only where side is empty)
    if (!cExisting) {
      const cRem = remainingFor(clientMeals, slot, clientSlotTargets);
      const cCand = library
        .filter((m) => m.category === slot)
        .map((m) => {
          const result = scoreMeal(m, clientCtx, clientDay.type, cRem);
          return {
            meal: m,
            ...result,
            adjustedScore: adjustedMealScore(
              m,
              result.score + slotSizeScore(Number(m.kcal), cRem.kcal),
              clientCtx,
              selection?.client,
            ),
          };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.adjustedScore - a.adjustedScore)[0];
      if (cCand)
        clientMeals.push(
          mealFromLibrary(cCand.meal, slot, suggestedPortionFactor(Number(cCand.meal.kcal), cRem.kcal)),
        );
      else missing++;
    }
    if (!pExisting) {
      const pRem = remainingFor(partnerMeals, slot, partnerSlotTargets);
      const pCand = library
        .filter((m) => m.category === slot)
        .map((m) => {
          const result = scoreMeal(m, partnerCtx, partnerDay.type, pRem);
          return {
            meal: m,
            ...result,
            adjustedScore: adjustedMealScore(
              m,
              result.score + slotSizeScore(Number(m.kcal), pRem.kcal),
              partnerCtx,
              selection?.partner,
            ),
          };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.adjustedScore - a.adjustedScore)[0];
      if (pCand)
        partnerMeals.push(
          mealFromLibrary(pCand.meal, slot, suggestedPortionFactor(Number(pCand.meal.kcal), pRem.kcal)),
        );
      else missing++;
    }
  }

  return {
    client: { ...clientDay, meals: clientMeals },
    partner: { ...partnerDay, meals: partnerMeals },
    missing,
  };
}

export function autoFillWeekPairImpl(
  clientDays: BuilderDay[],
  partnerDays: BuilderDay[],
  clientCtx: CustomerPlanContext,
  partnerCtx: CustomerPlanContext,
  library: LibraryMeal[],
  mode: AutoFillMode,
  sharedSlots: SharedSlotsMap,
): { clientDays: BuilderDay[]; partnerDays: BuilderDay[]; missing: number } {
  const nextClientDays: BuilderDay[] = [];
  const nextPartnerDays: BuilderDay[] = [];
  const clientUsage = new Map<string, number>();
  const partnerUsage = new Map<string, number>();
  const clientRepeatSpan = mealRepeatSpan(clientCtx);
  const partnerRepeatSpan = mealRepeatSpan(partnerCtx);
  let missing = 0;

  const prepareDay = (day: BuilderDay): BuilderDay => ({
    ...day,
    meals:
      mode === "all_unlocked"
        ? day.meals
            .filter((meal) => meal.is_locked)
            .map((meal) => ({
              ...meal,
              ingredients: meal.ingredients.map((ingredient) => ({ ...ingredient })),
            }))
        : day.meals.map((meal) => ({
            ...meal,
            ingredients: meal.ingredients.map((ingredient) => ({ ...ingredient })),
          })),
  });

  const copyRepeatableMeals = (
    previousDay: BuilderDay,
    currentDay: BuilderDay,
    partnerGroupMap: Map<string, string>,
  ) => {
    const occupiedSlots = new Set(currentDay.meals.map((meal) => meal.slot));
    return remapMealsForCopy(previousDay.meals, partnerGroupMap, new Map())
      .filter((meal) => {
        if (occupiedSlots.has(meal.slot) || !meal.library_meal_id) return false;
        const libraryMeal = library.find((candidate) => candidate.id === meal.library_meal_id);
        if (!libraryMeal?.mealprep_ok) return false;
        return currentDay.type === "training"
          ? libraryMeal.suitable_training
          : libraryMeal.suitable_rest;
      })
      .map((meal) => ({ ...meal, is_locked: false }));
  };

  for (
    let dayIndex = 0;
    dayIndex < Math.min(clientDays.length, partnerDays.length);
    dayIndex += 1
  ) {
    let clientDay = prepareDay(clientDays[dayIndex]);
    let partnerDay = prepareDay(partnerDays[dayIndex]);
    const partnerGroupMap = new Map<string, string>();

    if (dayIndex > 0 && clientRepeatSpan > 1 && dayIndex % clientRepeatSpan !== 0) {
      clientDay = {
        ...clientDay,
        meals: [
          ...clientDay.meals,
          ...copyRepeatableMeals(nextClientDays[dayIndex - 1], clientDay, partnerGroupMap),
        ],
      };
    }
    if (dayIndex > 0 && partnerRepeatSpan > 1 && dayIndex % partnerRepeatSpan !== 0) {
      partnerDay = {
        ...partnerDay,
        meals: [
          ...partnerDay.meals,
          ...copyRepeatableMeals(nextPartnerDays[dayIndex - 1], partnerDay, partnerGroupMap),
        ],
      };
    }

    const clientGroups = new Set(
      clientDay.meals
        .map((meal) => meal.linked_partner_group)
        .filter((group): group is string => Boolean(group)),
    );
    const partnerGroups = new Set(
      partnerDay.meals
        .map((meal) => meal.linked_partner_group)
        .filter((group): group is string => Boolean(group)),
    );
    const sharedGroups = new Set([...clientGroups].filter((group) => partnerGroups.has(group)));
    clientDay = {
      ...clientDay,
      meals: clientDay.meals.map((meal) =>
        meal.linked_partner_group && !sharedGroups.has(meal.linked_partner_group)
          ? { ...meal, linked_partner_group: null }
          : meal,
      ),
    };
    partnerDay = {
      ...partnerDay,
      meals: partnerDay.meals.map((meal) =>
        meal.linked_partner_group && !sharedGroups.has(meal.linked_partner_group)
          ? { ...meal, linked_partner_group: null }
          : meal,
      ),
    };

    const result = autoFillDayPair(
      clientDay,
      partnerDay,
      clientCtx,
      partnerCtx,
      library,
      "empty_only",
      sharedSlots,
      {
        client: { usageCount: clientUsage, selectionSeed: dayIndex + 1 },
        partner: { usageCount: partnerUsage, selectionSeed: dayIndex + 101 },
      },
    );
    const balancedClient = rebalanceDay(result.client, clientCtx, library);
    const balancedPartner = rebalanceDay(result.partner, partnerCtx, library);
    nextClientDays.push(balancedClient);
    nextPartnerDays.push(balancedPartner);
    missing += result.missing;

    for (const meal of balancedClient.meals) {
      if (!meal.library_meal_id) continue;
      clientUsage.set(meal.library_meal_id, (clientUsage.get(meal.library_meal_id) ?? 0) + 1);
    }
    for (const meal of balancedPartner.meals) {
      if (!meal.library_meal_id) continue;
      partnerUsage.set(meal.library_meal_id, (partnerUsage.get(meal.library_meal_id) ?? 0) + 1);
    }
  }

  return {
    clientDays: nextClientDays,
    partnerDays: nextPartnerDays,
    missing,
  };
}

export function macroFitScore(totals: MacroValues, target: MacroValues): number {
  const dimensions = [
    // kcal dominates so "Portionen ans Ziel" wirklich das kcal-Ziel trifft.
    { value: totals.kcal, target: target.kcal, weight: 8, tolerance: 0.03 },
    { value: totals.p, target: target.p, weight: 1.2, tolerance: 0.1 },
    { value: totals.c, target: target.c, weight: 0.6, tolerance: 0.15 },
    { value: totals.f, target: target.f, weight: 0.6, tolerance: 0.15 },
  ];

  return dimensions.reduce((score, dimension) => {
    if (!dimension.target) return score;
    const relativeDifference = (dimension.value - dimension.target) / dimension.target;
    const outsideTolerance = Math.max(0, Math.abs(relativeDifference) - dimension.tolerance);
    const overshootFactor = relativeDifference > 0 ? 1.05 : 1;
    return (
      score +
      dimension.weight * overshootFactor * (relativeDifference ** 2 + outsideTolerance ** 2 * 4)
    );
  }, 0);
}

/**
 * Optimiert die Portionen slotweise gegen das jeweilige Slot-Ziel
 * (kcal + Makros). Fixierte Mahlzeiten bleiben unverändert, leere Slots
 * werden NICHT auf andere Mahlzeiten umgelegt — dadurch entstehen keine
 * künstlich aufgeblasenen Portionen mehr.
 */
export function rebalanceDay(
  day: BuilderDay,
  ctx: CustomerPlanContext,
  library: LibraryMeal[],
): BuilderDay {
  const slotTargets = daySlotTargets(day, ctx);
  const factorOptions = Array.from({ length: 32 }, (_, i) => (i + 1) * 0.25);
  const factorByMealIndex = new Map<number, number>();

  for (const slot of SLOT_KEYS) {
    const entries = day.meals
      .map((meal, index) => ({ meal, index }))
      .filter((entry) => entry.meal.slot === slot);
    if (entries.length === 0) continue;

    const lockedTotals = entries.reduce<MacroValues>(
      (totals, entry) => {
        if (!entry.meal.is_locked) return totals;
        const macros = mealMacros(entry.meal, library);
        return {
          kcal: totals.kcal + macros.kcal,
          p: totals.p + macros.p,
          c: totals.c + macros.c,
          f: totals.f + macros.f,
        };
      },
      { kcal: 0, p: 0, c: 0, f: 0 },
    );

    const adjustableMeals = entries.flatMap((entry) => {
      if (entry.meal.is_locked) return [];
      const unitMacros = mealMacros({ ...entry.meal, portion_factor: 1 }, library);
      if (!unitMacros.kcal) return [];
      return [{ index: entry.index, unitMacros }];
    });
    if (adjustableMeals.length === 0) continue;

    const target = slotTargets[slot];
    const remainingKcal = Math.max(0, target.kcal - lockedTotals.kcal);
    const unitUnlockedKcal = adjustableMeals.reduce((sum, meal) => sum + meal.unitMacros.kcal, 0);
    const seedFactor = unitUnlockedKcal > 0 ? clampFactor(remainingKcal / unitUnlockedKcal) : 1;

    let bestFactors = adjustableMeals.map(() => Math.max(0.25, roundQuarter(seedFactor)));

    const scoreFactors = (candidateFactors: number[]) => {
      const totals = adjustableMeals.reduce<MacroValues>(
        (sum, meal, index) => {
          const factor = candidateFactors[index];
          return {
            kcal: sum.kcal + meal.unitMacros.kcal * factor,
            p: sum.p + meal.unitMacros.p * factor,
            c: sum.c + meal.unitMacros.c * factor,
            f: sum.f + meal.unitMacros.f * factor,
          };
        },
        { ...lockedTotals },
      );
      const portionPenalty =
        candidateFactors.reduce((sum, factor) => sum + Math.abs(factor - 1), 0) * 0.0003;
      return macroFitScore(totals, target) + portionPenalty;
    };

    let bestScore = scoreFactors(bestFactors);
    for (let pass = 0; pass < 12; pass += 1) {
      let improved = false;
      for (let mealIndex = 0; mealIndex < adjustableMeals.length; mealIndex += 1) {
        for (const factor of factorOptions) {
          const candidate = [...bestFactors];
          candidate[mealIndex] = factor;
          const score = scoreFactors(candidate);
          if (score < bestScore - 1e-6) {
            bestScore = score;
            bestFactors = candidate;
            improved = true;
          }
        }
      }
      if (!improved) break;
    }

    adjustableMeals.forEach((meal, index) => {
      factorByMealIndex.set(meal.index, bestFactors[index]);
    });
  }

  if (factorByMealIndex.size === 0) return day;

  return {
    ...day,
    meals: day.meals.map((meal, index) => {
      const factor = factorByMealIndex.get(index);
      return factor == null ? meal : { ...meal, portion_factor: factor };
    }),
  };
}



// Deep-copy meals for day-copy: fresh linked_prep_group + linked_partner_group IDs (shared across a paired copy via caller-supplied maps).
export function remapMealsForCopy(
  arr: BuilderMeal[],
  groupMap: Map<string, string>,
  prepMap: Map<string, string>,
): BuilderMeal[] {
  return arr.map((m) => {
    let lpg: string | null = null;
    if (m.linked_partner_group) {
      if (!groupMap.has(m.linked_partner_group))
        groupMap.set(m.linked_partner_group, makeGroupId());
      lpg = groupMap.get(m.linked_partner_group)!;
    }
    let prep: string | null = null;
    if (m.linked_prep_group) {
      if (!prepMap.has(m.linked_prep_group)) prepMap.set(m.linked_prep_group, makeGroupId());
      prep = prepMap.get(m.linked_prep_group)!;
    }
    return {
      ...m,
      ingredients: m.ingredients.map((i) => ({ ...i })),
      linked_prep_group: prep,
      linked_partner_group: lpg,
    };
  });
}

// Scale a portion factor from one person to another based on their kcal targets. Snapped to 0.25.
export function scaleFactorToTarget(
  fromFactor: number,
  fromTargetKcal: number,
  toTargetKcal: number,
): number {
  if (!fromTargetKcal || !toTargetKcal) return fromFactor;
  const raw = fromFactor * (toTargetKcal / fromTargetKcal);
  return Math.max(0.25, Math.min(4, Math.round(raw * 4) / 4));
}

export function scoreMeal(
  m: LibraryMeal,
  ctx: CustomerPlanContext,
  dayType: "training" | "rest",
  remaining: { kcal: number; p: number; c: number; f: number },
): { score: number; label: string; reasons: string[] } {
  const reasons: string[] = [];
  let score = 50;

  if (dayType === "training" && !m.suitable_training) score -= 25;
  if (dayType === "rest" && !m.suitable_rest) score -= 25;

  if (remaining.kcal > 0) {
    const kcalRatio = m.kcal / Math.max(200, remaining.kcal);
    if (kcalRatio >= 0.2 && kcalRatio <= 0.5) {
      score += 15;
      reasons.push("Kalorien passen");
    } else if (kcalRatio > 0.7) {
      score -= 15;
      reasons.push("Sehr kalorienreich");
    }
  }
  if (remaining.p > 0 && m.protein_g / Math.max(15, remaining.p) >= 0.25) {
    score += 10;
    reasons.push("Gute Proteinmenge");
  }

  // Prefer meals whose macro density matches what is still missing for the day.
  // This improves the actual meal combination before portion optimization runs.
  const remainingKcal = Math.max(200, remaining.kcal);
  const mealKcal = Math.max(1, Number(m.kcal));
  const macroDimensions = [
    { meal: Number(m.protein_g), remaining: remaining.p, weight: 1.15 },
    { meal: Number(m.carbs_g), remaining: remaining.c, weight: 1 },
    { meal: Number(m.fat_g), remaining: remaining.f, weight: 1 },
  ];
  let macroDensityScore = 0;
  let matchingMacroDimensions = 0;
  for (const dimension of macroDimensions) {
    if (dimension.remaining <= 0) {
      if (dimension.meal > 0) macroDensityScore -= 4 * dimension.weight;
      continue;
    }
    const targetDensity = dimension.remaining / remainingKcal;
    const mealDensity = dimension.meal / mealKcal;
    const densityRatio = Math.max(0.05, mealDensity / Math.max(0.001, targetDensity));
    const densityDifference = Math.abs(Math.log(densityRatio));
    macroDensityScore += Math.max(-12, 8 - densityDifference * 8) * dimension.weight;
    if (densityDifference <= 0.3) matchingMacroDimensions += 1;
  }
  score += macroDensityScore;
  if (matchingMacroDimensions >= 2) reasons.push("Makroprofil passt");

  const hay = [
    m.name,
    m.description ?? "",
    ...(m.tags ?? []),
    m.main_protein ?? "",
    m.main_carb ?? "",
    ...(m.ingredients ?? []).map((i) => i.name),
  ]
    .join(" ")
    .toLowerCase();

  for (const allergen of [...ctx.allergies, ...ctx.intolerances]) {
    if (allergen && (m.no_go_ingredients.includes(allergen) || hay.includes(allergen))) {
      score -= 200;
      reasons.push(`Allergie/Intoleranz: ${allergen}`);
    }
  }
  for (const no of ctx.noGoFoods) {
    if (no && hay.includes(no)) {
      score -= 100;
      reasons.push(`No-Go: ${no}`);
    }
  }
  for (const fav of ctx.favoriteFoods) {
    if (fav && hay.includes(fav)) {
      score += 20;
      reasons.push(`Lieblingsfood: ${fav}`);
    }
  }

  if (ctx.dietStyle && !mealFitsDiet(m, ctx.dietStyle)) {
    score -= 500;
    reasons.push("Passt nicht zur Ernährungsform");
  }


  const prepStyle = (ctx.mealPrepStyle ?? "").toLowerCase();
  const wantsMealPrep =
    (ctx.eatingStyle ?? "").toLowerCase() === "meal_prep" ||
    prepStyle === "meal_prep" ||
    prepStyle === "2_3_week" ||
    prepStyle === "low_effort";
  if (wantsMealPrep) {
    if (m.mealprep_ok) {
      score += 12;
      reasons.push("Passt zum Mealprep");
    } else {
      score -= 30;
      reasons.push("Nicht mealprep-tauglich");
    }
  }
  if (prepStyle === "low_effort") {
    if (m.effort === "low") {
      score += 10;
      reasons.push("Wenig Aufwand");
    } else if (m.effort === "high") {
      score -= 25;
      reasons.push("Zu aufwendig");
    }
  }
  if ((ctx.budgetBand === "low" || ctx.budgetBand === "<50") && m.budget === "high") {
    score -= 15;
    reasons.push("Über Budget");
  }

  let label = "möglich";
  if (score >= 80) label = "sehr passend";
  else if (score >= 60) label = "passend";
  else if (score >= 30) label = "möglich";
  else label = "eher unpassend";

  return { score, label, reasons };
}

/* ---------------- Lebensmittel (Food-DB) → BuilderMeal ---------------- */

export type FoodPickInput = {
  name: string;
  brand?: string | null;
  unit?: "g" | "ml" | null;
  density_g_per_ml?: number | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

const round1 = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 10) / 10;

/**
 * Wandelt ein Lebensmittel aus der zentralen Datenbank plus Menge in eine
 * einfache BuilderMeal um. Werte beziehen sich immer auf 100 g bzw. 100 ml.
 */
export function mealFromFood(food: FoodPickInput, amount: number, slot: Slot): BuilderMeal {
  const unit: "g" | "ml" = food.unit === "ml" ? "ml" : "g";
  const safeAmount = Math.max(0, Number(amount) || 0);
  const factor = safeAmount / 100;
  const density = Number(food.density_g_per_ml);
  const grams =
    unit === "ml" ? safeAmount * (Number.isFinite(density) && density > 0 ? density : 1) : safeAmount;
  const label = food.brand ? `${food.name} (${food.brand})` : food.name;

  return {
    slot,
    name: `${label} · ${round1(safeAmount)} ${unit}`,
    description: null,
    library_meal_id: null,
    portion_factor: 1,
    ingredients: [
      { name: label, grams: Math.round(grams), amount: round1(safeAmount), unit },
    ],
    kcal: round1(Number(food.kcal_per_100g) * factor),
    protein_g: round1(Number(food.protein_per_100g) * factor),
    carbs_g: round1(Number(food.carbs_per_100g) * factor),
    fat_g: round1(Number(food.fat_per_100g) * factor),
  };
}

/** Suchfeld-Validierung für die Lebensmittel-Suche (min. 2 Zeichen). */
export function isFoodQueryValid(query: string): boolean {
  return query.trim().length >= 2;
}

/** Filtert Gerichte des Pickers nach Freitext über Name, Zutaten und Tags. */
export function matchesMealQuery(meal: LibraryMeal, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    meal.name,
    meal.description ?? "",
    meal.main_protein ?? "",
    meal.main_carb ?? "",
    ...(meal.tags ?? []),
    ...(meal.ingredients ?? []).map((ingredient) => ingredient.name),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}
