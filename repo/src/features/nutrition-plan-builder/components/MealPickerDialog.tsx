import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CustomerPlanContext, LibraryMeal } from "@/lib/plan-builder.functions";
import { scoreMeal, type Slot } from "../lib/plan-builder.logic";

interface MealPickerDialogProps {
  trigger: ReactNode;
  title: string;
  slot: Slot;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  dayType: "training" | "rest";
  remaining: { kcal: number; p: number; c: number; f: number };
  onPick: (meal: LibraryMeal) => void;
  excludeId?: string | null;
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
  excludeId,
}: MealPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const scored = useMemo(
    () =>
      library
        .filter((meal) => meal.category === slot && (!excludeId || meal.id !== excludeId))
        .map((meal) => ({ meal, ...scoreMeal(meal, ctx, dayType, remaining) }))
        .sort((a, b) => b.score - a.score),
    [library, ctx, slot, dayType, remaining, excludeId],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {scored.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Vorschläge.</p>
          )}
          {scored.map(({ meal, label, score, reasons }) => (
            <button
              key={meal.id}
              type="button"
              className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted"
              onClick={() => {
                onPick(meal);
                setOpen(false);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{meal.name}</div>
                <Badge
                  variant={score >= 80 ? "default" : score >= 60 ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  {label}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {Math.round(meal.kcal)} kcal · {meal.protein_g}P / {meal.carbs_g}C / {meal.fat_g}F
              </div>
              {reasons.length > 0 && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {reasons.slice(0, 3).join(" · ")}
                </div>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
