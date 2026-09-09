import type { CustomMeal } from "@/lib/custom-meals.functions";
import type { FoodResult } from "@/lib/nutrition.functions";
import { MEALS } from "../constants";
import { parseFoodAmount } from "../lib/nutrition-tracker.logic";
import type {
  AddFoodSource,
  FavoriteCandidate,
  FoodAmountMode,
  FavoriteFood,
  FoodPickOptions,
  FoodUnit,
  Meal,
  RecentFood,
} from "../types";
import { CustomMealPortionEditor } from "./CustomMealPortionEditor";
import { CustomMealsPanel } from "./CustomMealsPanel";
import { FoodAmountEditor } from "./FoodAmountEditor";
import { FoodSearchPanel } from "./FoodSearchPanel";

function cloneCustomMeal(meal: CustomMeal): CustomMeal {
  return {
    ...meal,
    ingredients: (meal.ingredients ?? []).map((ingredient) => ({ ...ingredient })),
  };
}

function normalizedMealName(value: string): string {
  return value
    .replace(/\s+\([0-9]+(?:[.,][0-9]+)?×\)\s*$/i, "")
    .trim()
    .toLocaleLowerCase("de-DE");
}

function structuredMealForFood(
  food: FoodResult,
  customMeals: CustomMeal[],
  favorites: FavoriteFood[],
): CustomMeal | null {
  const source = String(food.source ?? "");
  const sourceMatch = /^custom:([0-9a-f-]{36})$/i.exec(source);
  if (sourceMatch) {
    const byId = customMeals.find((meal) => meal.id === sourceMatch[1]);
    if (byId?.ingredients?.length) return byId;
  }

  // Older favorites may have lost the custom:<id> source while keeping the
  // exact meal name. Only use the name fallback for actual favorites so a
  // normal food search result cannot accidentally open a recipe editor.
  const isFavorite = favorites.some(
    (favorite) =>
      favorite.name === food.name &&
      (favorite.brand ?? null) === (food.brand ?? null) &&
      (favorite.barcode ?? null) === (food.barcode ?? null),
  );
  if (!isFavorite) return null;

  const targetName = normalizedMealName(food.name);
  return (
    customMeals.find(
      (meal) => meal.ingredients?.length && normalizedMealName(meal.name) === targetName,
    ) ?? null
  );
}

