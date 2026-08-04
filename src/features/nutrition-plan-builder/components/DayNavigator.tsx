import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Check, ChevronLeft, ChevronRight, Dumbbell, Moon } from "lucide-react";
import type { BuilderDay, CustomerPlanContext, LibraryMeal } from "@/lib/plan-builder.functions";
import { cn } from "@/lib/utils";
import { summarizeDay } from "../lib/plan-builder.logic";

export function DayNavigator({
  days,
  activeIndex,
  onActiveIndexChange,
  ctx,
  library,
}: {
  days: BuilderDay[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  ctx: CustomerPlanContext;
  library: LibraryMeal[];
}) {
  const activeDay = days[activeIndex];

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-2 shadow-sm">
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Tagesübersicht</div>
          <div className="text-sm font-semibold">{activeDay?.name ?? "Kein Tag ausgewählt"}</div>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={activeIndex <= 0}
            onClick={() => onActiveIndexChange(activeIndex - 1)}
            aria-label="Vorheriger Tag"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={activeIndex >= days.length - 1}
            onClick={() => onActiveIndexChange(activeIndex + 1)}
            aria-label="Nächster Tag"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-3">
          {days.map((day, index) => {
            const summary = summarizeDay(day, ctx, library);
            const selected = index === activeIndex;
            const dateLabel = day.name.split("·")[1]?.trim() ?? day.name;

            return (
              <button
                key={`${day.name}-${index}`}
                type="button"
                onClick={() => onActiveIndexChange(index)}
                className={cn(
                  "min-w-[132px] rounded-lg border px-3 py-2 text-left transition-colors",
                  selected
                    ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">Tag {index + 1}</span>
                  {summary.isBalanced ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : (
                    <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
                      {summary.filledSlots}/{summary.totalSlots}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{dateLabel}</div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  {day.type === "training" ? (
                    <Dumbbell className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Moon className="h-3 w-3 text-sky-500" />
                  )}
                  <span className="truncate">
                    {day.type === "training" ? (day.split || "Training") : "Ruhetag"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
