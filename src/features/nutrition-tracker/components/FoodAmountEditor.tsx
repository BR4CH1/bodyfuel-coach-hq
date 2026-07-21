import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FoodResult } from "@/lib/nutrition.functions";
import { amountInGrams, parseFoodAmount } from "../lib/nutrition-tracker.logic";
import type { FoodUnit } from "../types";
import { FoodThumb } from "./FoodResultRow";
import { SourceBadge } from "./SourceBadge";

export function FoodAmountEditor({
  food,
  isCoach,
  unit,
  amountStr,
  favorite,
  onToggleFavorite,
  onUnitChange,
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
  onUnitChange: (unit: FoodUnit) => void;
  onAmountChange: (value: string) => void;
  onBack: () => void;
  onAdd: () => void;
}) {
  const amount = parseFoodAmount(amountStr);
  const grams = amountInGrams(food, unit, amount);
  const factor = grams / 100;

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      <div className="flex items-start gap-3">
        <FoodThumb food={food} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <div className="text-sm font-semibold">{food.name}</div>
            {isCoach && <SourceBadge source={food.source} verified={food.verified_by_coach} />}
          </div>
          <div className="text-xs text-muted-foreground">
            {food.brand ?? "—"}
            {food.serving_g ? ` · 1 Stück ≈ ${food.serving_g} g` : ""}
          </div>
          {isCoach && food.source === "ai_estimate" && (
            <div className="mt-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-300">
              ⚠ KI-Schätzung – Werte vor dem Speichern prüfen. Nicht aus geprüfter Datenbank.
            </div>
          )}
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

      {food.serving_g && (
        <div className="inline-flex rounded-md border border-border bg-background/40 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => {
              const nextAmount = Math.round(amount * (food.serving_g ?? 1));
              onUnitChange("g");
              onAmountChange(String(nextAmount));
            }}
            className={`rounded px-3 py-1 ${
              unit === "g" ? "bg-gold text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Gramm
          </button>
          <button
            type="button"
            onClick={() => {
              const serving = food.serving_g ?? 1;
              const pieces = amount / serving;
              onUnitChange("piece");
              onAmountChange(pieces.toFixed(pieces < 1 ? 2 : 1).replace(/\.?0+$/, ""));
            }}
            className={`rounded px-3 py-1 ${
              unit === "piece" ? "bg-gold text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Stück
          </button>
        </div>
      )}

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Menge ({unit === "piece" ? "Stück" : "g"})
        </label>
        <Input
          type="text"
          inputMode="decimal"
          value={amountStr}
          onChange={(event) => onAmountChange(event.target.value.replace(/[^0-9.,]/g, ""))}
          placeholder={unit === "piece" ? "z.B. 1" : "z.B. 50"}
          className="mt-1"
        />
        {unit === "piece" && food.serving_g && (
          <div className="mt-1 text-[11px] text-muted-foreground">= {Math.round(grams)} g</div>
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