export function AddFoodDialog({
  openMeal,
  picking,
  source,
  query,
  searching,
  results,
  favorites,
  recentFoods,
  loadingFavorites,
  loadingRecent,
  customMeals,
  loadingMeals,
  isCoach,
  unit,
  amountStr,
  amountMode,
  estimatingAi,
  onClose,
  onSourceChange,
  onQueryChange,
  onSearch,
  onOpenScanner,
  onOpenPhoto,
  onPickFood,
  onToggleFavorite,
  isFavorite,
  onOpenBuilder,
  onAddCustomMeal,
  pickingMeal,
  portionStr,
  savingMeal,
  onPortionChange,
  onPickCustomMeal,
  onBackToMeals,
  onAmountChange,
  onAmountModeChange,
  onBack,
  onAddPicked,
  onEstimateAi,
}: {
  openMeal: Meal;
  picking: FoodResult | null;
  source: AddFoodSource;
  query: string;
  searching: boolean;
  results: FoodResult[];
  favorites: FavoriteFood[];
  recentFoods: RecentFood[];
  loadingFavorites: boolean;
  loadingRecent: boolean;
  customMeals: CustomMeal[];
  loadingMeals: boolean;
  isCoach: boolean;
  unit: FoodUnit;
  amountStr: string;
  amountMode: FoodAmountMode;
  estimatingAi: boolean;
  onClose: () => void;
  onEstimateAi: () => void;
  onSourceChange: (source: AddFoodSource) => void;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onOpenScanner: () => void;
  onOpenPhoto: () => void;
  onPickFood: (food: FoodResult, options?: FoodPickOptions) => void;
  onToggleFavorite: (food: FavoriteCandidate) => void;
  isFavorite: (food: FoodResult) => boolean;
  onOpenBuilder: () => void;
  onAddCustomMeal: () => void;
  pickingMeal: CustomMeal | null;
  portionStr: string;
  savingMeal: boolean;
  onPortionChange: (value: string) => void;
  onPickCustomMeal: (meal: CustomMeal) => void;
  onBackToMeals: () => void;
  onAmountChange: (value: string) => void;
  onAmountModeChange: (mode: FoodAmountMode) => void;
  onBack: () => void;
  onAddPicked: () => void;
}) {
  const mealLabel = MEALS.find((meal) => meal.key === openMeal)?.label;

  const pickFoodOrStructuredMeal = (food: FoodResult, options?: FoodPickOptions) => {
    const structuredMeal = structuredMealForFood(food, customMeals, favorites);
    if (structuredMeal) {
      onPickCustomMeal(cloneCustomMeal(structuredMeal));
      return;
    }
    onPickFood(food, options);
  };

  const pickCustomMeal = (meal: CustomMeal) => onPickCustomMeal(cloneCustomMeal(meal));

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden border-border bg-card sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">{mealLabel} — hinzufügen</div>
          <button
            onClick={onClose}
            className="rounded-md p-2 hover:bg-secondary"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {pickingMeal ? (
          <CustomMealPortionEditor
            meal={pickingMeal}
            portionStr={portionStr}
            saving={savingMeal}
            onPortionChange={onPortionChange}
            onBack={onBackToMeals}
            onAdd={onAddCustomMeal}
          />
        ) : !picking ? (
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <SourceTabs
              source={source}
              customMealCount={customMeals.length}
              onSourceChange={onSourceChange}
            />

            {source === "food" ? (
              <FoodSearchPanel
                query={query}
                searching={searching}
                results={results}
                favorites={favorites}
                recentFoods={recentFoods}
                loadingFavorites={loadingFavorites}
                loadingRecent={loadingRecent}
                isCoach={isCoach}
                estimatingAi={estimatingAi}
                onQueryChange={onQueryChange}
                onSearch={onSearch}
                onOpenScanner={onOpenScanner}
                onOpenPhoto={onOpenPhoto}
                onPickFood={pickFoodOrStructuredMeal}
                onToggleFavorite={onToggleFavorite}
                isFavorite={isFavorite}
                onEstimateAi={onEstimateAi}
              />
            ) : (
              <CustomMealsPanel
                meals={customMeals}
                loading={loadingMeals}
                onOpenBuilder={onOpenBuilder}
                onAddMeal={pickCustomMeal}
              />
            )}
          </div>
        ) : (
          <FoodAmountEditor
            food={picking}
            isCoach={isCoach}
            unit={unit}
            amountStr={amountStr}
            amountMode={amountMode}
            favorite={isFavorite(picking)}
            onToggleFavorite={() =>
              onToggleFavorite({
                ...picking,
                last_amount: parseFoodAmount(amountStr) || null,
              })
            }
            onAmountChange={onAmountChange}
            onAmountModeChange={onAmountModeChange}
            onBack={onBack}
            onAdd={onAddPicked}
          />
        )}
      </div>
    </div>
  );
}

function SourceTabs({
  source,
  customMealCount,
  onSourceChange,
}: {
  source: AddFoodSource;
  customMealCount: number;
  onSourceChange: (source: AddFoodSource) => void;
}) {
  return (
    <div className="mb-3 inline-flex shrink-0 self-start rounded-md border border-border bg-background/40 p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onSourceChange("food")}
        className={`rounded px-3 py-1.5 ${
          source === "food" ? "bg-gold text-primary-foreground" : "text-muted-foreground"
        }`}
      >
        Lebensmittel
      </button>
      <button
        type="button"
        onClick={() => onSourceChange("meal")}
        className={`rounded px-3 py-1.5 ${
          source === "meal" ? "bg-gold text-primary-foreground" : "text-muted-foreground"
        }`}
      >
        Mahlzeiten {customMealCount > 0 ? `(${customMealCount})` : ""}
      </button>
    </div>
  );
}
