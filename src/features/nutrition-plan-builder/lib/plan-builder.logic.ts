import type {
  LibraryMeal,
  CustomerPlanContext,
  BuilderDay,
  BuilderMeal,
} from "@/lib/plan-builder.functions";

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

export function buildBuilderDays(
  previous: BuilderDay[],
  startDate: string,
  numDays: number,
  trainingWeekdays: number[],
): BuilderDay[] {
  const next: BuilderDay[] = [];
  const weekdayLabels = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  for (let index = 0; index < numDays; index += 1) {
    const iso = addDays(startDate, index);
    const date = new Date(`${iso}T00:00:00Z`);
    const weekday = date.getUTCDay();
    const existing = previous[index];
    const autoType: BuilderDay["type"] = trainingWeekdays.includes(weekday) ? "training" : "rest";
    const type = existing?.typeOverride ? existing.type : autoType;
    const dateLabel = `${weekdayLabels[weekday]} ${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

    next.push({
      name: `Tag ${index + 1} · ${dateLabel}`,
      type,
      typeOverride: existing?.typeOverride ?? false,
      meals: existing?.meals ?? [],
      prepCoupleLunchDinner: existing?.prepCoupleLunchDinner ?? false,
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
  const lib = library.find((x) => x.id === m.library_meal_id);
  const f = m.portion_factor && m.portion_factor > 0 ? m.portion_factor : 1;
  if (!lib) return { kcal: 0, p: 0, c: 0, f: 0 };
  return {
    kcal: Number(lib.kcal) * f,
    p: Number(lib.protein_g) * f,
    c: Number(lib.carbs_g) * f,
    f: Number(lib.fat_g) * f,
  };
}

export type AutoFillMode = "empty_only" | "all_unlocked";

export function targetsFor(day: BuilderDay, ctx: CustomerPlanContext) {
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
  const relativeKcalDifference = target.kcal
    ? Math.abs(totals.kcal - target.kcal) / target.kcal
    : 0;

  return {
    totals,
    target,
    filledSlots,
    totalSlots: SLOTS.length,
    isComplete: filledSlots === SLOTS.length,
    isBalanced: filledSlots === SLOTS.length && relativeKcalDifference <= 0.1,
  };
}

export function macroProgress(value: number, target: number): number {
  if (!target) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

// Returns { day, missing: Slot[] } — never touches locked meals.
export function autoFillDayImpl(
  day: BuilderDay,
  ctx: CustomerPlanContext,
  library: LibraryMeal[],
  mode: AutoFillMode,
): { day: BuilderDay; missing: Slot[] } {
  let meals: BuilderMeal[] = day.meals.map((m) => ({ ...m }));
  // In "all_unlocked" mode: remove unlocked meals before filling
  if (mode === "all_unlocked") {
    meals = meals.filter((m) => m.is_locked);
  }
  const target = targetsFor(day, ctx);
  const slotOrder: Slot[] = ["breakfast", "lunch", "dinner", "snack"];
  const missing: Slot[] = [];

  const remaining = () => {
    const cur = meals.reduce(
      (acc, m) => {
        const mm = mealMacros(m, library);
        return { kcal: acc.kcal + mm.kcal, p: acc.p + mm.p, c: acc.c + mm.c, f: acc.f + mm.f };
      },
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
    return {
      kcal: target.kcal - cur.kcal,
      p: target.p - cur.p,
      c: target.c - cur.c,
      f: target.f - cur.f,
    };
  };

  for (const slot of slotOrder) {
    const existing = meals.find((m) => m.slot === slot);
    if (existing) continue; // locked or (empty_only) user meal → keep

    const candidates = library
      .filter((m) => m.category === slot)
      .map((m) => ({ meal: m, ...scoreMeal(m, ctx, day.type, remaining()) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best) {
      missing.push(slot);
      continue;
    }

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
          const clone = mealFromLibrary(src, slot, 1, groupId);
          if (slot === "dinner")
            clone.description = (src.description ?? "") + " (Portion 2 aus Mealprep)";
          meals.push(clone);
        }
        continue;
      }
      const groupId = makeGroupId();
      const lunch = mealFromLibrary(best.meal, "lunch", 1, groupId);
      const dinner = mealFromLibrary(best.meal, "dinner", 1, groupId);
      dinner.description = (best.meal.description ?? "") + " (Portion 2 aus Mealprep)";
      meals = meals.filter((m) => (m.slot !== "lunch" && m.slot !== "dinner") || m.is_locked);
      meals.push(lunch, dinner);
      continue;
    }
    meals.push(mealFromLibrary(best.meal, slot));
  }
  return { day: { ...day, meals }, missing };
}

// Auto-fill for two linked days (partner mode).
// Strategy per slot: prefer a shared meal (score > 0 for both, quantities scaled per person).
// Fallback: independent picks per person.
export type SharedSlotsMap = Record<Slot, boolean>;

export function autoFillDayPair(
  clientDay: BuilderDay,
  partnerDay: BuilderDay,
  clientCtx: CustomerPlanContext,
  partnerCtx: CustomerPlanContext,
  library: LibraryMeal[],
  mode: AutoFillMode,
  sharedSlots: SharedSlotsMap = { breakfast: true, lunch: true, dinner: true, snack: true },
): { client: BuilderDay; partner: BuilderDay; missing: number } {
  const filterKeep = (arr: BuilderMeal[]) =>
    mode === "all_unlocked" ? arr.filter((m) => m.is_locked) : arr.map((m) => ({ ...m }));
  const clientMeals: BuilderMeal[] = filterKeep(clientDay.meals);
  const partnerMeals: BuilderMeal[] = filterKeep(partnerDay.meals);

  const slotOrder: Slot[] = ["breakfast", "lunch", "dinner", "snack"];
  let missing = 0;

  const remainingFor = (meals: BuilderMeal[], day: BuilderDay, ctx: CustomerPlanContext) => {
    const t = targetsFor(day, ctx);
    const cur = meals.reduce(
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
      const cRem = remainingFor(clientMeals, clientDay, clientCtx);
      const pRem = remainingFor(partnerMeals, partnerDay, partnerCtx);
      const scored = library
        .filter((m) => m.category === slot)
        .map((m) => {
          const sc = scoreMeal(m, clientCtx, clientDay.type, cRem);
          const sp = scoreMeal(m, partnerCtx, partnerDay.type, pRem);
          return { meal: m, combined: sc.score + sp.score, sc: sc.score, sp: sp.score };
        })
        .filter((x) => x.sc > 0 && x.sp > 0)
        .sort((a, b) => b.combined - a.combined);
      const best = scored[0];
      if (best) {
        const group = makeGroupId();
        // per-person kcal scaling
        const scale = (rem: { kcal: number }, kcal: number) => {
          if (!kcal) return 1;
          const target = Math.max(200, rem.kcal);
          const raw = target / kcal;
          return Math.max(0.25, Math.min(2, Math.round(raw * 4) / 4));
        };
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
      const cRem = remainingFor(clientMeals, clientDay, clientCtx);
      const cCand = library
        .filter((m) => m.category === slot)
        .map((m) => ({ meal: m, ...scoreMeal(m, clientCtx, clientDay.type, cRem) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (cCand) clientMeals.push(mealFromLibrary(cCand.meal, slot));
      else missing++;
    }
    if (!pExisting) {
      const pRem = remainingFor(partnerMeals, partnerDay, partnerCtx);
      const pCand = library
        .filter((m) => m.category === slot)
        .map((m) => ({ meal: m, ...scoreMeal(m, partnerCtx, partnerDay.type, pRem) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (pCand) partnerMeals.push(mealFromLibrary(pCand.meal, slot));
      else missing++;
    }
  }

  return {
    client: { ...clientDay, meals: clientMeals },
    partner: { ...partnerDay, meals: partnerMeals },
    missing,
  };
}

// Re-scales unlocked meal portions so day kcal ≈ target kcal.
export function rebalanceDay(
  day: BuilderDay,
  ctx: CustomerPlanContext,
  library: LibraryMeal[],
): BuilderDay {
  const t = targetsFor(day, ctx).kcal;
  const lockedKcal = day.meals
    .filter((meal) => meal.is_locked)
    .reduce((sum, meal) => sum + mealMacros(meal, library).kcal, 0);
  const unlockedKcal = day.meals
    .filter((meal) => !meal.is_locked)
    .reduce((sum, meal) => sum + mealMacros(meal, library).kcal, 0);
  if (!t || !unlockedKcal) return day;
  const scale = Math.max(0, t - lockedKcal) / unlockedKcal;
  if (scale > 0.92 && scale < 1.08) return day;
  return {
    ...day,
    meals: day.meals.map((m) => {
      if (m.is_locked) return m;
      const nf = Math.max(0.25, Math.min(4, Math.round((m.portion_factor ?? 1) * scale * 4) / 4));
      return { ...m, portion_factor: nf };
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

  if (ctx.dietStyle) {
    const ds = ctx.dietStyle.toLowerCase();
    if (ds.includes("vegan") && !m.tags.includes("vegan")) {
      score -= 100;
      reasons.push("Nicht vegan");
    }
    if (ds.includes("veget") && !m.tags.includes("vegetarian") && !m.tags.includes("vegan")) {
      if (/hähnchen|pute|rind|lachs|fisch|thunfisch/.test(hay)) {
        score -= 100;
        reasons.push("Nicht vegetarisch");
      }
    }
  }

  if (ctx.mealPrepStyle && ctx.mealPrepStyle.toLowerCase().includes("prep") && !m.mealprep_ok) {
    score -= 10;
    reasons.push("Nicht mealprep-tauglich");
  }
  if (ctx.budgetBand === "low" && m.budget === "high") {
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
