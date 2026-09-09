import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  resolveIngredientAmount,
  scaleIngredientToAmount,
  sumIngredientMacros,
} from "@/lib/custom-meal-ingredients.logic";
import type { CustomMeal, CustomMealIngredient } from "@/lib/custom-meals.functions";
import { piecePresetFor } from "@/lib/food-piece-sizes";
import {
  PORTION_PRESETS,
  formatPortionFactor,
  parsePortionFactor,
  prepareCustomMealForFinalIngredients,
  scaleCustomMeal,
} from "../lib/custom-meal-portion.logic";

type IngredientMode = "unit" | "piece";

function ingredientHasCompleteMacros(ingredient: CustomMealIngredient): boolean {
  return (
    ingredient.kcal != null &&
    ingredient.protein_g != null &&
    ingredient.carbs_g != null &&
    ingredient.fat_g != null
  );
}

function decimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded).replace(".", ",");
}

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
  const scaled = useMemo(() => scaleCustomMeal(meal, factor || 1), [factor, meal]);
  const [ingredients, setIngredients] = useState<CustomMealIngredient[]>(scaled.ingredients);
  const [modes, setModes] = useState<Record<number, IngredientMode>>({});

  useEffect(() => {
    setIngredients(scaled.ingredients.map((ingredient) => ({ ...ingredient })));
    setModes({});
  }, [meal.id, factor]);

  const macrosComplete = ingredients.every(ingredientHasCompleteMacros);
  const editedTotals = sumIngredientMacros(ingredients);
  const preview = factor > 0
    ? macrosComplete
      ? {
          kcal: editedTotals.kcal,
          protein_g: editedTotals.protein_g,
          carbs_g: editedTotals.carbs_g,
          fat_g: editedTotals.fat_g,
        }
      : scaled
    : { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  const allMassIngredients = ingredients.every((ingredient) => {
    const info = resolveIngredientAmount(ingredient);
    return info.scalable && info.unit === "g";
  });
  const totalMass = allMassIngredients
    ? ingredients.reduce((sum, ingredient) => sum + resolveIngredientAmount(ingredient).amount, 0)
    : 0;

  const setIngredientAmount = (
    index: number,
    displayAmount: number,
    mode: IngredientMode,
    pieceGrams?: number,
  ) => {
    if (!Number.isFinite(displayAmount) || displayAmount <= 0) return;
    const nextAmount = mode === "piece" && pieceGrams ? displayAmount * pieceGrams : displayAmount;
    setIngredients((current) =>
      current.map((ingredient, currentIndex) =>
        currentIndex === index ? scaleIngredientToAmount(ingredient, nextAmount) : ingredient,
      ),
    );
  };

  const submit = () => {
    if (factor <= 0) return;
    const prepared = prepareCustomMealForFinalIngredients(meal, ingredients, factor);
    // AddFoodDialog always gives the tracker an isolated clone of the saved meal.
    // Updating that clone lets the existing add flow persist exactly this draft
    // without mutating the saved recipe/favorite itself.
    Object.assign(meal, prepared);
    onAdd();
  };

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div>
        <div className="break-words text-sm font-semibold text-foreground">{meal.name}</div>
        <div className="text-xs text-muted-foreground">
          {meal.ingredients?.length ? `${meal.ingredients.length} Zutaten · ` : ""}
          jede Menge einzeln anpassbar
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Gesamtportion</label>
        <Input
          type="text"
          inputMode="decimal"
          value={portionStr}
          onChange={(event) => onPortionChange(event.target.value.replace(/[^0-9.,]/g, ""))}
          placeholder="z.B. 1"
          className="mt-1 h-11 text-foreground"
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
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Ändert die Ausgangsportion. Danach kannst du jede Zutat darunter individuell korrigieren.
        </p>
      </div>

      {ingredients.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Zutaten &amp; Mengen
          </div>
          {ingredients.map((ingredient, index) => {
            const info = resolveIngredientAmount(ingredient);
            const editable = info.scalable && ingredientHasCompleteMacros(ingredient);
            const piecePreset =
              info.unit === "g"
                ? piecePresetFor({ name: ingredient.name, unit: "g", serving_g: null })
                : null;
            const mode = piecePreset ? (modes[index] ?? "unit") : "unit";
            const displayAmount =
              mode === "piece" && piecePreset ? info.amount / piecePreset.grams : info.amount;
            const step = mode === "piece" ? 1 : info.amount <= 20 ? 1 : 10;

            return (
              <div key={`${ingredient.name}-${index}`} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">
                    {ingredient.name}
                  </div>
                  {piecePreset ? (
                    <div className="inline-flex shrink-0 rounded-md border border-border p-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setModes((current) => ({ ...current, [index]: "unit" }))}
                        className={`rounded px-2 py-1 ${
                          mode === "unit" ? "bg-secondary text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        g
                      </button>
                      <button
                        type="button"
                        onClick={() => setModes((current) => ({ ...current, [index]: "piece" }))}
                        className={`rounded px-2 py-1 ${
                          mode === "piece" ? "bg-secondary text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {piecePreset.label}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-11 w-11 shrink-0"
                    disabled={!editable}
                    onClick={() =>
                      setIngredientAmount(
                        index,
                        Math.max(step, displayAmount - step),
                        mode,
                        piecePreset?.grams,
                      )
                    }
                    aria-label={`${ingredient.name} Menge reduzieren`}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={info.scalable ? decimal(displayAmount) : ""}
                    disabled={!editable}
                    onChange={(event) => {
                      const parsed = Number(event.target.value.replace(",", "."));
                      if (Number.isFinite(parsed) && parsed > 0) {
                        setIngredientAmount(index, parsed, mode, piecePreset?.grams);
                      }
                    }}
                    className="h-11 min-w-0 flex-1 text-center text-base font-semibold"
                    aria-label={`${ingredient.name} Menge`}
                  />
                  <div className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">
                    {mode === "piece" && piecePreset ? piecePreset.label : info.unit}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-11 w-11 shrink-0"
                    disabled={!editable}
                    onClick={() =>
                      setIngredientAmount(index, displayAmount + step, mode, piecePreset?.grams)
                    }
                    aria-label={`${ingredient.name} Menge erhöhen`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {mode === "piece" && piecePreset ? (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    ≈ {Math.round(info.amount)} g · 1 {piecePreset.label} ≈ {piecePreset.grams} g
                  </div>
                ) : null}
                {!editable ? (
                  <div className="mt-1 text-[10px] text-amber-500">
                    Für diese Zutat fehlen belastbare Mengen- oder Nährwertdaten; deshalb wird sie nicht falsch skaliert.
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="rounded-lg bg-secondary/40 p-3 text-xs">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="font-bold text-foreground">{Math.round(preview.kcal)}</div>
            <div className="text-muted-foreground">kcal</div>
          </div>
          <div>
            <div className="font-bold text-foreground">{Number(preview.protein_g).toFixed(1)}</div>
            <div className="text-muted-foreground">Protein</div>
          </div>
          <div>
            <div className="font-bold text-foreground">{Number(preview.carbs_g).toFixed(1)}</div>
            <div className="text-muted-foreground">Carbs</div>
          </div>
          <div>
            <div className="font-bold text-foreground">{Number(preview.fat_g).toFixed(1)}</div>
            <div className="text-muted-foreground">Fett</div>
          </div>
        </div>
        {totalMass > 0 ? (
          <div className="mt-2 text-center text-[11px] text-muted-foreground">
            Gesamtmenge ca. {Math.round(totalMass)} g
          </div>
        ) : null}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Die Änderungen gelten nur für diesen Eintrag. Dein gespeicherter Favorit bzw. deine Mahlzeit bleibt unverändert.
      </p>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="h-11 flex-1">
          Zurück
        </Button>
        <Button
          onClick={submit}
          disabled={saving || factor <= 0}
          className="h-11 flex-1 bg-gradient-gold text-primary-foreground"
        >
          Eintragen
        </Button>
      </div>
    </div>
  );
}
