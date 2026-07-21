import { ImageOff, Star } from "lucide-react";

import type { FoodResult } from "@/lib/nutrition.functions";
import { SourceBadge } from "./SourceBadge";

export function FoodThumbnail({
  src,
  alt,
  size = "md",
}: {
  src?: string | null;
  alt: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`${dim} shrink-0 rounded-md object-cover bg-secondary`}
        onError={(event) => {
          (event.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      className={`${dim} shrink-0 flex items-center justify-center rounded-md bg-secondary text-muted-foreground`}
      aria-hidden
    >
      <ImageOff className="h-4 w-4" />
    </div>
  );
}

/** Compatibility wrapper used by recent/favorite food lists. */
export function FoodThumb({
  food,
}: {
  food: {
    name: string;
    image_url?: string | null;
  };
}) {
  return <FoodThumbnail src={food.image_url} alt={food.name} />;
}

export function FoodNutritionLine({
  food,
  showServing = false,
}: {
  food: FoodResult;
  showServing?: boolean;
}) {
  return (
    <div className="text-[11px] text-muted-foreground">
      {food.brand ? `${food.brand} · ` : ""}
      {Math.round(food.kcal_per_100g)} kcal · P {food.protein_per_100g.toFixed(1)} · K{" "}
      {food.carbs_per_100g.toFixed(1)} · F {food.fat_per_100g.toFixed(1)} (/100g)
      {showServing && food.serving_g ? ` · 1 Stück ≈ ${food.serving_g} g` : ""}
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
      className={`shrink-0 p-3 hover:bg-secondary ${
        active ? "text-gold" : "text-muted-foreground"
      }`}
      aria-label={active ? "Favorit entfernen" : "Als Favorit speichern"}
    >
      <Star className={`h-4 w-4 ${active ? "fill-current" : ""}`} />
    </button>
  );
}

export function FoodResultRow({
  food,
  isCoach,
  favorite,
  showServing = false,
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
  return (
    <li className="flex items-center">
      <button
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left hover:bg-secondary"
      >
        <FoodThumbnail src={food.image_url} alt={food.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <div className="truncate text-sm font-medium">{food.name}</div>
            {isCoach && <SourceBadge source={food.source} verified={food.verified_by_coach} />}
          </div>
          <FoodNutritionLine food={food} showServing={showServing} />
        </div>
      </button>
      <FavoriteButton active={favorite} onClick={onToggleFavorite} />
    </li>
  );
}
