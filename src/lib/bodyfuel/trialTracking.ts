import { TRIAL_NUTRITION } from "./trialPlans";

export type TrialDayKind = "training" | "rest";

export type TrialFoodEntryLike = {
  source?: string | null;
  name?: string | null;
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
};

const TRIAL_SOURCE_PREFIX = "trial-plan:";

export function trialMealEntrySource(dayId: string, variantId: string, mealIndex: number) {
  return `${TRIAL_SOURCE_PREFIX}${dayId}:${variantId}:${mealIndex}`;
}

export function getTrialMealMeta(entry: TrialFoodEntryLike) {
  const source = entry.source ?? "";
  if (source.startsWith(TRIAL_SOURCE_PREFIX)) {
    const [, dayId, variantId, indexRaw] = source.split(":");
    const mealIndex = Number(indexRaw);
    const day = TRIAL_NUTRITION.find((d) => d.id === dayId);
    if (day && variantId && Number.isInteger(mealIndex)) {
      return { key: trialMealEntrySource(dayId, variantId, mealIndex), kind: day.kind };
    }
    return null;
  }

  if (source !== "trial-plan") return null;
  const entryName = normalize(entry.name);
  for (const day of TRIAL_NUTRITION) {
    for (const variant of day.variants) {
      for (let i = 0; i < variant.meals.length; i += 1) {
        const meal = variant.meals[i];
        const canonicalName = normalize(`${meal.name} — ${meal.description}`);
        const macrosMatch =
          sameNumber(entry.kcal, meal.kcal) &&
          sameNumber(entry.protein_g, meal.protein_g) &&
          sameNumber(entry.carbs_g, meal.carbs_g) &&
          sameNumber(entry.fat_g, meal.fat_g);
        if ((entryName && entryName === canonicalName) || macrosMatch) {
          return { key: trialMealEntrySource(day.id, variant.id, i), kind: day.kind };
        }
      }
    }
  }
  return null;
}

export function trialMealTrackedKey(entry: TrialFoodEntryLike) {
  return getTrialMealMeta(entry)?.key ?? null;
}

export function entryMatchesActiveTrialDay(entry: TrialFoodEntryLike, activeKind: TrialDayKind) {
  const source = entry.source ?? "";
  if (!source.startsWith("trial-plan")) return true;
  return getTrialMealMeta(entry)?.kind === activeKind;
}

function normalize(value?: string | null) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function sameNumber(value: number | null | undefined, target: number) {
  return value != null && Math.round(Number(value)) === target;
}