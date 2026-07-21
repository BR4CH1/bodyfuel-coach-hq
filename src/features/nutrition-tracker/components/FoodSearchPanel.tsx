import { Barcode, Camera, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FoodResult } from "@/lib/nutrition.functions";
import type { FavoriteCandidate, FavoriteFood, FoodPickOptions, RecentFood } from "../types";
import { FavoriteButton, FoodNutritionLine, FoodResultRow, FoodThumb } from "./FoodResultRow";

export function FoodSearchPanel({
  query,
  searching,
  results,
  favorites,
  recentFoods,
  loadingFavorites,
  loadingRecent,
  aiEstimating,
  isCoach,
  onQueryChange,
  onSearch,
  onOpenScanner,
  onOpenPhoto,
  onPickFood,
  onToggleFavorite,
  isFavorite,
  onEstimateWithAi,
}: {
  query: string;
  searching: boolean;
  results: FoodResult[];
  favorites: FavoriteFood[];
  recentFoods: RecentFood[];
  loadingFavorites: boolean;
  loadingRecent: boolean;
  aiEstimating: boolean;
  isCoach: boolean;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onOpenScanner: () => void;
  onOpenPhoto: () => void;
  onPickFood: (food: FoodResult, options?: FoodPickOptions) => void;
  onToggleFavorite: (food: FavoriteCandidate) => void;
  isFavorite: (food: FoodResult) => boolean;
  onEstimateWithAi: () => void;
}) {
  const hasQuery = query.trim() !== "";

  return (
    <>
      <div className="flex shrink-0 gap-2">
        <Input
          autoFocus
          placeholder="z.B. Ei, Skyr, Haferflocken…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onSearch()}
        />
        <Button variant="outline" onClick={onOpenScanner} title="Barcode">
          <Barcode className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={onOpenPhoto}
          title="Gericht fotografieren"
          className="border-gold/50 text-gold hover:bg-gold/10"
        >
          <Camera className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {!hasQuery && (
          <FoodSuggestions
            favorites={favorites}
            recentFoods={recentFoods}
            loadingFavorites={loadingFavorites}
            loadingRecent={loadingRecent}
            isFavorite={isFavorite}
            onPickFood={onPickFood}
            onToggleFavorite={onToggleFavorite}
          />
        )}

        {hasQuery && results.length === 0 && (
          <EmptySearchState
            searching={searching}
            aiEstimating={aiEstimating}
            onEstimateWithAi={onEstimateWithAi}
          />
        )}

        {hasQuery && results.length > 0 && !searching && (
          <div className="flex justify-end pb-2">
            <button
              type="button"
              onClick={onEstimateWithAi}
              disabled={aiEstimating}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gold disabled:opacity-50"
            >
              {aiEstimating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Schätzt…
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" /> Nichts passt? Schätzung
                </>
              )}
            </button>
          </div>
        )}

        <ul className="divide-y divide-border">
          {results.map((food, index) => (
            <FoodResultRow
              key={`${food.barcode ?? food.name}-${food.brand ?? ""}-${index}`}
              food={food}
              isCoach={isCoach}
              favorite={isFavorite(food)}
              showServing
              onPick={() => onPickFood(food)}
              onToggleFavorite={() => onToggleFavorite(food)}
            />
          ))}
        </ul>
      </div>
    </>
  );
}

function FoodSuggestions({
  favorites,
  recentFoods,
  loadingFavorites,
  loadingRecent,
  isFavorite,
  onPickFood,
  onToggleFavorite,
}: {
  favorites: FavoriteFood[];
  recentFoods: RecentFood[];
  loadingFavorites: boolean;
  loadingRecent: boolean;
  isFavorite: (food: FoodResult) => boolean;
  onPickFood: (food: FoodResult, options?: FoodPickOptions) => void;
  onToggleFavorite: (food: FavoriteCandidate) => void;
}) {
  return (
    <>
      {favorites.length > 0 && (
        <div className="mb-4">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gold">
            ★ Favoriten
          </div>
          <ul className="divide-y divide-border">
            {favorites.map((food) => (
              <li key={`fav-${food.fav_id}`} className="flex items-center">
                <button
                  onClick={() =>
                    onPickFood(food, {
                      unit: food.serving_g ? "piece" : "g",
                      amount:
                        food.last_amount_g != null
                          ? String(Math.round(food.last_amount_g))
                          : food.serving_g
                            ? "1"
                            : "100",
                    })
                  }
                  className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left hover:bg-secondary"
                >
                  <FoodThumb food={food} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{food.name}</div>
                    <FoodNutritionLine food={food} />
                  </div>
                </button>
                <FavoriteButton active onClick={() => onToggleFavorite(food)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentFoods.length > 0 ? (
        <div>
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Zuletzt getrackt
          </div>
          <ul className="divide-y divide-border">
            {recentFoods.map((food, index) => (
              <li
                key={`recent-${food.barcode ?? food.name}-${index}`}
                className="flex items-center"
              >
                <button
                  onClick={() =>
                    onPickFood(food, {
                      unit: "g",
                      amount: String(Math.round(food.last_amount_g)),
                    })
                  }
                  className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left hover:bg-secondary"
                >
                  <FoodThumb food={food} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{food.name}</div>
                    <FoodNutritionLine food={food} />
                  </div>
                </button>
                <FavoriteButton active={isFavorite(food)} onClick={() => onToggleFavorite(food)} />
              </li>
            ))}
          </ul>
        </div>
      ) : favorites.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {loadingRecent || loadingFavorites
            ? "Lade…"
            : "Tippe los — Vorschläge erscheinen automatisch"}
        </p>
      ) : null}
    </>
  );
}

function EmptySearchState({
  searching,
  aiEstimating,
  onEstimateWithAi,
}: {
  searching: boolean;
  aiEstimating: boolean;
  onEstimateWithAi: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        {searching ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Suche…
          </>
        ) : (
          "Keine Treffer in der Datenbank"
        )}
      </p>
      {!searching && (
        <Button
          size="sm"
          variant="outline"
          onClick={onEstimateWithAi}
          disabled={aiEstimating}
          className="gap-2 border-gold/40 text-gold hover:bg-gold/10"
        >
          {aiEstimating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Schätzt…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" /> Nährwerte schätzen
            </>
          )}
        </Button>
      )}
    </div>
  );
}
