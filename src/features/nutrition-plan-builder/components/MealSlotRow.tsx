import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Link2Off, Lock, Minus, Plus, Shuffle, Trash2, Utensils } from "lucide-react";
import type { BuilderMeal, CustomerPlanContext, LibraryMeal } from "@/lib/plan-builder.functions";
import { mealMacros, type PartnerSlotLink, type Slot } from "../lib/plan-builder.logic";
import { MealPickerDialog } from "./MealPickerDialog";

interface MealSlotRowProps {
  slot: Slot;
  label: string;
  meal: BuilderMeal | undefined;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  dayType: "training" | "rest";
  remaining: { kcal: number; p: number; c: number; f: number };
  onPick: (meal: LibraryMeal) => void;
  onSwap: (meal: LibraryMeal) => void;
  onFactor: (factor: number) => void;
  onLockToggle: () => void;
  onRemove: () => void;
  partnerLink?: PartnerSlotLink;
}

export function MealSlotRow({
  slot,
  label,
  meal,
  library,
  ctx,
  dayType,
  remaining,
  onPick,
  onSwap,
  onFactor,
  onLockToggle,
  onRemove,
  partnerLink,
}: MealSlotRowProps) {
  const macros = meal ? mealMacros(meal, library) : { kcal: 0, p: 0, c: 0, f: 0 };
  const factor = meal?.portion_factor ?? 1;
  const coupled = Boolean(partnerLink?.isCoupled);
  const libraryMeal = meal
    ? library.find((candidate) => candidate.id === meal.library_meal_id)
    : undefined;
  const imageUrl = libraryMeal?.image_url;

  const setFactor = (next: number) => {
    const clamped = Math.max(0.25, Math.min(4, Math.round(next * 4) / 4));
    onFactor(clamped);
  };

  if (!meal) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">{label}</div>
            <div className="text-xs text-muted-foreground">Noch keine Mahlzeit geplant</div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <MealPickerDialog
            trigger={
              <Button size="sm" variant="outline" className="w-full">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Mahlzeit auswählen
              </Button>
            }
            title={`Mahlzeit für ${label}`}
            slot={slot}
            library={library}
            ctx={ctx}
            dayType={dayType}
            remaining={remaining}
            onPick={onPick}
          />
          {partnerLink && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs"
              onClick={partnerLink.onCouple}
            >
              <Link2 className="mr-1 h-3 w-3" />
              Von {partnerLink.partnerName} übernehmen
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex min-h-[112px]">
        <div className="hidden w-28 shrink-0 bg-muted sm:block">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-500/20 to-muted">
              <Utensils className="h-7 w-7 text-emerald-500/70" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </span>
                {meal.linked_prep_group && (
                  <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[9px]">
                    <Link2 className="h-2.5 w-2.5" />
                    Mealprep
                  </Badge>
                )}
                {coupled && (
                  <Badge className="gap-1 bg-emerald-500/15 px-1.5 py-0 text-[9px] text-emerald-600 hover:bg-emerald-500/20">
                    <Link2 className="h-2.5 w-2.5" />
                    Gemeinsam
                  </Badge>
                )}
                {meal.is_locked && (
                  <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[9px]">
                    <Lock className="h-2.5 w-2.5" />
                    Fixiert
                  </Badge>
                )}
              </div>
              <div className="truncate text-sm font-semibold sm:text-base">{meal.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {Math.round(macros.kcal)} kcal · {Math.round(macros.p)} g Protein ·{" "}
                {Math.round(macros.c)} g KH · {Math.round(macros.f)} g Fett
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="icon"
                variant={meal.is_locked ? "secondary" : "ghost"}
                className="h-8 w-8"
                onClick={onLockToggle}
                aria-label={meal.is_locked ? "Fixierung lösen" : "Mahlzeit fixieren"}
              >
                <Lock className={`h-3.5 w-3.5 ${meal.is_locked ? "text-amber-500" : ""}`} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
                aria-label="Mahlzeit entfernen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Portion</span>
            <div className="flex items-center rounded-lg border border-border bg-background">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-r-none"
                onClick={() => setFactor(factor - 0.25)}
                aria-label="Portion verkleinern"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                step="0.25"
                min={0.25}
                max={4}
                value={factor}
                onChange={(event) => setFactor(Number(event.target.value) || 1)}
                className="h-8 w-14 rounded-none border-y-0 px-1 text-center text-xs"
                aria-label="Portionsfaktor"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-l-none"
                onClick={() => setFactor(factor + 0.25)}
                aria-label="Portion vergrößern"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">× Standardportion</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-border bg-muted/20 p-2.5">
        {coupled ? (
          <>
            <MealPickerDialog
              trigger={
                <Button size="sm" variant="outline" className="h-8 text-xs">
                  <Shuffle className="mr-1 h-3 w-3" />
                  Für beide tauschen
                </Button>
              }
              title={`${label} für beide tauschen`}
              slot={slot}
              library={library}
              ctx={ctx}
              dayType={dayType}
              remaining={remaining}
              onPick={(selected) => partnerLink!.onSwapForBoth(selected)}
            />
            <MealPickerDialog
              trigger={
                <Button size="sm" variant="ghost" className="h-8 text-xs">
                  Nur für {partnerLink!.selfName} tauschen
                </Button>
              }
              title={`${label} nur für ${partnerLink!.selfName} tauschen`}
              slot={slot}
              library={library}
              ctx={ctx}
              dayType={dayType}
              remaining={remaining}
              onPick={(selected) => {
                partnerLink!.onUncouple();
                onSwap(selected);
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={partnerLink!.onUncouple}
            >
              <Link2Off className="mr-1 h-3 w-3" />
              Kopplung lösen
            </Button>
          </>
        ) : (
          <>
            <MealPickerDialog
              trigger={
                <Button size="sm" variant="outline" className="h-8 text-xs">
                  <Shuffle className="mr-1 h-3 w-3" />
                  Tauschen
                </Button>
              }
              title={`${label} tauschen`}
              slot={slot}
              library={library}
              ctx={ctx}
              dayType={dayType}
              remaining={remaining}
              onPick={onSwap}
            />
            <MealPickerDialog
              trigger={
                <Button size="sm" variant="ghost" className="h-8 text-xs">
                  Alternativen
                </Button>
              }
              title={`Alternativen für ${label}`}
              slot={slot}
              library={library}
              ctx={ctx}
              dayType={dayType}
              remaining={remaining}
              onPick={onSwap}
              excludeId={meal.library_meal_id ?? null}
            />
            {partnerLink && (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                onClick={partnerLink.onCouple}
              >
                <Link2 className="mr-1 h-3 w-3" />
                Mit {partnerLink.partnerName} koppeln
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
