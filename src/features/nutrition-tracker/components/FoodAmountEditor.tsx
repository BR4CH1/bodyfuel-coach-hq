import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FoodResult } from "@/lib/nutrition.functions";
import { piecePresetFor, piecesToGrams } from "@/lib/food-piece-sizes";
import { nutritionFactorForAmount, parseFoodAmount } from "../lib/nutrition-tracker.logic";
import type { FoodAmountMode, FoodUnit } from "../types";
import { SourceBadge } from "./SourceBadge";

export function FoodAmountEditor({
  food,
  isCoach,
  unit,
  amountStr,
  amountMode,
  favorite,
  onToggleFavorite,
  onAmountChange,
  onAmountModeChange,
  onBack,
  onAdd,
}: {
  food: FoodResult;
  isCoach: boolean;
  unit: FoodUnit;
  amountStr: string;
  amountMode: FoodAmountMode;
  favorite: boolean;
  onToggleFavorite: () => void;
  onAmountChange: (value: string) => void;
  onAmountModeChange: (mode: FoodAmountMode) => void;
  onBack: () => void;
  onAdd: () => void;
}) {
  const preset = piecePresetFor(food);
  const pieceMode = amountMode === "piece" && preset !== null;
  const amount = parseFoodAmount(amountStr);
  const grams = pieceMode && preset ? piecesToGrams(amount, preset) : amount;
  const factor = nutritionFactorForAmount(grams);
  const inputLabel = pieceMode && preset ? preset.label : unit;

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

      {preset && (
        <div className="inline-flex rounded-md border border-border bg-background/40 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onAmountModeChange("piece")}
            className={`rounded px-3 py-1.5 ${
              pieceMode ? "bg-gold text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {preset.label}
          </button>
          <button
            type="button"
            onClick={() => onAmountModeChange("unit")}
            className={`rounded px-3 py-1.5 ${
              pieceMode ? "text-muted-foreground" : "bg-gold text-primary-foreground"
            }`}
          >
            {unit}
          </button>
        </div>
      )}

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Menge ({inputLabel})
        </label>
        <Input
          type="text"
          inputMode="decimal"
          value={amountStr}
          onChange={(event) => onAmountChange(event.target.value.replace(/[^0-9.,]/g, ""))}
          placeholder={pieceMode ? "z.B. 2" : unit === "ml" ? "z.B. 250" : "z.B. 100"}
          className="mt-1"
        />
        {pieceMode && preset && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              ≈ {Math.round(grams)} {unit} (1 {preset.label} ≈ {preset.grams} {unit})
            </span>
            {[1, 2, 3].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onAmountChange(String(value))}
                className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary"
              >
                {value}×
              </button>
            ))}
          </div>
        )}
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
