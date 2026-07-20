import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Link2Off, Lock, Minus, Plus, Shuffle, Trash2 } from "lucide-react";
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

  const setFactor = (next: number) => {
    const clamped = Math.max(0.25, Math.min(4, Math.round(next * 4) / 4));
    onFactor(clamped);
  };

  return (
    <div className="rounded-lg border border-border p-2">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1 text-xs font-medium">
          {label}
          {meal?.linked_prep_group && (
            <Badge variant="outline" className="gap-1 px-1 py-0 text-[9px]">
              <Link2 className="h-2.5 w-2.5" />
              Prep
            </Badge>
          )}
          {coupled && (
            <Badge className="gap-1 bg-emerald-500/15 px-1 py-0 text-[9px] text-emerald-600 hover:bg-emerald-500/20">
              <Link2 className="h-2.5 w-2.5" />
              Gemeinsam
            </Badge>
          )}
        </div>
        {meal && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onLockToggle}>
              <Lock className={`h-3 w-3 ${meal.is_locked ? "text-amber-500" : ""}`} />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onRemove}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {meal ? (
        <div className="space-y-2 text-xs">
          <div>
            <div className="font-medium">{meal.name}</div>
            <div className="text-muted-foreground">
              {Math.round(macros.kcal)} kcal · {Math.round(macros.p)}P / {Math.round(macros.c)}C /{" "}
              {Math.round(macros.f)}F
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Menge</span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={() => setFactor(factor - 0.25)}
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
              className="h-7 w-16 text-center text-xs"
            />
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={() => setFactor(factor + 0.25)}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <span className="text-muted-foreground">× Portion</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {coupled ? (
              <>
                <MealPickerDialog
                  trigger={
                    <Button size="sm" variant="outline" className="h-7 text-xs">
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
                    <Button size="sm" variant="ghost" className="h-7 text-xs">
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
                  className="h-7 text-xs text-muted-foreground"
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
                    <Button size="sm" variant="outline" className="h-7 text-xs">
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
                    <Button size="sm" variant="ghost" className="h-7 text-xs">
                      Alternative anzeigen
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
                    className="h-7 text-xs"
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
      ) : (
        <div className="space-y-1">
          <MealPickerDialog
            trigger={
              <Button size="sm" variant="outline" className="w-full">
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
      )}
    </div>
  );
}
