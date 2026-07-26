import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomMeal } from "@/lib/custom-meals.functions";
import {
  PORTION_PRESETS,
  formatPortionFactor,
  parsePortionFactor,
  scaleCustomMeal,
} from "../lib/custom-meal-portion.logic";

export function CustomMealPortionEditor({
  meal,
  portionStr,
  saving,
  onPortionChange,
  onBack,
  onAdd,
}: {
  meal: CustomMeal;
  portionStr: string;
  saving: boolean;
  onPortionChange: (value: string) => void;
  onBack: () => void;
  onAdd: () => void;
}) {
  const factor = parsePortionFactor(portionStr);
  const scaled = scaleCustomMeal(meal, factor || 0);
  const preview = factor > 0 ? scaled : { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, serving_g: 0 };

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div>
        <div className="text-sm font-semibold text-foreground">{meal.name}</div>
        <div className="text-xs text-muted-foreground">
          {meal.ingredients?.length ? `${meal.ingredients.length} Zutaten · ` : ""}
          Basis: 1,0 Portion
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Portionen</label>
        <Input
          type="text"
          inputMode="decimal"
          value={portionStr}
          onChange={(event) => onPortionChange(event.target.value.replace(/[^0-9.,]/g, ""))}
          placeholder="z.B. 1"
          className="mt-1 text-foreground"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {PORTION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onPortionChange(formatPortionFactor(preset))}
              className={`rounded-md border border-border px-3 py-1.5 text-xs ${
                Math.abs(factor - preset) < 0.001
                  ? "bg-gold text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {formatPortionFactor(preset)}×
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-secondary/40 p-3 text-xs">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="font-bold text-foreground">{preview.kcal}</div>
            <div className="text-muted-foreground">kcal</div>
          </div>
          <div>
            <div className="font-bold text-foreground">{preview.protein_g.toFixed(1)}</div>
            <div className="text-muted-foreground">Protein</div>
          </div>
          <div>
            <div className="font-bold text-foreground">{preview.carbs_g.toFixed(1)}</div>
            <div className="text-muted-foreground">Carbs</div>
          </div>
          <div>
            <div className="font-bold text-foreground">{preview.fat_g.toFixed(1)}</div>
            <div className="text-muted-foreground">Fett</div>
          </div>
        </div>
        {preview.serving_g > 0 && (
          <div className="mt-2 text-center text-[11px] text-muted-foreground">
            Gesamtmenge ca. {preview.serving_g} g
          </div>
        )}
      </div>

      {meal.ingredients?.length ? (
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          {scaled.ingredients.map((ingredient, index) => (
            <li key={`${ingredient.name}-${index}`} className="flex justify-between gap-2">
              <span className="truncate">{ingredient.name}</span>
              <span>
                {ingredient.amount ?? ingredient.amount_g ?? "—"} {ingredient.unit ?? "g"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Zurück
        </Button>
        <Button
          onClick={onAdd}
          disabled={saving || factor <= 0}
          className="flex-1 bg-gradient-gold text-primary-foreground"
        >
          Eintragen
        </Button>
      </div>
    </div>
  );
}
