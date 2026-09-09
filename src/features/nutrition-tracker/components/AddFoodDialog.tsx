import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { CustomMeal, CustomMealIngredient } from "@/lib/custom-meals.functions";
import { amountToGrams, macroFactorForAmount } from "@/lib/food-units";
import { searchFoodsDb, type FoodResult } from "@/lib/nutrition.functions";
import { MEALS } from "../constants";
import { parseFavoriteRecipeName } from "../lib/favorite-recipe.logic";
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

function favoriteForFood(food: FoodResult, favorites: FavoriteFood[]): FavoriteFood | null {
  return (
    favorites.find(
      (favorite) =>
        favorite.name === food.name &&
        (favorite.brand ?? null) === (food.brand ?? null) &&
        (favorite.barcode ?? null) === (food.barcode ?? null),
    ) ?? null
  );
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
  if (!favoriteForFood(food, favorites)) return null;

  const targetName = normalizedMealName(food.name);
  return (
    customMeals.find(
      (meal) => meal.ingredients?.length && normalizedMealName(meal.name) === targetName,
    ) ?? null
  );
}

function makeResolvedFavoriteMeal(
  favorite: FavoriteFood,
  mealSlot: Meal,
  mealName: string,
  specs: NonNullable<ReturnType<typeof parseFavoriteRecipeName>>["ingredients"],
  foods: FoodResult[],
): CustomMeal | null {
  if (foods.length !== specs.length) return null;

  const ingredients: CustomMealIngredient[] = [];
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const food = foods[index];
    if (!food || food.unit !== spec.unit) return null;
    const factor = macroFactorForAmount(spec.amount);
    ingredients.push({
      name: spec.displayName,
      amount: Math.round(spec.amount * 10) / 10,
      unit: spec.unit,
      amount_g: Math.round(amountToGrams(food, spec.amount) * 10) / 10,
      kcal: Math.round(food.kcal_per_100g * factor),
      protein_g: Math.round(food.protein_per_100g * factor * 10) / 10,
      carbs_g: Math.round(food.carbs_per_100g * factor * 10) / 10,
      fat_g: Math.round(food.fat_per_100g * factor * 10) / 10,
    });
  }

  const totals = ingredients.reduce(
    (sum, ingredient) => ({
      kcal: sum.kcal + Number(ingredient.kcal ?? 0),
      protein_g: sum.protein_g + Number(ingredient.protein_g ?? 0),
      carbs_g: sum.carbs_g + Number(ingredient.carbs_g ?? 0),
      fat_g: sum.fat_g + Number(ingredient.fat_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return {
    id: favorite.fav_id,
    user_id: "",
    name: mealName,
    meal_slot: mealSlot,
    ingredients,
    kcal: Math.round(totals.kcal),
    protein_g: Math.round(totals.protein_g * 10) / 10,
    carbs_g: Math.round(totals.carbs_g * 10) / 10,
    fat_g: Math.round(totals.fat_g * 10) / 10,
    notes: null,
    image_url: null,
    image_status: null,
    image_path: null,
    image_source: null,
    image_error: null,
    image_generated_at: null,
    created_at: "",
    updated_at: "",
  };
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
  const searchDb = useServerFn(searchFoodsDb);
  const [resolvingFavorite, setResolvingFavorite] = useState(false);

  const pickFoodOrStructuredMeal = async (food: FoodResult, options?: FoodPickOptions) => {
    const structuredMeal = structuredMealForFood(food, customMeals, favorites);
    if (structuredMeal) {
      onPickCustomMeal(cloneCustomMeal(structuredMeal));
      return;
    }

    const favorite = favoriteForFood(food, favorites);
    const parsed = favorite ? parseFavoriteRecipeName(food.name) : null;
    if (favorite && parsed) {
      setResolvingFavorite(true);
      try {
        const matches = await Promise.all(
          parsed.ingredients.map((ingredient) =>
            searchDb({ data: { query: ingredient.searchName, limit: 8 } }),
          ),
        );
        const foods = matches.map((candidates, index) =>
          candidates.find((candidate) => candidate.unit === parsed.ingredients[index].unit),
        );
        if (foods.every((candidate): candidate is FoodResult => Boolean(candidate))) {
          const rebuilt = makeResolvedFavoriteMeal(
            favorite,
            openMeal,
            parsed.mealName,
            parsed.ingredients,
            foods,
          );
          if (rebuilt) {
            onPickCustomMeal(rebuilt);
            return;
          }
        }
        toast.info("Nicht alle Zutaten dieses alten Favoriten konnten sicher aufgelöst werden.");
      } catch {
        toast.info("Die Zutaten dieses Favoriten konnten gerade nicht vollständig geladen werden.");
      } finally {
        setResolvingFavorite(false);
      }
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

        {resolvingFavorite ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
            <div>
              <div className="text-sm font-semibold">Zutaten werden aufgelöst</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Mengen und Nährwerte werden aus dem BodyFuel-Lebensmittelkatalog geladen.
              </div>
            </div>
          </div>
        ) : pickingMeal ? (
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
