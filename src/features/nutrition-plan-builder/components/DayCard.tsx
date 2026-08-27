import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Copy, Link2, Link2Off, Plus, SlidersHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type {
  BuilderDay,
  BuilderMeal,
  CustomerPlanContext,
  LibraryMeal,
} from "@/lib/plan-builder.functions";
import {
  SLOTS,
  autoFillDayImpl,
  daySlotTargets,
  macroProgress,
  makeGroupId,
  mealFromLibrary,
  rebalanceDay,
  resolveSlotKcalTargets,
  setSlotKcalTarget,
  slotStatus,
  slotTotals,
  summarizeDay,
  type MacroValues,
  type PartnerSlotLink,
  type Slot,
} from "../lib/plan-builder.logic";
import { MacroTargetEditorDialog, type TargetScope } from "./MacroTargetEditorDialog";
import { MealPickerDialog } from "./MealPickerDialog";
import { MealSlotRow } from "./MealSlotRow";
import { Input } from "@/components/ui/input";



export function DayCard({
  day,
  library,
  ctx,
  onChange,
  onCopy,
  hideHeaderActions,
  partnerLinkForSlot,
  onEnsureMealImage,
  onApplyTargets,
  onResetTargets,
  targetsBusy,
}: {
  day: BuilderDay;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  onChange: (u: (d: BuilderDay) => BuilderDay) => void;
  onCopy: () => void;
  hideHeaderActions?: boolean;
  partnerLinkForSlot?: (slot: Slot) => PartnerSlotLink | undefined;
  onEnsureMealImage?: (mealId: string) => void;
  onApplyTargets?: (targets: MacroValues, scope: TargetScope, adjustMeals: boolean) => void;
  onResetTargets?: (scope: TargetScope) => void;
  targetsBusy?: boolean;
}) {
  const { target, totals, filledSlots, totalSlots, isBalanced } = summarizeDay(day, ctx, library);
  const slotTargets = daySlotTargets(day, ctx);
  const slotKcalTargets = resolveSlotKcalTargets(target.kcal, day.slotKcalTargets ?? null);

  const updateSlotKcalTarget = (slot: Slot, value: number) => {
    onChange((d) => ({
      ...d,
      slotKcalTargets: setSlotKcalTarget(slotKcalTargets, slot, value, target.kcal),
    }));
  };

  const resetSlotTargets = () => onChange((d) => ({ ...d, slotKcalTargets: null }));




  // ---- Index-based helpers so multiple meals per slot are supported ----
  const updateMealAtIndex = (index: number, upd: (m: BuilderMeal) => BuilderMeal) => {
    onChange((d) => {
      const target = d.meals[index];
      if (!target) return d;
      const updated = upd(target);
      // Mealprep-Kopplung nur wenn genau eine Mahlzeit im Slot ↔ Partnerslot
      if (target.linked_prep_group) {
        const partnerSlot: Slot | null =
          target.slot === "lunch" ? "dinner" : target.slot === "dinner" ? "lunch" : null;
        if (partnerSlot) {
          return {
            ...d,
            meals: d.meals.map((m, i) => {
              if (i === index) return updated;
              if (m.slot === partnerSlot && m.linked_prep_group === target.linked_prep_group) {
                return {
                  ...m,
                  name: updated.name,
                  description: updated.description,
                  library_meal_id: updated.library_meal_id,
                  ingredients: updated.ingredients.map((i) => ({ ...i })),
                };
              }
              return m;
            }),
          };
        }
      }
      return { ...d, meals: d.meals.map((m, i) => (i === index ? updated : m)) };
    });
  };

  const removeMealAtIndex = (index: number) => {
    onChange((d) => {
      const target = d.meals[index];
      if (!target) return d;
      const group = target.linked_prep_group;
      let meals = d.meals.filter((_, i) => i !== index);
      if (group) {
        meals = meals.map((m) =>
          m.linked_prep_group === group ? { ...m, linked_prep_group: null } : m,
        );
      }
      return { ...d, meals };
    });
  };

  const pickMealForEmptySlot = (slot: Slot, lib: LibraryMeal) => {
    onChange((d) => {
      if (d.prepCoupleLunchDinner && (slot === "lunch" || slot === "dinner")) {
        const groupId = makeGroupId();
        const lunch = mealFromLibrary(lib, "lunch", 1, groupId);
        const dinner = mealFromLibrary(lib, "dinner", 1, groupId);
        dinner.description = (lib.description ?? "") + " (Portion 2 aus Mealprep)";
        const meals = d.meals.filter((x) => x.slot !== "lunch" && x.slot !== "dinner");
        meals.push(lunch, dinner);
        return { ...d, meals };
      }
      const meals = [...d.meals, mealFromLibrary(lib, slot)];
      return { ...d, meals };
    });
  };

  const addFoodMeal = (slot: Slot, built: BuilderMeal) => {
    onChange((d) => ({ ...d, meals: [...d.meals, { ...built, slot }] }));
  };

  const addAdditionalMeal = (slot: Slot, lib: LibraryMeal) => {
    onChange((d) => ({ ...d, meals: [...d.meals, mealFromLibrary(lib, slot)] }));
  };

  const toggleCouple = (on: boolean) => {
    onChange((d) => {
      if (on) {
        const lunch = d.meals.find((m) => m.slot === "lunch");
        const dinner = d.meals.find((m) => m.slot === "dinner");
        const groupId = makeGroupId();
        let meals = [...d.meals];
        if (lunch && !dinner) {
          const src = library.find((x) => x.id === lunch.library_meal_id);
          if (src) {
            const clone = mealFromLibrary(src, "dinner", 1, groupId);
            clone.description = (src.description ?? "") + " (Portion 2 aus Mealprep)";
            meals = meals.map((m) =>
              m.slot === "lunch" ? { ...m, linked_prep_group: groupId } : m,
            );
            meals.push(clone);
          }
        } else if (dinner && !lunch) {
          const src = library.find((x) => x.id === dinner.library_meal_id);
          if (src) {
            const clone = mealFromLibrary(src, "lunch", 1, groupId);
            meals = meals.map((m) =>
              m.slot === "dinner" ? { ...m, linked_prep_group: groupId } : m,
            );
            meals.push(clone);
          }
        } else if (lunch && dinner) {
          const src = library.find((x) => x.id === lunch.library_meal_id);
          meals = meals.map((m) => {
            if (m.slot === "lunch") return { ...m, linked_prep_group: groupId };
            if (m.slot === "dinner" && src)
              return {
                ...m,
                name: src.name,
                description: (src.description ?? "") + " (Portion 2 aus Mealprep)",
                library_meal_id: src.id,
                ingredients: (src.ingredients ?? []).map((i) => ({
                  name: i.name,
                  grams: Math.round(i.amount_g ?? 0),
                })),
                linked_prep_group: groupId,
              };
            return m;
          });
        }
        return { ...d, prepCoupleLunchDinner: true, meals };
      } else {
        return {
          ...d,
          prepCoupleLunchDinner: false,
          meals: d.meals.map((m) =>
            m.slot === "lunch" || m.slot === "dinner" ? { ...m, linked_prep_group: null } : m,
          ),
        };
      }
    });
  };

  const autoFillDay = () => {
    onChange((d) => {
      const res = autoFillDayImpl(d, ctx, library, "empty_only");
      if (res.missing.length > 0) {
        toast.warning(
          `Für ${res.missing.length} Slot(s) wurde keine passende Mahlzeit gefunden. Bitte Mahlzeitendatenbank erweitern oder Filter prüfen.`,
        );
      }
      return rebalanceDay(res.day, ctx, library);
    });
  };

  const balancePortions = () => {
    let changed = false;
    onChange((current) => {
      const next = rebalanceDay(current, ctx, library);
      changed = next.meals.some((m, i) => (m.portion_factor ?? 1) !== (current.meals[i]?.portion_factor ?? 1));
      return next;
    });
    if (changed) toast.success("Portionen wurden an das Kalorienziel angepasst.");
    else toast.info("Keine Portionen anpassbar (Mahlzeiten fixiert oder ohne Nährwerte).");
  };

  const remaining = {
    kcal: target.kcal - totals.kcal,
    p: target.p - totals.p,
    c: target.c - totals.c,
    f: target.f - totals.f,
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/20 pb-3">
        <div className="flex items-center gap-2">
          {!hideHeaderActions && <CardTitle className="text-sm">{day.name}</CardTitle>}
          <Badge
            variant={day.type === "training" ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() =>
              onChange((d) => ({
                ...d,
                type: d.type === "training" ? "rest" : "training",
                typeOverride: true,
              }))
            }
          >
            {day.type === "training" ? "Trainingstag" : "Restday"}
          </Badge>
          {day.type === "training" && day.split ? (
            <span className="text-xs text-muted-foreground">{day.split}</span>
          ) : null}
        </div>
        {!hideHeaderActions && (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="secondary" onClick={autoFillDay}>
              <Sparkles className="mr-1 h-3 w-3" />
              Tag automatisch füllen
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={day.meals.length === 0}
              onClick={balancePortions}
            >
              <SlidersHorizontal className="mr-1 h-3 w-3" />
              Portionen ans Ziel
            </Button>
            <Button size="sm" variant="ghost" onClick={onCopy}>
              <Copy className="mr-1 h-3 w-3" />
              auf nächsten Tag
            </Button>
          </div>
        )}
        {hideHeaderActions && (
          <Button size="sm" variant="ghost" onClick={autoFillDay}>
            <Sparkles className="mr-1 h-3 w-3" />
            Tag füllen
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Balance */}
        <div className="rounded-xl border border-border bg-background p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Tagesbilanz</span>
                {day.customTargets && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    Individuelles Ziel
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {filledSlots}/{totalSlots} Slots · {day.meals.length} Mahlzeiten geplant
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                <span className="text-muted-foreground">
                  Tagesziel <span className="font-medium text-foreground">{target.kcal} kcal</span>
                </span>
                <span className="text-muted-foreground">
                  Verplant{" "}
                  <span className="font-medium text-foreground">
                    {Math.round(totals.kcal)} kcal
                  </span>
                </span>
                <span
                  className={
                    Math.abs(totals.kcal - target.kcal) <= target.kcal * 0.05
                      ? "font-medium text-emerald-500"
                      : "font-medium text-amber-500"
                  }
                >
                  Differenz {totals.kcal - target.kcal >= 0 ? "+" : "−"}
                  {Math.abs(Math.round(totals.kcal - target.kcal))} kcal
                </span>
              </div>

            </div>
            <div className="flex items-center gap-1">
              {onApplyTargets && (
                <MacroTargetEditorDialog
                  currentTarget={target}
                  hasCustomTarget={Boolean(day.customTargets)}
                  onApply={onApplyTargets}
                  onReset={(scope) => onResetTargets?.(scope)}
                  busy={targetsBusy}
                />
              )}
              <Badge
                variant={isBalanced ? "default" : "outline"}
                className={
                  isBalanced
                    ? "bg-emerald-500 text-white hover:bg-emerald-500"
                    : "text-muted-foreground"
                }
              >
                {isBalanced ? "Im Zielbereich" : "Noch offen"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Kalorien", totals.kcal, target.kcal, "kcal", "bg-emerald-500"],
                ["Protein", totals.p, target.p, "g", "bg-sky-500"],
                ["Kohlenhydrate", totals.c, target.c, "g", "bg-amber-500"],
                ["Fett", totals.f, target.f, "g", "bg-violet-500"],
              ] as const
            ).map(([label, value, targetValue, unit, barColor]) => {
              const diff = Math.round(value - targetValue);
              const differencePercent = targetValue ? Math.abs(diff) / targetValue : 0;
              const statusColor =
                differencePercent <= 0.05
                  ? "text-emerald-500"
                  : differencePercent <= 0.1
                    ? "text-amber-500"
                    : "text-muted-foreground";
              return (
                <div key={label} className="space-y-1.5 rounded-lg bg-muted/50 p-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">
                      {Math.round(value)} / {targetValue} {unit}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${macroProgress(value, targetValue)}%` }}
                    />
                  </div>
                  <div className={`text-[10px] ${statusColor}`}>
                    {diff === 0
                      ? "Ziel erreicht"
                      : diff > 0
                        ? `${Math.abs(diff)} ${unit} über Ziel`
                        : `${Math.abs(diff)} ${unit} offen`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mahlzeiten-Zielverteilung */}
        <div className="rounded-xl border border-border bg-background p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Mahlzeiten-Ziele</div>
              <div className="text-xs text-muted-foreground">
                Verteilung des Tagesziels auf die Mahlzeiten (kcal editierbar)
              </div>
            </div>
            {day.slotKcalTargets ? (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetSlotTargets}>
                Standard (25/30/30/15)
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SLOTS.map(({ key, label }) => {
              const slotTarget = slotTargets[key];
              const actual = slotTotals(day, key, library);
              const status = slotStatus(actual.kcal, slotTarget.kcal);
              const diff = Math.round(actual.kcal - slotTarget.kcal);
              const statusLabel =
                status === "on_target"
                  ? "Im Zielbereich"
                  : status === "under"
                    ? `${Math.abs(diff)} kcal offen`
                    : `${Math.abs(diff)} kcal über Ziel`;
              const statusColor =
                status === "on_target"
                  ? "text-emerald-500"
                  : status === "under"
                    ? "text-amber-500"
                    : "text-destructive";
              return (
                <div key={key} className="rounded-lg bg-muted/50 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{label}</span>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        step={25}
                        value={slotKcalTargets[key]}
                        onChange={(event) =>
                          updateSlotKcalTarget(key, Number(event.target.value) || 0)
                        }
                        className="h-7 w-20 px-2 text-right text-xs"
                        aria-label={`kcal-Ziel ${label}`}
                      />
                      <span className="text-[10px] text-muted-foreground">kcal</span>
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Ziel: {slotTarget.kcal} kcal · {slotTarget.p} P · {slotTarget.c} KH ·{" "}
                    {slotTarget.f} F
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Aktuell: {Math.round(actual.kcal)} kcal · {Math.round(actual.p)} P ·{" "}
                    {Math.round(actual.c)} KH · {Math.round(actual.f)} F
                  </div>
                  <div className={`mt-0.5 text-[10px] ${statusColor}`}>{statusLabel}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mealprep coupling */}

        <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-2 text-xs">
          <div className="flex items-center gap-2">
            {day.prepCoupleLunchDinner ? (
              <Link2 className="h-3 w-3 text-emerald-500" />
            ) : (
              <Link2Off className="h-3 w-3 text-muted-foreground" />
            )}
            <span>Mittagessen &amp; Abendessen koppeln (Mealprep)</span>
          </div>
          <Switch checked={!!day.prepCoupleLunchDinner} onCheckedChange={(v) => toggleCouple(v)} />
        </div>

        {/* Meals per slot – multiple entries pro Slot möglich */}
        {SLOTS.map((slot) => {
          const slotEntries = day.meals
            .map((m, idx) => ({ m, idx }))
            .filter(({ m }) => m.slot === slot.key);

          return (
            <div key={slot.key} className="space-y-2">
              {slotEntries.length === 0 ? (
                <MealSlotRow
                  slot={slot.key}
                  label={slot.label}
                  meal={undefined}
                  library={library}
                  ctx={ctx}
                  dayType={day.type}
                  remaining={remaining}
                  onPick={(lib) => pickMealForEmptySlot(slot.key, lib)}
                  onPickFood={(built) => addFoodMeal(slot.key, built)}
                  onSwap={() => {}}
                  onFactor={() => {}}
                  onLockToggle={() => {}}
                  onRemove={() => {}}
                  partnerLink={partnerLinkForSlot?.(slot.key)}
                  onEnsureMealImage={onEnsureMealImage}
                />
              ) : (
                <>
                  {slotEntries.map(({ m, idx }, entryIndex) => (
                    <MealSlotRow
                      key={idx}
                      slot={slot.key}
                      label={
                        slotEntries.length > 1 ? `${slot.label} · ${entryIndex + 1}` : slot.label
                      }
                      meal={m}
                      library={library}
                      ctx={ctx}
                      dayType={day.type}
                      remaining={remaining}
                      onPick={(lib) => addAdditionalMeal(slot.key, lib)}
                      onPickFood={(built) => addFoodMeal(slot.key, built)}
                      onSwap={(lib) =>
                        updateMealAtIndex(idx, (curr) => ({
                          ...curr,
                          name: lib.name,
                          description: lib.description,
                          library_meal_id: lib.id,
                          ingredients: (lib.ingredients ?? []).map((i) => ({
                            name: i.name,
                            grams: Math.round(i.amount_g ?? 0),
                          })),
                        }))
                      }
                      onFactor={(f) =>
                        updateMealAtIndex(idx, (curr) => ({ ...curr, portion_factor: f }))
                      }
                      onLockToggle={() =>
                        updateMealAtIndex(idx, (curr) => ({ ...curr, is_locked: !curr.is_locked }))
                      }
                      onRemove={() => removeMealAtIndex(idx)}
                      partnerLink={
                        entryIndex === 0 ? partnerLinkForSlot?.(slot.key) : undefined
                      }
                      onEnsureMealImage={onEnsureMealImage}
                    />
                  ))}
                  <MealPickerDialog
                    trigger={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full justify-center border border-dashed border-border/70 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Weitere {slot.label} hinzufügen
                      </Button>
                    }
                    title={`Weitere Mahlzeit für ${slot.label}`}
                    slot={slot.key}
                    library={library}
                    ctx={ctx}
                    dayType={day.type}
                    remaining={remaining}
                    onPick={(lib) => addAdditionalMeal(slot.key, lib)}
                    onPickFood={(built) => addFoodMeal(slot.key, built)}
                  />
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
