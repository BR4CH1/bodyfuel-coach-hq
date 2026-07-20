import { ChefHat } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CustomMeal } from "@/lib/custom-meals.functions";

export function CustomMealsPanel({
  meals,
  loading,
  onOpenBuilder,
  onAddMeal,
}: {
  meals: CustomMeal[];
  loading: boolean;
  onOpenBuilder: () => void;
  onAddMeal: (meal: CustomMeal) => void;
}) {
  return (
    <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Deine Mahlzeiten
        </div>
        <Button size="sm" variant="ghost" onClick={onOpenBuilder} className="h-7 text-xs text-gold">
          <ChefHat className="h-3.5 w-3.5" /> Neu
        </Button>
      </div>
      {loading ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Lade…</p>
      ) : meals.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Noch keine eigenen Mahlzeiten. Tippe oben auf „Neu", um eine anzulegen.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {meals.map((meal) => (
            <li key={meal.id}>
              <button
                onClick={() => onAddMeal(meal)}
                className="w-full px-2 py-3 text-left hover:bg-secondary"
              >
                <div className="truncate text-sm font-medium">{meal.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {meal.kcal ? `${Math.round(meal.kcal)} kcal` : "—"}
                  {meal.protein_g ? ` · P ${Number(meal.protein_g).toFixed(1)}` : ""}
                  {meal.carbs_g ? ` · K ${Number(meal.carbs_g).toFixed(1)}` : ""}
                  {meal.fat_g ? ` · F ${Number(meal.fat_g).toFixed(1)}` : ""}
                  {meal.ingredients?.length ? ` · ${meal.ingredients.length} Zutaten` : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
