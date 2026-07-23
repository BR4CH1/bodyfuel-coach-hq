import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Copy, Link2, Link2Off, SlidersHorizontal, Sparkles } from "lucide-react";
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
  macroProgress,
  makeGroupId,
  mealFromLibrary,
  rebalanceDay,
  summarizeDay,
  type PartnerSlotLink,
  type Slot,
} from "../lib/plan-builder.logic";
import { MealSlotRow } from "./MealSlotRow";

export function DayCard({
  day,
  library,
  ctx,
  onChange,
  onCopy,
  hideHeaderActions,
  partnerLinkForSlot,
}: {
  day: BuilderDay;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  onChange: (u: (d: BuilderDay) => BuilderDay) => void;
  onCopy: () => void;
  hideHeaderActions?: boolean;
  partnerLinkForSlot?: (slot: Slot) => PartnerSlotLink | undefined;
}) {
  const { target, totals, filledSlots, totalSlots, isBalanced } = summarizeDay(day, ctx, library);

  // ---- Meal helpers ----
  const setMealAtSlot = (slot: Slot, next: BuilderMeal | null) => {
    onChange((d) => {
      const meals = d.meals.filter((x) => x.slot !== slot);
      if (next) meals.push(next);
      return { ...d, meals };
    });
  };

  const updateMealAtSlot = (slot: Slot, upd: (m: BuilderMeal) => BuilderMeal) => {
    onChange((d) => {
      const target = d.meals.find((x) => x.slot === slot);
      if (!target) return d;
      const updated = upd(target);
      // Kopplung: wenn lunch/dinner in gleicher Gruppe → auch Partner spiegeln (Meal + Faktor)
      if (target.linked_prep_group) {
        const partnerSlot: Slot | null =
          target.slot === "lunch" ? "dinner" : target.slot === "dinner" ? "lunch" : null;
        if (partnerSlot) {
          return {
            ...d,
            meals: d.meals.map((m) => {
              if (m.slot === slot) return updated;
              if (m.slot === partnerSlot && m.linked_prep_group === target.linked_prep_group) {
                return {
                  ...m,
                  name: updated.name,
                  description: updated.description,
                  library_meal_id: updated.library_meal_id,
                  ingredients: updated.ingredients.map((i) => ({ ...i })),
                  // Portionsfaktor pro Slot getrennt (Portion 1 vs Portion 2)
                };
              }
              return m;
            }),
          };
        }
      }
      return { ...d, meals: d.meals.map((m) => (m.slot === slot ? updated : m)) };
    });
  };

  const removeMealAtSlot = (slot: Slot) => {
    onChange((d) => {
      const target = d.meals.find((x) => x.slot === slot);
      if (!target) return d;
      // Kopplung auflösen bei Entfernen
      const group = target.linked_prep_group;
      let meals = d.meals.filter((x) => x.slot !== slot);
      if (group) {
        meals = meals.map((m) =>
          m.linked_prep_group === group ? { ...m, linked_prep_group: null } : m,
        );
      }
      return { ...d, meals };
    });
  };

  const pickMeal = (slot: Slot, lib: LibraryMeal) => {
    onChange((d) => {
      // Kopplung aktiv & Slot ist lunch oder dinner → beide setzen
      if (d.prepCoupleLunchDinner && (slot === "lunch" || slot === "dinner")) {
        const groupId = makeGroupId();
        const lunch = mealFromLibrary(lib, "lunch", 1, groupId);
        const dinner = mealFromLibrary(lib, "dinner", 1, groupId);
        // Portion 2 markieren (nur visuell im Namen-Suffix)
        dinner.description = (lib.description ?? "") + " (Portion 2 aus Mealprep)";
        const meals = d.meals.filter((x) => x.slot !== "lunch" && x.slot !== "dinner");
        meals.push(lunch, dinner);
        return { ...d, meals };
      }
      const meals = d.meals.filter((x) => x.slot !== slot);
      meals.push(mealFromLibrary(lib, slot));
      return { ...d, meals };
    });
  };

  const toggleCouple = (on: boolean) => {
    onChange((d) => {
      if (on) {
        // Wenn lunch existiert, dinner spiegeln; sonst gemeinsame Gruppe vergeben
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
          // Beide vorhanden → dinner an lunch angleichen, in gleiche Gruppe
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
        // Kopplung lösen: Gruppen entfernen, Mahlzeiten bleiben
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
      return res.day;
    });
  };

  const balancePortions = () => {
    onChange((current) => rebalanceDay(current, ctx, library));
    toast.success("Portionen wurden an das Kalorienziel angepasst.");
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
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Tagesbilanz</div>
              <div className="text-xs text-muted-foreground">
                {filledSlots}/{totalSlots} Mahlzeiten geplant
              </div>
            </div>
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

        {/* Meals per slot */}
        {SLOTS.map((slot) => {
          const meal = day.meals.find((m) => m.slot === slot.key);
          const remaining = {
            kcal: target.kcal - totals.kcal,
            p: target.p - totals.p,
            c: target.c - totals.c,
            f: target.f - totals.f,
          };
          return (
            <MealSlotRow
              key={slot.key}
              slot={slot.key}
              label={slot.label}
              meal={meal}
              library={library}
              ctx={ctx}
              dayType={day.type}
              remaining={remaining}
              onPick={(lib) => pickMeal(slot.key, lib)}
              onSwap={(lib) => {
                if (!meal) return;
                updateMealAtSlot(slot.key, (m) => ({
                  ...m,
                  name: lib.name,
                  description: lib.description,
                  library_meal_id: lib.id,
                  ingredients: (lib.ingredients ?? []).map((i) => ({
                    name: i.name,
                    grams: Math.round(i.amount_g ?? 0),
                  })),
                }));
              }}
              onFactor={(f) => updateMealAtSlot(slot.key, (m) => ({ ...m, portion_factor: f }))}
              onLockToggle={() =>
                updateMealAtSlot(slot.key, (m) => ({ ...m, is_locked: !m.is_locked }))
              }
              onRemove={() => removeMealAtSlot(slot.key)}
              partnerLink={partnerLinkForSlot?.(slot.key)}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
