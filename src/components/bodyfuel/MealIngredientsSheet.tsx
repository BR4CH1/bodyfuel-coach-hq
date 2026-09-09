import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatIngredientAmount,
  resolveIngredientAmount,
  scaleIngredientToAmount,
  sumIngredientMacros,
} from "@/lib/custom-meal-ingredients.logic";
import {
  saveCustomMeal,
  type CustomMeal,
  type CustomMealIngredient,
} from "@/lib/custom-meals.functions";

const STEP = 10;

function toInputValue(ingredient: CustomMealIngredient): string {
  const info = resolveIngredientAmount(ingredient);
  if (!info.scalable) return "";
  return String(Math.round(info.amount * 10) / 10);
}

export function MealIngredientsSheet({
  meal,
  open,
  onClose,
}: {
  meal: CustomMeal;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveCustomMeal);
  const [items, setItems] = useState<CustomMealIngredient[]>(meal.ingredients ?? []);
  const [drafts, setDrafts] = useState<string[]>(() => (meal.ingredients ?? []).map(toInputValue));

  useEffect(() => {
    if (!open) return;
    setItems(meal.ingredients ?? []);
    setDrafts((meal.ingredients ?? []).map(toInputValue));
  }, [open, meal.ingredients]);

  const totals = sumIngredientMacros(items);

  const applyAmount = (index: number, raw: string) => {
    setDrafts((prev) => prev.map((value, i) => (i === index ? raw : value)));
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setItems((prev) =>
      prev.map((ingredient, i) => (i === index ? scaleIngredientToAmount(ingredient, parsed) : ingredient)),
    );
  };

  const step = (index: number, delta: number) => {
    const info = resolveIngredientAmount(items[index]);
    if (!info.scalable) return;
    const next = Math.max(1, Math.round(info.amount + delta));
    applyAmount(index, String(next));
  };

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: meal.id,
          name: meal.name,
          meal_slot: meal.meal_slot,
          ingredients: items,
          ...(meal.notes ? { notes: meal.notes } : {}),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["custom-meals"] });
      toast.success("Mengen gespeichert");
      onClose();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen."),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="truncate font-display text-base font-bold">{meal.name}</div>
            <div className="text-xs text-muted-foreground">Zutaten &amp; Mengen anpassen</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="shrink-0 rounded-md border border-border p-2 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Für diese Mahlzeit sind keine Zutaten hinterlegt.</p>
          ) : (
            items.map((ingredient, index) => {
              const info = resolveIngredientAmount(ingredient);
              return (
                <div
                  key={`${ingredient.name}-${index}`}
                  className="rounded-xl border border-border bg-background/40 p-3"
                >
                  <div className="break-words text-sm font-semibold">{ingredient.name}</div>
                  {info.scalable ? (
                    <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2">
                      <button
                        type="button"
                        onClick={() => step(index, -STEP)}
                        aria-label={`${ingredient.name} verringern`}
                        className="h-11 w-11 shrink-0 rounded-lg border border-border text-muted-foreground"
                      >
                        <Minus className="mx-auto h-4 w-4" />
                      </button>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={drafts[index] ?? ""}
                        onChange={(event) =>
                          applyAmount(index, event.target.value.replace(/[^0-9.,]/g, ""))
                        }
                        className="h-11 min-w-0 text-center text-base"
                      />
                      <span className="shrink-0 text-sm text-muted-foreground">{info.unit}</span>
                      <button
                        type="button"
                        onClick={() => step(index, STEP)}
                        aria-label={`${ingredient.name} erhöhen`}
                        className="h-11 w-11 shrink-0 rounded-lg border border-border text-muted-foreground"
                      >
                        <Plus className="mx-auto h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-warning">
                      {formatIngredientAmount(info)} – diese Zutat lässt sich nicht automatisch
                      umrechnen und bleibt unverändert.
                    </div>
                  )}
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {Math.round(Number(ingredient.kcal) || 0)} kcal · P{" "}
                    {Math.round(Number(ingredient.protein_g) || 0)}g · KH{" "}
                    {Math.round(Number(ingredient.carbs_g) || 0)}g · F{" "}
                    {Math.round(Number(ingredient.fat_g) || 0)}g
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-3 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-4 gap-2 rounded-xl bg-background/40 p-3 text-center text-xs">
            <div>
              <div className="font-bold">{totals.kcal}</div>
              <div className="text-muted-foreground">kcal</div>
            </div>
            <div>
              <div className="font-bold">{totals.protein_g}</div>
              <div className="text-muted-foreground">Protein</div>
            </div>
            <div>
              <div className="font-bold">{totals.carbs_g}</div>
              <div className="text-muted-foreground">KH</div>
            </div>
            <div>
              <div className="font-bold">{totals.fat_g}</div>
              <div className="text-muted-foreground">Fett</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || items.length === 0}
              className="flex-1 bg-gradient-gold text-primary-foreground"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Speichern"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
