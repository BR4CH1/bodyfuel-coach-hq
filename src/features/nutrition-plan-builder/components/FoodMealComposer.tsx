import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Apple, LoaderCircle, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BuilderMeal, CustomerPlanContext } from "@/lib/plan-builder.functions";
import { searchFoodsDb, type FoodResult } from "@/lib/nutrition.functions";
import { generateRecipeFromIngredients } from "@/lib/recipe-from-ingredients.functions";
import { piecePresetFor, piecesToGrams } from "@/lib/food-piece-sizes";
import { isFoodQueryValid, mealFromFood, type Slot } from "../lib/plan-builder.logic";

type AmountMode = "base" | "piece";

type ComposerItem = {
  key: string;
  food: FoodResult;
  amountText: string;
  amountMode: AmountMode;
  /** Nur nötig, wenn die Datenbank/Heuristik keine Stückgröße kennt. */
  manualPieceWeightText: string;
};

type ResolvedItem = {
  item: ComposerItem;
  amountForNutrition: number;
  unitForNutrition: "g" | "ml";
  displayAmount: string;
  gramsPerPiece: number | null;
};

const SLOT_LABEL: Record<Slot, string> = {
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
  snack: "Snack",
};

function positiveNumber(value: string): number {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function nextKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `food_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function resolveItem(item: ComposerItem): ResolvedItem | null {
  const amount = positiveNumber(item.amountText);
  if (!amount) return null;

  if (item.amountMode === "piece") {
    const preset = piecePresetFor(item.food);
    const manualWeight = positiveNumber(item.manualPieceWeightText);
    const gramsPerPiece = preset?.grams ?? manualWeight;
    if (!gramsPerPiece) return null;
    const grams = piecesToGrams(amount, { grams: gramsPerPiece, label: preset?.label ?? "Stück" });
    return {
      item,
      amountForNutrition: grams,
      unitForNutrition: "g",
      displayAmount: `${amount} ${preset?.label ?? "Stück"}`,
      gramsPerPiece,
    };
  }

  const unit = item.food.unit === "ml" ? "ml" : "g";
  return {
    item,
    amountForNutrition: amount,
    unitForNutrition: unit,
    displayAmount: `${amount} ${unit}`,
    gramsPerPiece: null,
  };
}

function builderMealFromResolved(items: ResolvedItem[], slot: Slot): BuilderMeal {
  const parts = items.map(({ item, amountForNutrition, unitForNutrition }) =>
    mealFromFood(
      {
        name: item.food.name,
        brand: item.food.brand,
        unit: unitForNutrition,
        density_g_per_ml: item.food.density_g_per_ml,
        kcal_per_100g: item.food.kcal_per_100g,
        protein_per_100g: item.food.protein_per_100g,
        carbs_per_100g: item.food.carbs_per_100g,
        fat_per_100g: item.food.fat_per_100g,
      },
      amountForNutrition,
      slot,
    ),
  );

  const total = (field: "kcal" | "protein_g" | "carbs_g" | "fat_g") =>
    Math.round(parts.reduce((sum, part) => sum + Number(part[field] ?? 0), 0) * 10) / 10;

  const names = items.map((entry) => entry.item.food.name).filter(Boolean);
  const fallbackName = names.length <= 2 ? names.join(" & ") : `${names[0]}, ${names[1]} & mehr`;

  return {
    slot,
    name: fallbackName || "Mahlzeit aus Lebensmitteln",
    description: null,
    ingredients: parts.flatMap((part) => part.ingredients.map((ingredient) => ({ ...ingredient }))),
    kcal: total("kcal"),
    protein_g: total("protein_g"),
    carbs_g: total("carbs_g"),
    fat_g: total("fat_g"),
    library_meal_id: null,
    portion_factor: 1,
    // Coach hat die Zutatenmengen bewusst festgelegt. Automatisches
    // Rebalancing darf diese Mengen daher nicht still verändern.
    is_locked: true,
  };
}

export function FoodMealComposer({
  slot,
  ctx,
  remaining,
  onAdd,
}: {
  slot: Slot;
  ctx: CustomerPlanContext;
  remaining: { kcal: number; p: number; c: number; f: number };
  onAdd: (meal: BuilderMeal) => void;
}) {
  const runSearch = useServerFn(searchFoodsDb);
  const generateRecipe = useServerFn(generateRecipeFromIngredients);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [items, setItems] = useState<ComposerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFoodQueryValid(query)) {
      setResults([]);
      setLoading(false);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const found = await runSearch({ data: { query: query.trim(), limit: 25 } });
        if (!cancelled) {
          setResults(Array.isArray(found) ? found : []);
          setSearchError(null);
        }
      } catch {
        if (!cancelled) setSearchError("Suche fehlgeschlagen. Bitte erneut versuchen.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, runSearch]);

  const resolvedItems = useMemo(
    () => items.map(resolveItem).filter((entry): entry is ResolvedItem => Boolean(entry)),
    [items],
  );
  const allAmountsValid = items.length > 0 && resolvedItems.length === items.length;
  const preview = useMemo(
    () => (resolvedItems.length ? builderMealFromResolved(resolvedItems, slot) : null),
    [resolvedItems, slot],
  );

  const addFood = (food: FoodResult) => {
    const preset = piecePresetFor(food);
    setItems((current) => [
      ...current,
      {
        key: nextKey(),
        food,
        amountText: preset ? "1" : "100",
        amountMode: food.unit === "ml" ? "base" : preset ? "piece" : "base",
        manualPieceWeightText: "",
      },
    ]);
    setQuery("");
    setResults([]);
    setGenerateError(null);
  };

  const updateItem = (key: string, patch: Partial<ComposerItem>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const removeItem = (key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
    setGenerateError(null);
  };

  const fallbackAdd = () => {
    if (!preview || !allAmountsValid) return;
    onAdd({ ...preview, description: "Aus fest vorgegebenen Lebensmitteln und Mengen erstellt." });
  };

  const handleGenerate = async () => {
    if (!preview || !allAmountsValid) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const ingredientText = resolvedItems
        .map((entry) => {
          const approx =
            entry.item.amountMode === "piece" && entry.gramsPerPiece
              ? ` (≈ ${Math.round(entry.amountForNutrition)} g gesamt)`
              : "";
          return `${entry.displayAmount} ${entry.item.food.name}${entry.item.food.brand ? ` (${entry.item.food.brand})` : ""}${approx}`;
        })
        .join(", ");

      const result = await generateRecipe({
        data: {
          ingredients: ingredientText,
          fixedQuantities: true,
          goal: `${SLOT_LABEL[slot]}. Die vom Coach vorgegebenen Lebensmittel und Mengen sind verbindlich. Offenes Slot-Ziel ungefähr ${Math.max(0, Math.round(remaining.kcal))} kcal, ${Math.max(0, Math.round(remaining.p))} g Protein, ${Math.max(0, Math.round(remaining.c))} g Kohlenhydrate, ${Math.max(0, Math.round(remaining.f))} g Fett.`,
          recipeContext: {
            allergies: [...ctx.allergies, ...ctx.intolerances],
            noGos: ctx.noGoFoods,
            mealPrepStyle: ctx.mealPrepStyle,
            targets: {
              kcal: Math.max(0, Math.round(remaining.kcal)),
              protein_g: Math.max(0, Math.round(remaining.p)),
              carbs_g: Math.max(0, Math.round(remaining.c)),
              fat_g: Math.max(0, Math.round(remaining.f)),
            },
          },
        },
      });

      const generatedName = String((result as any)?.name ?? "").trim().slice(0, 180);
      const generatedDescription = String((result as any)?.description ?? "").trim();
      const steps = Array.isArray((result as any)?.steps)
        ? (result as any).steps.map((step: unknown) => String(step).trim()).filter(Boolean)
        : [];
      const preparation = steps.length ? `Zubereitung: ${steps.join(" · ")}` : "";
      const description = [generatedDescription, preparation].filter(Boolean).join("\n").slice(0, 500);

      onAdd({
        ...preview,
        name: generatedName || preview.name,
        description: description || "Aus fest vorgegebenen Lebensmitteln und Mengen erstellt.",
      });
    } catch (error) {
      setGenerateError(
        error instanceof Error
          ? error.message
          : "Gericht konnte gerade nicht erzeugt werden. Du kannst die Zutaten trotzdem übernehmen.",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <div className="space-y-4">
        <div>
          <div className="text-sm font-semibold">Lebensmittel vorgeben</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Lebensmittel und Mengen festlegen. BODYFUEL erzeugt daraus ein Gericht; die Mengen bleiben unverändert.
          </p>
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => {
              const preset = piecePresetFor(item.food);
              const resolved = resolveItem(item);
              const needsManualPieceWeight = item.amountMode === "piece" && !preset;
              return (
                <div key={item.key} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{item.food.name}</div>
                      {item.food.brand && (
                        <div className="truncate text-[11px] text-muted-foreground">{item.food.brand}</div>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-muted-foreground"
                      onClick={() => removeItem(item.key)}
                      aria-label={`${item.food.name} entfernen`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      inputMode="decimal"
                      value={item.amountText}
                      onChange={(event) => updateItem(item.key, { amountText: event.target.value })}
                      aria-label={`Menge ${item.food.name}`}
                    />
                    <select
                      value={item.amountMode}
                      onChange={(event) =>
                        updateItem(item.key, { amountMode: event.target.value as AmountMode })
                      }
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="base">{item.food.unit === "ml" ? "ml" : "g"}</option>
                      {item.food.unit !== "ml" && (
                        <option value="piece">{preset?.label ?? "Stück"}</option>
                      )}
                    </select>
                  </div>

                  {needsManualPieceWeight && (
                    <div className="mt-2">
                      <label className="mb-1 block text-[11px] text-muted-foreground">
                        Gewicht pro Stück in g
                      </label>
                      <Input
                        inputMode="decimal"
                        value={item.manualPieceWeightText}
                        onChange={(event) =>
                          updateItem(item.key, { manualPieceWeightText: event.target.value })
                        }
                        placeholder="z. B. 120"
                      />
                    </div>
                  )}

                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {resolved ? (
                      <>
                        {resolved.displayAmount}
                        {item.amountMode === "piece" ? ` · ≈ ${Math.round(resolved.amountForNutrition)} g` : ""}
                      </>
                    ) : (
                      <span className="text-amber-500">Bitte gültige Menge angeben.</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Weiteres Lebensmittel suchen …"
              className="pl-9"
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-5 text-xs text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Suche läuft …
            </div>
          )}
          {!loading && searchError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{searchError}</div>
          )}
          {!loading && !searchError && isFoodQueryValid(query) && results.length === 0 && (
            <div className="py-4 text-center text-xs text-muted-foreground">Kein Lebensmittel gefunden.</div>
          )}
          {!loading && !searchError && !isFoodQueryValid(query) && items.length === 0 && (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Suche das erste Lebensmittel mit mindestens 2 Zeichen.
            </div>
          )}

          {!loading &&
            !searchError &&
            results.map((food, index) => {
              const preset = piecePresetFor(food);
              return (
                <button
                  key={`${food.id ?? food.name}-${index}`}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-2.5 text-left hover:border-emerald-500/50 hover:bg-emerald-500/5"
                  onClick={() => addFood(food)}
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                    {food.image_url ? (
                      <img src={food.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <Apple className="h-4 w-4 text-emerald-500/70" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{food.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {Math.round(food.kcal_per_100g)} kcal / 100 {food.unit === "ml" ? "ml" : "g"}
                      {preset ? ` · ${preset.label} ≈ ${preset.grams} g` : ""}
                    </div>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
        </div>

        {preview && (
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="text-xs font-semibold">Gericht gesamt</div>
            <div className="mt-1 text-sm">
              {Math.round(preview.kcal ?? 0)} kcal · {Math.round(preview.protein_g ?? 0)} P ·{" "}
              {Math.round(preview.carbs_g ?? 0)} KH · {Math.round(preview.fat_g ?? 0)} F
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Nährwerte werden aus der Lebensmitteldatenbank berechnet, nicht von der KI.
            </div>
          </div>
        )}

        {generateError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {generateError}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pb-1">
          {generateError && (
            <Button type="button" variant="outline" disabled={!allAmountsValid} onClick={fallbackAdd}>
              Zutaten ohne KI übernehmen
            </Button>
          )}
          <Button
            type="button"
            disabled={!allAmountsValid || generating}
            onClick={handleGenerate}
          >
            {generating ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {generating ? "Gericht wird erzeugt …" : "Gericht erzeugen"}
          </Button>
        </div>
      </div>
    </div>
  );
}
