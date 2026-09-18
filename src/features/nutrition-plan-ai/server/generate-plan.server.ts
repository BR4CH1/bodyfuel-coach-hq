import { buildNutritionPlanGenerationContext } from "@/features/nutrition-plan-ai/lib/prompt-builder";
import { generateComputedNutritionPlan } from "@/features/nutrition-plan-ai/server/meal-computation.server";
import { loadNutritionPlanSourceData } from "@/features/nutrition-plan-ai/server/plan-data.server";
import { persistGeneratedNutritionPlan } from "@/features/nutrition-plan-ai/server/plan-persistence.server";
import type {
  GenerateNutritionPlanOpts,
  NutritionPlanSupabaseClient,
} from "@/features/nutrition-plan-ai/types";
import {
  describeConstraintFailure,
  validateGeneratedPlan,
} from "@/lib/nutrition-plan-constraints";

export async function generateAiNutritionPlanCore(
  supabase: NutritionPlanSupabaseClient,
  opts: GenerateNutritionPlanOpts,
) {
  const uploadedBy = opts.uploadedBy ?? opts.target;
  const source = await loadNutritionPlanSourceData(supabase, opts.target);
  const context = buildNutritionPlanGenerationContext({ source, opts });
  const generatedPlan = await generateComputedNutritionPlan({
    supabase,
    apiKey: opts.apiKey,
    context,
  });

  // Abschluss-Validierung über ALLE Tage, Mahlzeiten und Zutaten.
  const validation = validateGeneratedPlan({
    days: generatedPlan.cleaned.map((day) => ({ name: day.name, meals: day.meals })),
    forbidden: context.forbidden,
    config: {
      dietRules: [],
      exclusionGroups: [],
      customExclusions: context.forbidden,
      mealsPerDay: 3,
      planDays: context.planDays,
    },
    targets: generatedPlan.cleaned.map((day) =>
      day.type === "rest" ? context.restTargets : context.trainingTargets,
    ),
    kcalTolerance: 0.2,
  });
  const nogoCheck = validation.checks.find((check) => check.id === "nogos");
  if (nogoCheck && !nogoCheck.ok) {
    throw new Error(describeConstraintFailure(validation));
  }

  const persisted = await persistGeneratedNutritionPlan({
    supabase,
    target: opts.target,
    uploadedBy,
    apiKey: opts.apiKey,
    title: opts.title,
    start: context.start,
    planDays: context.planDays,
    cleaned: generatedPlan.cleaned,
    unresolved: generatedPlan.unresolved,
    wishesData: context.wishesData,
    dayTargets: generatedPlan.cleaned.map((day) =>
      day.type === "rest" ? context.restTargets : context.trainingTargets,
    ),
  });

  return { ...persisted, validation };
}
