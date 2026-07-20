import { ChefHat, Droplet, Dumbbell, Moon, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BULLS_DAY_TYPE_LABELS,
  type BullsDayType,
} from "@/lib/performance-nutrition/bulls-nutrition.functions";
import type { DayType } from "@/lib/nutrition.functions";
import { MEALS } from "../constants";
import { cleanPlanEntryName, shiftIsoDate, todayIso } from "../lib/nutrition-tracker.logic";
import type { FoodEntry, Meal, NutritionTargets, NutritionTotals } from "../types";
import { NutritionRing } from "./NutritionRing";

function bullsDayTypeLabel(kind: BullsDayType | string): string {
  return (BULLS_DAY_TYPE_LABELS as Record<string, string>)[kind] ?? String(kind);
}

export function DateNavigator({
  date,
  isToday,
  onDateChange,
}: {
  date: string;
  isToday: boolean;
  onDateChange: (date: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => onDateChange(shiftIsoDate(date, -1))}>
          ← Tag
        </Button>
        <Input
          type="date"
          className="h-8 w-[150px]"
          value={date}
          max={todayIso()}
          onChange={(event) => event.target.value && onDateChange(event.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={isToday}
          onClick={() => {
            const next = shiftIsoDate(date, 1);
            if (next <= todayIso()) onDateChange(next);
          }}
        >
          Tag →
        </Button>
      </div>
      {!isToday && (
        <Button size="sm" variant="ghost" onClick={() => onDateChange(todayIso())}>
          Heute
        </Button>
      )}
    </div>
  );
}

export function DayTypeCard({
  isBulls,
  dayType,
  dayTypeSource,
  baseTargets,
  restTargets,
  saving,
  onToggle,
  onReset,
}: {
  isBulls: boolean;
  dayType: DayType | BullsDayType;
  dayTypeSource: "manual" | "auto";
  baseTargets: NutritionTargets;
  restTargets: NutritionTargets | null;
  saving: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const isTraining = dayType === "training";

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${
        isTraining
          ? "border-gold/50 bg-gradient-to-br from-accent/40 to-card"
          : "border-blue-400/40 bg-blue-400/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid h-11 w-11 place-items-center rounded-xl ${
            isTraining ? "bg-gradient-gold text-primary-foreground" : "bg-blue-400/20 text-blue-300"
          }`}
        >
          {isTraining ? <Dumbbell className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </div>
        <div>
          <div className="text-sm font-bold">
            {isBulls
              ? bullsDayTypeLabel(dayType as BullsDayType)
              : isTraining
                ? "Trainingstag"
                : "Restday"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isBulls
              ? `${baseTargets.kcal} kcal · P ${baseTargets.protein_g} · K ${baseTargets.carbs_g} · F ${baseTargets.fat_g}`
              : restTargets
                ? isTraining
                  ? `Training: ${baseTargets.kcal} kcal · P ${baseTargets.protein_g} · K ${baseTargets.carbs_g} · F ${baseTargets.fat_g}`
                  : `Restday: ${restTargets.kcal} kcal · P ${restTargets.protein_g} · K ${restTargets.carbs_g} · F ${restTargets.fat_g}`
                : "Im Plan ist kein Restday-Wert hinterlegt"}
            {" · "}
            {dayTypeSource === "auto" ? "automatisch erkannt" : "manuell gesetzt"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {dayTypeSource === "manual" && (
          <Button size="sm" variant="ghost" onClick={onReset} disabled={saving}>
            Auto
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onToggle} disabled={saving}>
          {isBulls
            ? dayType === "rest"
              ? "Auf Football Training ändern"
              : "Auf Restday ändern"
            : `Auf ${isTraining ? "Restday" : "Trainingstag"} ändern`}
        </Button>
      </div>
    </div>
  );
}

export function NutritionSummary({
  totals,
  targets,
}: {
  totals: NutritionTotals;
  targets: NutritionTargets;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Heute</p>
          <h2 className="font-display text-xl font-bold">
            {Math.round(totals.kcal)} / {targets.kcal} kcal
          </h2>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          Rest:{" "}
          <span className="font-semibold text-gold">
            {Math.max(0, targets.kcal - Math.round(totals.kcal))} kcal
          </span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <NutritionRing
          label="kcal"
          value={totals.kcal}
          target={targets.kcal}
          color="var(--gold)"
          unit=""
        />
        <NutritionRing
          label="Protein"
          value={totals.protein_g}
          target={targets.protein_g}
          color="#ef4444"
          unit="g"
        />
        <NutritionRing
          label="Carbs"
          value={totals.carbs_g}
          target={targets.carbs_g}
          color="#3b82f6"
          unit="g"
        />
        <NutritionRing
          label="Fett"
          value={totals.fat_g}
          target={targets.fat_g}
          color="#f59e0b"
          unit="g"
        />
      </div>
    </div>
  );
}

export function WaterTrackerCard({
  waterGlasses,
  targetGlasses,
  onChange,
}: {
  waterGlasses: number;
  targetGlasses: number;
  onChange: (next: number) => void;
}) {
  const waterMl = waterGlasses * 250;
  const targetMl = targetGlasses * 250;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplet className="h-4 w-4 text-blue-400" />
          <div>
            <div className="text-sm font-semibold">Wasser</div>
            <div className="text-xs text-muted-foreground">
              {waterMl} ml / {targetMl} ml ({waterGlasses}/{targetGlasses} Gläser à 0,25 L)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onChange(waterGlasses - 1)}>
            −
          </Button>
          <Button size="sm" variant="outline" onClick={() => onChange(waterGlasses + 1)}>
            + Glas
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: Math.max(targetGlasses, waterGlasses) }).map((_, index) => {
          const filled = index < waterGlasses;
          return (
            <button
              key={index}
              onClick={() => onChange(index + 1 === waterGlasses ? index : index + 1)}
              className={`grid h-9 w-7 place-items-center rounded-md border transition ${
                filled
                  ? "border-blue-400/70 bg-blue-400/20 text-blue-300"
                  : "border-border bg-background/40 text-muted-foreground hover:border-blue-400/40"
              }`}
              aria-label={`Glas ${index + 1}`}
            >
              <Droplet className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CreateMealCard({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-accent/30 to-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold">Eigene Mahlzeit erstellen</div>
          <div className="text-[11px] text-muted-foreground">
            Stell dir aus mehreren Lebensmitteln eine eigene Mahlzeit zusammen und tracke sie später
            mit einem Klick.
          </div>
        </div>
        <Button
          size="sm"
          onClick={onCreate}
          className="shrink-0 bg-gradient-gold text-primary-foreground"
        >
          <ChefHat className="h-4 w-4" /> Erstellen
        </Button>
      </div>
    </div>
  );
}

export function MealCard({
  meal,
  entries,
  onAdd,
  onRemove,
}: {
  meal: (typeof MEALS)[number];
  entries: FoodEntry[];
  onAdd: (meal: Meal) => void;
  onRemove: (id: string) => void;
}) {
  const kcal = entries.reduce((sum, entry) => sum + Number(entry.kcal), 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meal.emoji}</span>
          <div>
            <div className="text-sm font-semibold">{meal.label}</div>
            <div className="text-xs text-muted-foreground">{Math.round(kcal)} kcal</div>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => onAdd(meal.key)}
          className="bg-gradient-gold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Hinzufügen
        </Button>
      </div>
      {entries.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {entries.map((entry) => {
            const isPlan = entry.source?.startsWith("plan:") ?? false;
            return (
              <li key={entry.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-medium">
                    {cleanPlanEntryName(entry.name, entry.source)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {entry.brand ? `${entry.brand} · ` : ""}
                    {isPlan ? "" : `${Number(entry.serving_g)} g · `}
                    {Math.round(Number(entry.kcal))} kcal · P {Number(entry.protein_g)} · K{" "}
                    {Number(entry.carbs_g)} · F {Number(entry.fat_g)}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(entry.id)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
