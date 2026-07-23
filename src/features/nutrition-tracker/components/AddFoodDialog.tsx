import type { CustomMeal } from "@/lib/custom-meals.functions";
import type { FoodResult } from "@/lib/nutrition.functions";
import { MEALS } from "../constants";
import { parseFoodAmount } from "../lib/nutrition-tracker.logic";
import type {
  AddFoodSource,
  FavoriteCandidate,
  FavoriteFood,
  FoodPickOptions,
  FoodUnit,
  Meal,
  RecentFood,
} from "../types";
import { CustomMealsPanel } from "./CustomMealsPanel";
import { FoodAmountEditor } from "./FoodAmountEditor";
import { FoodSearchPanel } from "./FoodSearchPanel";

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
  onAmountChange,
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
  onClose: () => void;
  onSourceChange: (source: AddFoodSource) => void;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onOpenScanner: () => void;
  onOpenPhoto: () => void;
  onPickFood: (food: FoodResult, options?: FoodPickOptions) => void;
  onToggleFavorite: (food: FavoriteCandidate) => void;
  isFavorite: (food: FoodResult) => boolean;
  onOpenBuilder: () => void;
  onAddCustomMeal: (meal: CustomMeal) => void;
  onAmountChange: (value: string) => void;
  onBack: () => void;
  onAddPicked: () => void;
}) {
  const mealLabel = MEALS.find((meal) => meal.key === openMeal)?.label;

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

        {!picking ? (
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
                onQueryChange={onQueryChange}
                onSearch={onSearch}
                onOpenScanner={onOpenScanner}
                onOpenPhoto={onOpenPhoto}
                onPickFood={onPickFood}
                onToggleFavorite={onToggleFavorite}
                isFavorite={isFavorite}
              />
            ) : (
              <CustomMealsPanel
                meals={customMeals}
                loading={loadingMeals}
                onOpenBuilder={onOpenBuilder}
                onAddMeal={onAddCustomMeal}
              />
            )}
          </div>
        ) : (
          <FoodAmountEditor
            food={picking}
            isCoach={isCoach}
            unit={unit}
            amountStr={amountStr}
            favorite={isFavorite(picking)}
            onToggleFavorite={() =>
              onToggleFavorite({
                ...picking,
                last_amount: parseFoodAmount(amountStr) || null,
              })
            }
            onAmountChange={onAmountChange}
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
