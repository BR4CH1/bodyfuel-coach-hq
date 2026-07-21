import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChefHat, Database, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FoodNutritionLine,
  FoodThumb,
} from "@/features/nutrition-tracker/components/FoodResultRow";
import { saveCustomMeal } from "@/lib/custom-meals.functions";
import { generateMealImage } from "@/lib/meal-images.functions";
import { searchFoodsDb, type FoodResult } from "@/lib/nutrition.functions";

type Ingredient = {
  food_id: string;
  food_text_id: string | null;
  name: string;
  amount_g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url: string | null;
};

type SavePhase = "idle" | "saving" | "generating";

export function MealBuilderDialog({
  userId,
  open,
  onClose,
}: {
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const searchDb = useServerFn(searchFoodsDb);
  const saveMeal = useServerFn(saveCustomMeal);
  const createImage = useServerFn(generateMealImage);

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState<FoodResult | null>(null);
  const [amount, setAmount] = useState("100");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [savePhase, setSavePhase] = useState<SavePhase>("idle");

  useEffect(() => {
    if (!open) return;
    setName("");
    setQuery("");
    setResults([]);
    setPicking(null);
    setAmount("100");
    setIngredients([]);
    setSavePhase("idle");
  }, [open]);

  useEffect(() => {
    if (!open || picking) return;
    const term = query.trim();
    if (!term) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchDb({ data: { query: term, limit: 20 } })
        .then((foods) => {
          if (!cancelled) setResults(foods);
        })
        .catch((error: unknown) => {
          if (!cancelled)
            toast.error(error instanceof Error ? error.message : "Suche fehlgeschlagen");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, picking, query, searchDb]);

  const totals = useMemo(
    () =>
      ingredients.reduce(
        (sum, ingredient) => ({
          kcal: sum.kcal + ingredient.kcal,
          protein_g: sum.protein_g + ingredient.protein_g,
          carbs_g: sum.carbs_g + ingredient.carbs_g,
          fat_g: sum.fat_g + ingredient.fat_g,
        }),
        { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      ),
    [ingredients],
  );

  if (!open) return null;

  const addIngredient = () => {
    if (!picking?.id) {
      toast.error("Bitte ein Lebensmittel aus der BodyFuel-Datenbank auswählen.");
      return;
    }
    const grams = Number(amount.replace(",", "."));
    if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) {
      toast.error("Bitte eine gültige Menge zwischen 1 und 5.000 g eingeben.");
      return;
    }
    const factor = grams / 100;
    setIngredients((current) => [
      ...current,
      {
        food_id: picking.id as string,
        food_text_id: picking.text_id ?? null,
        name: picking.name,
        amount_g: +grams.toFixed(1),
        kcal: Math.round(picking.kcal_per_100g * factor),
        protein_g: +(picking.protein_per_100g * factor).toFixed(1),
        carbs_g: +(picking.carbs_per_100g * factor).toFixed(1),
        fat_g: +(picking.fat_per_100g * factor).toFixed(1),
        image_url: picking.image_url ?? null,
      },
    ]);
    setPicking(null);
    setAmount("100");
    setQuery("");
    setResults([]);
  };

  const handleSave = async () => {
    const mealName = name.trim();
    if (!mealName) {
      toast.error("Bitte einen Namen für die Mahlzeit eingeben.");
      return;
    }
    if (!ingredients.length) {
      toast.error("Bitte mindestens eine Zutat hinzufügen.");
      return;
    }

    setSavePhase("saving");
    try {
      const meal = await saveMeal({
        data: {
          name: mealName,
          meal_slot: "any",
          ingredients,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["custom-meals", userId] });

      setSavePhase("generating");
      const imageResult = await createImage({
        data: { target: "custom_meal", meal_id: meal.id },
      });
      await queryClient.invalidateQueries({ queryKey: ["custom-meals", userId] });

      if (imageResult.status === "generated" || imageResult.status === "cached") {
        toast.success(`„${mealName}“ inklusive Foto gespeichert.`);
      } else if (imageResult.status === "fallback") {
        toast.success(`„${mealName}“ gespeichert. Vorläufig wird ein Zutatenfoto verwendet.`);
      } else {
        toast.success(`„${mealName}“ gespeichert.`);
        toast.info(imageResult.message ?? "Das Foto kann später neu erstellt werden.");
      }
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Mahlzeit konnte nicht gespeichert werden.",
      );
    } finally {
      setSavePhase("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden border-border bg-card sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-gold" />
            <div className="text-sm font-semibold">Eigene Mahlzeit erstellen</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={savePhase !== "idle"}
            className="rounded-md p-2 hover:bg-secondary disabled:opacity-50"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-border bg-background/30 px-4 py-3">
          <Input
            placeholder="Name, z. B. Hähnchen-Reis-Bowl"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            className="mb-2"
          />
          <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
            <MacroValue value={Math.round(totals.kcal)} label="kcal" />
            <MacroValue value={totals.protein_g.toFixed(1)} label="Protein" />
            <MacroValue value={totals.carbs_g.toFixed(1)} label="Carbs" />
            <MacroValue value={totals.fat_g.toFixed(1)} label="Fett" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {ingredients.length > 0 && (
            <section className="mb-4">
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Zutaten ({ingredients.length})
              </div>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background/30">
                {ingredients.map((ingredient, index) => (
                  <li
                    key={`${ingredient.food_id}-${index}`}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <FoodThumb food={ingredient} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{ingredient.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {Math.round(ingredient.amount_g)} g · {ingredient.kcal} kcal · P{" "}
                        {ingredient.protein_g.toFixed(1)} · KH {ingredient.carbs_g.toFixed(1)} · F{" "}
                        {ingredient.fat_g.toFixed(1)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setIngredients((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="rounded-md p-1.5 text-muted-foreground hover:text-warning"
                      aria-label={`${ingredient.name} entfernen`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!picking ? (
            <section>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Database className="h-3.5 w-3.5 text-gold" /> Nur geprüfte BodyFuel-Lebensmittel
              </div>
              <Input
                autoFocus
                placeholder="Lebensmittel suchen …"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />

              <div className="mt-2">
                {searching ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Suche …
                  </div>
                ) : query.trim() && !results.length ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Kein geprüftes Lebensmittel gefunden.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {results.map((food) => (
                      <li key={food.id ?? food.text_id ?? food.name}>
                        <button
                          type="button"
                          onClick={() => {
                            setPicking(food);
                            setAmount("100");
                          }}
                          className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-secondary"
                        >
                          <FoodThumb food={food} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{food.name}</div>
                            <FoodNutritionLine food={food} />
                          </div>
                          <Plus className="h-4 w-4 shrink-0 text-gold" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-border bg-background/30 p-3">
              <div className="flex items-start gap-3">
                <FoodThumb food={picking} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{picking.name}</div>
                  <FoodNutritionLine food={picking} />
                </div>
              </div>
              <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Menge in Gramm
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ""))}
                className="mt-1"
              />
              <div className="mt-3 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setPicking(null)}>
                  Zurück
                </Button>
                <Button
                  className="flex-1 bg-gradient-gold text-primary-foreground"
                  onClick={addIngredient}
                >
                  <Plus className="h-4 w-4" /> Übernehmen
                </Button>
              </div>
            </section>
          )}
        </div>

        <div className="shrink-0 border-t border-border p-4">
          {savePhase === "generating" && (
            <div className="mb-2 flex items-center justify-center gap-2 text-xs text-gold">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Gerichtsfoto wird erstellt …
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={savePhase !== "idle" || !name.trim() || !ingredients.length}
            className="w-full bg-gradient-gold text-primary-foreground"
          >
            {savePhase !== "idle" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChefHat className="h-4 w-4" />
            )}
            {savePhase === "saving"
              ? "Mahlzeit wird gespeichert …"
              : savePhase === "generating"
                ? "Foto wird generiert …"
                : "Mahlzeit speichern & Foto generieren"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MacroValue({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-md bg-secondary/40 py-1.5">
      <div className="font-bold">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
