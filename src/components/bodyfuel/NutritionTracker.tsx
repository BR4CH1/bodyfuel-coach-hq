import { Loader2 } from "lucide-react";

import { AddFoodDialog } from "@/features/nutrition-tracker/components/AddFoodDialog";
import {
  CreateMealCard,
  DateNavigator,
  DayTypeCard,
  MealCard,
  NutritionSummary,
  WaterTrackerCard,
} from "@/features/nutrition-tracker/components/NutritionTrackerSections";
import { MEALS } from "@/features/nutrition-tracker/constants";
import { useNutritionTracker } from "@/features/nutrition-tracker/hooks/useNutritionTracker";
import { BarcodeScanner } from "./BarcodeScanner";
import { MealBuilderDialog } from "./MealBuilderDialog";
import { MealPhotoDialog } from "./MealPhotoDialog";

export function NutritionTracker({ variant = "personal" }: { variant?: "personal" | "bulls" }) {
  const tracker = useNutritionTracker(variant);
  const addFood = tracker.addFood;

  if (!tracker.userId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Bitte einloggen, um Essen zu tracken.
      </div>
    );
  }

  if (tracker.loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DateNavigator date={tracker.date} isToday={tracker.isToday} onDateChange={tracker.setDate} />

      <DayTypeCard
        isBulls={tracker.isBulls}
        dayType={tracker.dayType}
        dayTypeSource={tracker.dayTypeSource}
        baseTargets={tracker.baseNutritionTargets}
        restTargets={tracker.restNutritionTargets}
        saving={tracker.savingDayType}
        onToggle={tracker.toggleDayType}
        onReset={tracker.resetDayType}
      />

      <NutritionSummary totals={tracker.totals} targets={tracker.targets} />

      <WaterTrackerCard
        waterGlasses={tracker.waterGlasses}
        targetGlasses={tracker.targets.water_glasses}
        onChange={tracker.updateWater}
      />

      <CreateMealCard onCreate={addFood.openBuilder} />

      {MEALS.map((meal) => (
        <MealCard
          key={meal.key}
          meal={meal}
          entries={tracker.entries.filter((entry) => entry.meal === meal.key)}
          onAdd={addFood.openAddDialog}
          onRemove={tracker.removeEntry}
        />
      ))}

      {addFood.openMeal && (
        <AddFoodDialog
          openMeal={addFood.openMeal}
          picking={addFood.picking}
          source={addFood.source}
          query={addFood.query}
          searching={addFood.searching}
          results={addFood.results}
          favorites={addFood.favorites}
          recentFoods={addFood.recentFoods}
          loadingFavorites={addFood.loadingFavorites}
          loadingRecent={addFood.loadingRecent}
          customMeals={addFood.customMeals}
          loadingMeals={addFood.loadingMeals}
          isCoach={tracker.isCoach}
          unit={addFood.unit}
          amountStr={addFood.amountStr}
          onClose={addFood.closeAddDialog}
          onSourceChange={addFood.setSource}
          onQueryChange={addFood.setQuery}
          onSearch={() => addFood.runSearch()}
          onOpenScanner={addFood.openScanner}
          onOpenPhoto={addFood.openPhoto}
          onPickFood={addFood.pickFood}
          onToggleFavorite={addFood.toggleFavorite}
          isFavorite={addFood.isFavorite}
          onOpenBuilder={addFood.openBuilder}
          onAddCustomMeal={addFood.addCustomMeal}
          onAmountChange={addFood.setAmountStr}
          onBack={addFood.backToSearch}
          onAddPicked={addFood.addPicked}
        />
      )}

      {addFood.scannerOpen && (
        <BarcodeScanner onDetected={addFood.handleBarcode} onClose={addFood.closeScanner} />
      )}

      <MealBuilderDialog
        userId={tracker.userId}
        open={addFood.builderOpen}
        onClose={addFood.closeBuilder}
      />

      <MealPhotoDialog
        open={addFood.photoOpen}
        onClose={addFood.closePhoto}
        defaultSlot={(addFood.openMeal as "breakfast" | "lunch" | "dinner" | "snack") ?? "snack"}
        entryDate={tracker.date}
        onTracked={addFood.onPhotoTracked}
      />
    </div>
  );
}
