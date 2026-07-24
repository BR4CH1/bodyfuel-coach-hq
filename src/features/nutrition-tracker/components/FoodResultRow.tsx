import { Apple, BadgeCheck, Star } from "lucide-react";
import { useState } from "react";

import type { FoodResult } from "@/lib/nutrition.functions";

type FoodVisual = FoodResult & {
  image_url?: string | null;
};

type NutritionFood = Pick<
  FoodResult,
  "kcal_per_100g" | "protein_per_100g" | "carbs_per_100g" | "fat_per_100g" | "unit"
>;

export function FoodThumb({
  food,
}: {
  food: {
    name: string;
    image_url?: string | null;
  };
}) {
  const [failed, setFailed] = useState(false);
  const url = food.image_url?.trim();

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary">
      {url && !failed ? (
        <img
          src={url}
          alt={food.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Apple className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}

export function FoodNutritionLine({ food }: { food: NutritionFood }) {
  return (
    <div className="mt-0.5 truncate text-xs text-muted-foreground">
      {Math.round(Number(food.kcal_per_100g) || 0)} kcal
      {" · "}P {Number(food.protein_per_100g).toFixed(1)} g{" · "}KH{" "}
      {Number(food.carbs_per_100g).toFixed(1)} g{" · "}F {Number(food.fat_per_100g).toFixed(1)} g
      {` / 100 ${food.unit}`}
    </div>
  );
}

export function FavoriteButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-gold"
      aria-label={active ? "Aus Favoriten entfernen" : "Als Favorit speichern"}
    >
      <Star className={`h-4 w-4 ${active ? "fill-current text-gold" : ""}`} />
    </button>
  );
}

export function FoodResultRow({
  food,
  isCoach,
  favorite,
  showServing,
  onPick,
  onToggleFavorite,
}: {
  food: FoodResult;
  isCoach: boolean;
  favorite: boolean;
  showServing?: boolean;
  onPick: () => void;
  onToggleFavorite: () => void;
}) {
  const visual = food as FoodVisual;

  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left hover:bg-secondary"
      >
        <FoodThumb food={visual} />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium">{food.name}</span>

            {food.verified_by_coach && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-gold" />}
          </div>

          {food.brand && (
            <div className="truncate text-[11px] text-muted-foreground">{food.brand}</div>
          )}

          <FoodNutritionLine food={food} />

          {showServing && food.serving_label && (
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {food.serving_label}
            </div>
          )}

          {isCoach && food.source && (
            <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {food.source}
            </div>
          )}
        </div>
      </button>

      <FavoriteButton active={favorite} onClick={onToggleFavorite} />
    </li>
  );
}
