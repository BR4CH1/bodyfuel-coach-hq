import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Apple, LoaderCircle, Search, Sparkles, Utensils } from "lucide-react";
import type { BuilderMeal, CustomerPlanContext, LibraryMeal } from "@/lib/plan-builder.functions";
import { searchFoodsDb, type FoodResult } from "@/lib/nutrition.functions";
import { cn } from "@/lib/utils";
import {
  isFoodQueryValid,
  matchesMealQuery,
  mealFromFood,
  mealFitsDiet,

  scoreMeal,
  type Slot,
} from "../lib/plan-builder.logic";

interface MealPickerDialogProps {
  trigger: ReactNode;
  title: string;
  slot: Slot;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  dayType: "training" | "rest";
  remaining: { kcal: number; p: number; c: number; f: number };
  onPick: (meal: LibraryMeal) => void;
  /** Optional: übernimmt ein einzelnes Lebensmittel als einfache Mahlzeit. */
  onPickFood?: (meal: BuilderMeal) => void;
  excludeId?: string | null;
}

type PickerMode = "recommended" | "all";
type PickerTab = "meals" | "foods";

export function MealPickerDialog({
  trigger,
  title,
  slot,
  library,
  ctx,
  dayType,
  remaining,
  onPick,
  onPickFood,
  excludeId,
}: MealPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<PickerMode>("recommended");
  const [tab, setTab] = useState<PickerTab>("meals");

  const scored = useMemo(
    () =>
      library
        .filter(
          (meal) =>
            meal.category === slot &&
            (!excludeId || meal.id !== excludeId) &&
            mealFitsDiet(meal, ctx.dietStyle),
        )
        .map((meal) => {
          const result = scoreMeal(meal, ctx, dayType, remaining);
          return { meal, ...result };
        })
        .filter(
          ({ reasons }) =>
            !reasons.some((reason) =>
              /^(Allergie\/Intoleranz|No-Go|Passt nicht zur Ernährungsform)/.test(reason),
            ),
        )
        .sort((a, b) => b.score - a.score),
    [library, ctx, slot, dayType, remaining, excludeId],
  );


  const visibleMeals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return scored.filter(({ meal, score }) => {
      if (mode === "recommended" && score < 30) return false;
      if (!normalizedQuery) return true;
      return matchesMealQuery(meal, normalizedQuery);
    });
  }, [mode, query, scored]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle>{title}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Vorschläge werden nach Tagesziel, Vorlieben und Einschränkungen sortiert.
          </p>
        </DialogHeader>

        {onPickFood && (
          <div className="flex gap-1 border-b border-border bg-background px-5 py-2">
            <Button
              type="button"
              size="sm"
              variant={tab === "meals" ? "secondary" : "ghost"}
              className="h-8 flex-1 text-xs"
              onClick={() => setTab("meals")}
            >
              <Utensils className="mr-1 h-3.5 w-3.5" />
              Gerichte
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "foods" ? "secondary" : "ghost"}
              className="h-8 flex-1 text-xs"
              onClick={() => setTab("foods")}
            >
              <Apple className="mr-1 h-3.5 w-3.5" />
              Lebensmittel
            </Button>
          </div>
        )}

        {onPickFood && tab === "foods" ? (
          <FoodSearchTab
            slot={slot}
            onAdd={(builderMeal) => {
              onPickFood(builderMeal);
              setOpen(false);
            }}
          />
        ) : (
        <>
        <div className="space-y-3 border-b border-border bg-muted/20 px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nach Gericht, Zutat oder Tag suchen …"
              className="pl-9"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <Button
                type="button"
                size="sm"
                variant={mode === "recommended" ? "secondary" : "ghost"}
                className="h-7 text-xs"
                onClick={() => setMode("recommended")}
              >
                <Sparkles className="mr-1 h-3 w-3" />
                Empfohlen
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "all" ? "secondary" : "ghost"}
                className="h-7 text-xs"
                onClick={() => setMode("all")}
              >
                Alle
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              {visibleMeals.length} von {scored.length}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {visibleMeals.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Utensils className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium">Keine passende Mahlzeit gefunden</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Suche ändern oder unter „Alle“ weitere Gerichte anzeigen.
              </p>
            </div>
          )}

          {visibleMeals.map(({ meal, label, score, reasons }, index) => (
            <button
              key={meal.id}
              type="button"
              className="group flex w-full gap-3 overflow-hidden rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5"
              onClick={() => {
                onPick(meal);
                setOpen(false);
              }}
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {meal.image_url ? (
                  <img
                    src={meal.image_url}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-500/20 to-muted">
                    <Utensils className="h-6 w-6 text-emerald-500/70" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{meal.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {Math.round(meal.kcal)} kcal · {Math.round(meal.protein_g)} P ·{" "}
                      {Math.round(meal.carbs_g)} KH · {Math.round(meal.fat_g)} F
                    </div>
                  </div>
                  <Badge
                    variant={score >= 80 ? "default" : score >= 60 ? "secondary" : "outline"}
                    className={cn(
                      "shrink-0 text-[10px]",
                      score >= 80 && "bg-emerald-500 hover:bg-emerald-500",
                    )}
                  >
                    {index === 0 && mode === "recommended" ? "Top-Match" : label}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {reasons.slice(0, 3).map((reason) => (
                    <span
                      key={reason}
                      className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {reason}
                    </span>
                  ))}
                  {meal.mealprep_ok && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600">
                      Mealprep
                    </span>
                  )}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    Aufwand:{" "}
                    {meal.effort === "low" ? "gering" : meal.effort === "high" ? "hoch" : "mittel"}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FoodSearchTab({ slot, onAdd }: { slot: Slot; onAdd: (meal: BuilderMeal) => void }) {
  const runSearch = useServerFn(searchFoodsDb);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<FoodResult | null>(null);
  const [amountStr, setAmountStr] = useState("100");

  useEffect(() => {
    if (!isFoodQueryValid(query)) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const found = await runSearch({ data: { query: query.trim(), limit: 25 } });
        if (!cancelled) {
          setResults(Array.isArray(found) ? found : []);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Suche fehlgeschlagen. Bitte erneut versuchen.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, runSearch]);

  if (picked) {
    const unit = picked.unit === "ml" ? "ml" : "g";
    const amount = Math.max(0, Number(amountStr.replace(",", ".")) || 0);
    const preview = mealFromFood(
      {
        name: picked.name,
        brand: picked.brand,
        unit,
        density_g_per_ml: picked.density_g_per_ml,
        kcal_per_100g: picked.kcal_per_100g,
        protein_per_100g: picked.protein_per_100g,
        carbs_per_100g: picked.carbs_per_100g,
        fat_per_100g: picked.fat_per_100g,
      },
      amount,
      slot,
    );

    return (
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <div className="text-sm font-semibold">{picked.name}</div>
          {picked.brand && <div className="text-xs text-muted-foreground">{picked.brand}</div>}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="food-amount">
            Menge in {unit}
          </label>
          <Input
            id="food-amount"
            inputMode="decimal"
            value={amountStr}
            onChange={(event) => setAmountStr(event.target.value)}
          />
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          {Math.round(preview.kcal ?? 0)} kcal · {Math.round(preview.protein_g ?? 0)} P ·{" "}
          {Math.round(preview.carbs_g ?? 0)} KH · {Math.round(preview.fat_g ?? 0)} F
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
            Zurück
          </Button>
          <Button type="button" size="sm" disabled={amount <= 0} onClick={() => onAdd(preview)}>
            Zum Slot hinzufügen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-border bg-muted/20 px-5 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Lebensmittel suchen (min. 2 Zeichen) …"
            className="pl-9"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Suche läuft …
          </div>
        )}
        {!loading && error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center text-xs text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && !isFoodQueryValid(query) && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            Mindestens 2 Zeichen eingeben, um die Lebensmitteldatenbank zu durchsuchen.
          </div>
        )}
        {!loading && !error && isFoodQueryValid(query) && results.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            Kein Lebensmittel gefunden.
          </div>
        )}
        {!loading &&
          !error &&
          results.map((food, index) => {
            const unit = food.unit === "ml" ? "ml" : "g";
            return (
              <button
                key={`${food.id ?? food.name}-${index}`}
                type="button"
                className="flex w-full gap-3 overflow-hidden rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5"
                onClick={() => {
                  setPicked(food);
                  setAmountStr("100");
                }}
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {food.image_url ? (
                    <img
                      src={food.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Apple className="h-5 w-5 text-emerald-500/70" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{food.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {food.brand || food.source || "BodyFuel"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    pro 100 {unit}: {Math.round(food.kcal_per_100g)} kcal ·{" "}
                    {Math.round(food.protein_per_100g)} P · {Math.round(food.carbs_per_100g)} KH ·{" "}
                    {Math.round(food.fat_per_100g)} F
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </>
  );
}
