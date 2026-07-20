import { buildNutritionPlanGenerationContext } from "@/features/nutrition-plan-ai/lib/prompt-builder";
import { generateComputedNutritionPlan } from "@/features/nutrition-plan-ai/server/meal-computation.server";
import { loadNutritionPlanSourceData } from "@/features/nutrition-plan-ai/server/plan-data.server";
import { persistGeneratedNutritionPlan } from "@/features/nutrition-plan-ai/server/plan-persistence.server";
import type {
  GenerateNutritionPlanOpts,
  NutritionPlanSupabaseClient,
} from "@/features/nutrition-plan-ai/types";

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

  return persistGeneratedNutritionPlan({
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
  });
}
