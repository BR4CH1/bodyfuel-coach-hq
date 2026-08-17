import type { BuilderDay, CustomerPlanContext, LibraryMeal } from "@/lib/plan-builder.functions";
import {
  autoFillWeekImpl,
  autoFillWeekPairImpl,
  type AutoFillMode,
  type SharedSlotsMap,
} from "./plan-builder.logic";

export type AutoFillStrategy = "profile" | "variety" | "mealprep";

function explicitMealPrepDays(context: CustomerPlanContext): number {
  const configured = Number(context.mealPrepDays);
  if (Number.isFinite(configured) && configured >= 2) {
    return Math.max(2, Math.min(7, Math.round(configured)));
  }
  return 3;
}

/**
 * Creates an ephemeral planning context for an explicit auto-fill strategy.
 * The stored customer profile is never mutated.
 */
export function contextForAutoFillStrategy(
  context: CustomerPlanContext,
  strategy: AutoFillStrategy,
  sharedMealPrepDays?: number,
): CustomerPlanContext {
  if (strategy === "profile") return context;

  if (strategy === "variety") {
    return {
      ...context,
      varietyLevel: "high",
      mealPrepStyle: "daily",
      eatingStyle: null,
      mealPrepDays: 1,
    };
  }

  const mealPrepDays = sharedMealPrepDays ?? explicitMealPrepDays(context);
  return {
    ...context,
    varietyLevel: "low",
    mealPrepStyle: "meal_prep",
    eatingStyle: "meal_prep",
    mealPrepDays: Math.max(2, Math.min(7, Math.round(mealPrepDays))),
  };
}

export function autoFillWeekWithStrategy(
  days: BuilderDay[],
  context: CustomerPlanContext,
  library: LibraryMeal[],
  mode: AutoFillMode,
  strategy: AutoFillStrategy,
) {
  return autoFillWeekImpl(days, contextForAutoFillStrategy(context, strategy), library, mode);
}

export function autoFillWeekPairWithStrategy(
  clientDays: BuilderDay[],
  partnerDays: BuilderDay[],
  clientContext: CustomerPlanContext,
  partnerContext: CustomerPlanContext,
  library: LibraryMeal[],
  mode: AutoFillMode,
  sharedSlots: SharedSlotsMap,
  strategy: AutoFillStrategy,
) {
  if (strategy !== "mealprep") {
    return autoFillWeekPairImpl(
      clientDays,
      partnerDays,
      contextForAutoFillStrategy(clientContext, strategy),
      contextForAutoFillStrategy(partnerContext, strategy),
      library,
      mode,
      sharedSlots,
    );
  }

  // Shared partner meals must use the same prep cadence. Prefer the more
  // conservative cadence if both profiles already specify a real prep span.
  const sharedMealPrepDays = Math.min(
    explicitMealPrepDays(clientContext),
    explicitMealPrepDays(partnerContext),
  );

  return autoFillWeekPairImpl(
    clientDays,
    partnerDays,
    contextForAutoFillStrategy(clientContext, strategy, sharedMealPrepDays),
    contextForAutoFillStrategy(partnerContext, strategy, sharedMealPrepDays),
    library,
    mode,
    sharedSlots,
  );
}
