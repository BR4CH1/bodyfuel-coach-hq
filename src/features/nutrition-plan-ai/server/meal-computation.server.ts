import {
  addDeterministicCorrectionSnacks,
  cloneComputedMealForExpandedDay,
  containsForbiddenFood,
  ensureRequiredMealSlots,
  expandGeneratedDays,
  labelForSlot,
  splitOversizedMeals,
} from "@/features/nutrition-plan-ai/lib/plan.logic";
import { generateBasePlanDays } from "@/features/nutrition-plan-ai/server/ai-gateway.server";
import type {
  CleanedPlanDay,
  ComputedGeneratedMeal,
  ComputedPlanGeneration,
  GeneratedDay,
  GeneratedMeal,
  MacroTarget,
  NutritionPlanGenerationContext,
  NutritionPlanSupabaseClient,
  RawPlanDay,
  UnresolvedIngredient,
} from "@/features/nutrition-plan-ai/types";

const MAX_GENERATION_ATTEMPTS = 3;

function sumMealMacros(meals: ComputedGeneratedMeal[]): MacroTarget {
  return meals.reduce(
    (sum, meal) => ({
      kcal: sum.kcal + (Number(meal.kcal) || 0),
      protein_g: sum.protein_g + (Number(meal.protein_g) || 0),
      carbs_g: sum.carbs_g + (Number(meal.carbs_g) || 0),
      fat_g: sum.fat_g + (Number(meal.fat_g) || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

function buildMissingSlotsCorrectionNote(missing: string[], attempt: number): string {
  return `⚠️ RETRY (${attempt}/${MAX_GENERATION_ATTEMPTS - 1}): Es fehlten Pflicht-Mahlzeiten: ${missing.join("; ")}. Bitte JETZT wirklich für JEDEN Basistag Frühstück + Mittag + Abend + mind. 1 Snack liefern.`;
}

function buildUnresolvedCorrectionNote(
  unresolved: UnresolvedIngredient[],
  attempt: number,
): string {
  const uniqueIngredients = Array.from(
    new Set(
      unresolved.map(
        (ingredient) =>
          `${ingredient.name}${ingredient.food_id ? ` (food_id="${ingredient.food_id}")` : ""}`,
      ),
    ),
  ).slice(0, 20);

  return `⚠️ RETRY ${attempt}/${MAX_GENERATION_ATTEMPTS - 1}: Folgende Zutaten waren im vorherigen Versuch NICHT im geschlossenen Lebensmittel-Katalog:\n- ${uniqueIngredients.join("\n- ")}\n\nBitte generiere den Plan komplett neu und verwende AUSSCHLIESSLICH text_ids aus dem SAFE FOOD POOL oben. Jede Zutat MUSS ein Feld "food_id" mit einer text_id aus der Liste haben. Wähle die nächstpassende Alternative für die oben genannten Zutaten.`;
}

function buildProteinCorrectionNote(breaches: string[], attempt: number): string {
  return `⚠️ RETRY ${attempt}/${MAX_GENERATION_ATTEMPTS - 1}: Die aus den Zutaten berechnete Protein-Tagessumme lag über der harten Obergrenze:\n- ${breaches.slice(0, 8).join("\n- ")}\n\nGeneriere den Plan neu. Reduziere proteinreiche Zutaten so weit, dass jeder Tag höchstens seinen angegebenen Proteinwert erreicht. Ersetze die frei werdenden Kalorien durch kohlenhydratreiche Zutaten aus dem SAFE FOOD POOL.`;
}

function buildRawDays(
  generatedDays: GeneratedDay[],
  context: NutritionPlanGenerationContext,
): RawPlanDay[] {
  const days = expandGeneratedDays(generatedDays, context.schedule, context.planDays);
  return days.map((day, index) => {
    const scheduledDay = context.schedule[index] ?? context.schedule.at(-1);
    if (!scheduledDay) throw new Error("Ernährungsplan enthält keinen gültigen Tagesplan.");

    const typeLabel = scheduledDay.type === "rest" ? "Restday" : "Trainingstag";
    const allowedMeals = (day.meals ?? []).filter((meal) => {
      const searchableText =
        `${meal.name} ${meal.description ?? ""} ${JSON.stringify(meal.ingredients ?? [])}`.toLowerCase();
      return !containsForbiddenFood(searchableText, context.forbidden);
    });

    return {
      name: `${scheduledDay.wkLabel} — ${typeLabel}`,
      type: scheduledDay.type,
      target: scheduledDay.type === "rest" ? context.restTargets : context.trainingTargets,
      meals: allowedMeals,
    };
  });
}

function repairRequiredMealSlots(
  rawDays: RawPlanDay[],
  context: NutritionPlanGenerationContext,
): RawPlanDay[] {
  return rawDays.map((day) => ({
    ...day,
    meals: ensureRequiredMealSlots(
      day.meals,
      day.type,
      day.target,
      context.forbidden,
      context.isNoCook,
    ),
  }));
}

function findMissingRequiredSlots(days: RawPlanDay[]): string[] {
  return days.flatMap((day, index) => {
    const presentSlots = new Set(day.meals.map((meal) => meal.slot));
    return (["breakfast", "lunch", "dinner"] as const)
      .filter((slot) => !presentSlots.has(slot))
      .map((slot) => `Tag ${index + 1}: ${labelForSlot(slot)} fehlt`);
  });
}

export async function generateComputedNutritionPlan(input: {
  supabase: NutritionPlanSupabaseClient;
  apiKey: string;
  context: NutritionPlanGenerationContext;
}): Promise<ComputedPlanGeneration> {
  const { supabase, apiKey, context } = input;
  const {
    computeMealFromIngredients,
    computeMealFromDescription,
    coerceIngredients,
    isUsableEngineResult,
    parseDescriptionToEngineIngredients,
  } = await import("@/lib/nutrition-engine.server");

  let lastCleaned: CleanedPlanDay[] | null = null;
  let lastUnresolved: UnresolvedIngredient[] = [];
  let lastProteinBreaches: string[] = [];
  let correctionNote = "";

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const generatedDays = await generateBasePlanDays({
      apiKey,
      prompt: context.prompt,
      correctionNote,
      aiPlanDays: context.aiPlanDays,
      aiSchedule: context.aiSchedule,
    });
    const repairedRawDays = repairRequiredMealSlots(buildRawDays(generatedDays, context), context);
    const missingRequired = findMissingRequiredSlots(repairedRawDays);

    if (missingRequired.length > 0 && attempt >= MAX_GENERATION_ATTEMPTS) {
      throw new Error(`Plan unvollständig: ${missingRequired.slice(0, 6).join("; ")}.`);
    }
    if (missingRequired.length > 0) {
      correctionNote = buildMissingSlotsCorrectionNote(missingRequired, attempt);
      continue;
    }

    const attemptUnresolved: UnresolvedIngredient[] = [];
    const attemptProteinBreaches: string[] = [];
    const baseCache = new Map<string, Promise<ComputedGeneratedMeal[]>>();

    const computeDayMeals = async (
      day: RawPlanDay,
      dayIndex: number,
    ): Promise<ComputedGeneratedMeal[]> => {
      const computed = await Promise.all(
        day.meals.map(async (meal: GeneratedMeal): Promise<ComputedGeneratedMeal> => {
          const structuredIngredients = coerceIngredients(meal.ingredients ?? null);
          const ingredientsForMath = structuredIngredients.length
            ? structuredIngredients
            : parseDescriptionToEngineIngredients(meal.description ?? null);
          const result = structuredIngredients.length
            ? await computeMealFromIngredients(supabase, structuredIngredients, {
                smartOnly: true,
                requireResolvedIds: true,
              })
            : await computeMealFromDescription(supabase, meal.description ?? null, {
                smartOnly: true,
                requireResolvedIds: true,
              });

          for (const unresolved of result?.unresolved_ingredients ?? []) {
            attemptUnresolved.push({
              day: day.name,
              meal: meal.name,
              name: unresolved.name,
              food_id: unresolved.food_id ?? null,
            });
          }

          const usable = isUsableEngineResult(result);
          return {
            ...meal,
            ingredients: ingredientsForMath,
            kcal: usable ? result.kcal : 0,
            protein_g: usable ? result.protein_g : 0,
            carbs_g: usable ? result.carbs_g : 0,
            fat_g: usable ? result.fat_g : 0,
            _compute_warnings: result?.warnings ?? [],
            _data_source: result?.data_source ?? "ai_estimate",
            _verified_ratio: result?.coverage ?? 0,
          };
        }),
      );

      let correctedMeals = splitOversizedMeals(computed);
      correctedMeals = await addDeterministicCorrectionSnacks(
        correctedMeals,
        day.target,
        sumMealMacros(correctedMeals),
        supabase,
        computeMealFromIngredients,
        isUsableEngineResult,
        context.forbidden,
      );

      const finalSums = sumMealMacros(correctedMeals);
      if (finalSums.protein_g > day.target.protein_g) {
        attemptProteinBreaches.push(
          `${day.name}: ${Math.round(finalSums.protein_g)} g statt max. ${day.target.protein_g} g`,
        );
      }
      const kcalDeviation =
        Math.abs(finalSums.kcal - day.target.kcal) / Math.max(1, day.target.kcal);
      const macroDeviation =
        Math.abs(finalSums.protein_g - day.target.protein_g) > 20 ||
        Math.abs(finalSums.carbs_g - day.target.carbs_g) > 30 ||
        Math.abs(finalSums.fat_g - day.target.fat_g) > 20;
      if (kcalDeviation > 0.15 || macroDeviation) {
        console.warn("Nutrition plan target deviation", {
          day: dayIndex + 1,
          target: day.target,
          actual: finalSums,
        });
      }

      return correctedMeals;
    };

    const cleaned = await Promise.all(
      repairedRawDays.map(async (day, dayIndex): Promise<CleanedPlanDay> => {
        const cacheKey = `${day.type}:${JSON.stringify(day.meals)}`;
        let cachedMeals = baseCache.get(cacheKey);
        if (!cachedMeals) {
          cachedMeals = computeDayMeals(day, dayIndex);
          baseCache.set(cacheKey, cachedMeals);
        }
        return {
          name: day.name,
          type: day.type,
          meals: (await cachedMeals).map(cloneComputedMealForExpandedDay),
        };
      }),
    );

    lastCleaned = cleaned;
    lastUnresolved = attemptUnresolved;
    lastProteinBreaches = attemptProteinBreaches;
    if (attemptUnresolved.length === 0 && attemptProteinBreaches.length === 0) break;
    if (attempt < MAX_GENERATION_ATTEMPTS) {
      correctionNote = attemptUnresolved.length
        ? buildUnresolvedCorrectionNote(attemptUnresolved, attempt)
        : buildProteinCorrectionNote(attemptProteinBreaches, attempt);
    }
  }

  if (!lastCleaned) {
    throw new Error("Der Ernährungsplan konnte nicht berechnet werden.");
  }
  if (lastProteinBreaches.length > 0) {
    throw new Error(
      `Protein-Obergrenze konnte nicht eingehalten werden: ${lastProteinBreaches.slice(0, 6).join("; ")}.`,
    );
  }

  return { cleaned: lastCleaned, unresolved: lastUnresolved };
}
