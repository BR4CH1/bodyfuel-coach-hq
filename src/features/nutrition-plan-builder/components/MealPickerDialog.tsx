import { useMemo, useState, type ReactNode } from "react";
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
import { Apple, Flame, Heart, Search, Sparkles, Utensils } from "lucide-react";
import type { BuilderMeal, CustomerPlanContext, LibraryMeal } from "@/lib/plan-builder.functions";
import { cn } from "@/lib/utils";
import {
  matchesMealQuery,
  mealFitsDiet,
  scoreMeal,
  type Slot,
} from "../lib/plan-builder.logic";
import { FoodMealComposer } from "./FoodMealComposer";

interface MealPickerDialogProps {
  trigger: ReactNode;
  title: string;
  slot: Slot;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  dayType: "training" | "rest";
  remaining: { kcal: number; p: number; c: number; f: number };
  onPick: (meal: LibraryMeal) => void;
  /** Optional: erzeugt eine eigene Mahlzeit aus fest vorgegebenen Lebensmitteln. */
  onPickFood?: (meal: BuilderMeal) => void;
  excludeId?: string | null;
}

type PickerMode = "recommended" | "wishes" | "soulfood" | "all";
type PickerTab = "meals" | "foods";

function normalizePreference(value: string): string {
  return value.trim().toLowerCase();
}

function customerPreferenceMatchesMeal(meal: LibraryMeal, preferences: string[]): boolean {
  return preferences.some((preference) => {
    const normalized = normalizePreference(preference);
    return Boolean(normalized) && matchesMealQuery(meal, normalized);
  });
}

function isSoulfoodMeal(meal: LibraryMeal): boolean {
  return (meal.tags ?? []).some((tag) => {
    const normalized = tag.trim().toLowerCase();
    return normalized === "soulfood" || normalized === "comfort-food" || normalized === "comfort_food";
  });
}

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

  const requestedMeals = useMemo(
    () => Array.from(new Set(ctx.requestedMeals.map(normalizePreference).filter(Boolean))),
    [ctx.requestedMeals],
  );

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
      if (mode === "wishes" && !customerPreferenceMatchesMeal(meal, requestedMeals)) return false;
      if (mode === "soulfood" && !isSoulfoodMeal(meal)) return false;
      if (!normalizedQuery) return true;
      return matchesMealQuery(meal, normalizedQuery);
    });
  }, [requestedMeals, mode, query, scored]);

  const emptyHint =
    mode === "wishes"
      ? "Für die hinterlegten Kundenwünsche gibt es in diesem Slot noch kein passendes Bibliotheksgericht."
      : mode === "soulfood"
        ? "Für diesen Slot ist noch kein Soulfood-Gericht hinterlegt."
        : "Suche ändern oder unter „Alle“ weitere Gerichte anzeigen.";

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
              Lebensmittel vorgeben
            </Button>
          </div>
        )}

        {onPickFood && tab === "foods" ? (
          <FoodMealComposer
            slot={slot}
            ctx={ctx}
            remaining={remaining}
            onAdd={(builderMeal) => {
              onPickFood(builderMeal);
              setOpen(false);
            }}
          />
        ) : (
          <>
            <div className="space-y-3 border-b border-border bg-muted/20 px-5 py-3">
              {requestedMeals.length > 0 && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Heart className="h-3.5 w-3.5 text-rose-500" />
                    Kundenwünsche
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {requestedMeals.map((preference) => (
                      <span
                        key={preference}
                        className="rounded-full border border-rose-500/20 bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {preference}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
                <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
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
                  {requestedMeals.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant={mode === "wishes" ? "secondary" : "ghost"}
                      className="h-7 text-xs"
                      onClick={() => setMode("wishes")}
                    >
                      <Heart className="mr-1 h-3 w-3" />
                      Wünsche
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "soulfood" ? "secondary" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => setMode("soulfood")}
                  >
                    <Flame className="mr-1 h-3 w-3" />
                    Soulfood
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
                <span className="shrink-0 text-xs text-muted-foreground">
                  {visibleMeals.length} von {scored.length}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {visibleMeals.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <Utensils className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
                  <p className="text-sm font-medium">Keine passende Mahlzeit gefunden</p>
                  <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
                </div>
              )}

              {visibleMeals.map(({ meal, label, score, reasons }, index) => {
                const matchesCustomerWish = customerPreferenceMatchesMeal(meal, requestedMeals);
                const soulfood = isSoulfoodMeal(meal);
                return (
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
                        {matchesCustomerWish && (
                          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600">
                            Kundenwunsch
                          </span>
                        )}
                        {soulfood && (
                          <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-600">
                            Soulfood
                          </span>
                        )}
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
                          {meal.effort === "low"
                            ? "gering"
                            : meal.effort === "high"
                              ? "hoch"
                              : "mittel"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
