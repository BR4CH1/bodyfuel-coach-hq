import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FoodResult } from "@/lib/nutrition.functions";
import { nutritionFactorForAmount, parseFoodAmount } from "../lib/nutrition-tracker.logic";
import type { FoodUnit } from "../types";
import { SourceBadge } from "./SourceBadge";

export function FoodAmountEditor({
  food,
  isCoach,
  unit,
  amountStr,
  favorite,
  onToggleFavorite,
  onAmountChange,
  onBack,
  onAdd,
}: {
  food: FoodResult;
  isCoach: boolean;
  unit: FoodUnit;
  amountStr: string;
  favorite: boolean;
  onToggleFavorite: () => void;
  onAmountChange: (value: string) => void;
  onBack: () => void;
  onAdd: () => void;
}) {
  const amount = parseFoodAmount(amountStr);
  const factor = nutritionFactorForAmount(amount);

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <div className="text-sm font-semibold">{food.name}</div>
            {isCoach && <SourceBadge source={food.source} verified={food.verified_by_coach} />}
          </div>
          <div className="text-xs text-muted-foreground">
            {food.brand ?? "—"}
            {` · Referenz: 100 ${unit}`}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleFavorite}
          className={`shrink-0 rounded-md border border-border p-2 ${
            favorite ? "text-gold" : "text-muted-foreground"
          } hover:bg-secondary`}
          aria-label={favorite ? "Favorit entfernen" : "Als Favorit speichern"}
        >
          <Star className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
        </button>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Menge ({unit})
        </label>
        <Input
          type="text"
          inputMode="decimal"
          value={amountStr}
          onChange={(event) => onAmountChange(event.target.value.replace(/[^0-9.,]/g, ""))}
          placeholder={unit === "ml" ? "z.B. 250" : "z.B. 100"}
          className="mt-1"
        />
      </div>

      <div className="rounded-lg bg-secondary/40 p-3 text-xs">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="font-bold">{Math.round(food.kcal_per_100g * factor)}</div>
            <div className="text-muted-foreground">kcal</div>
          </div>
          <div>
            <div className="font-bold">{(food.protein_per_100g * factor).toFixed(1)}</div>
            <div className="text-muted-foreground">Protein</div>
          </div>
          <div>
            <div className="font-bold">{(food.carbs_per_100g * factor).toFixed(1)}</div>
            <div className="text-muted-foreground">Carbs</div>
          </div>
          <div>
            <div className="font-bold">{(food.fat_per_100g * factor).toFixed(1)}</div>
            <div className="text-muted-foreground">Fett</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Zurück
        </Button>
        <Button onClick={onAdd} className="flex-1 bg-gradient-gold text-primary-foreground">
          Eintragen
        </Button>
      </div>
    </div>
  );
}
