import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";

import {
  deleteCustomMeal,
  listCustomMeals,
  trackCustomMeal,
  type MealSlot,
} from "@/lib/custom-meals.functions";
import { generateMealImage } from "@/lib/meal-images.functions";
import { MealImageThumb } from "./MealImageThumb";

const TRACK_SLOTS: { key: Exclude<MealSlot, "any">; label: string; emoji: string }[] = [
  { key: "breakfast", label: "Frühstück", emoji: "🥐" },
  { key: "lunch", label: "Mittag", emoji: "🍱" },
  { key: "dinner", label: "Abend", emoji: "🍽️" },
  { key: "snack", label: "Snack", emoji: "🍎" },
];

export function CustomMealsCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const listMeals = useServerFn(listCustomMeals);
  const deleteMeal = useServerFn(deleteCustomMeal);
  const trackMeal = useServerFn(trackCustomMeal);
  const createImage = useServerFn(generateMealImage);

  const queryKey = ["custom-meals", userId];
  const { data: meals = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listMeals({ data: { userId } }),
    enabled: Boolean(userId),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteMeal({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error: unknown) =>
      toast.error(
        error instanceof Error ? error.message : "Mahlzeit konnte nicht gelöscht werden.",
      ),
  });

  const trackMutation = useMutation({
    mutationFn: (value: { id: string; slot: Exclude<MealSlot, "any"> }) =>
      trackMeal({ data: value }),
    onSuccess: (_result, value) => {
      const label = TRACK_SLOTS.find((slot) => slot.key === value.slot)?.label ?? "Mahlzeit";
      toast.success(`Zu ${label} hinzugefügt`);
      void queryClient.invalidateQueries({ queryKey: ["food_entries"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Tracken fehlgeschlagen."),
  });

  const imageMutation = useMutation({
    mutationFn: (id: string) =>
      createImage({ data: { target: "custom_meal", meal_id: id, force: true } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey });
      if (result.status === "generated" || result.status === "cached") {
        toast.success("Mahlzeitenfoto erstellt");
      } else if (result.status === "preserved") {
        toast.info("Das bisherige Foto bleibt erhalten.");
      } else {
        toast.info(result.message ?? "Foto konnte gerade nicht erstellt werden.");
      }
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Foto konnte nicht erstellt werden."),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Utensils className="h-5 w-5 text-gold" />
        <h2 className="font-display text-lg font-bold">Deine Mahlzeiten</h2>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Lade …</div>
      ) : meals.length === 0 ? (
        <div className="rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">
          Noch keine eigenen Mahlzeiten. Tippe oben auf{" "}
          <span className="font-semibold text-gold">„Mahlzeit erstellen“</span>, suche Zutaten aus
          der BodyFuel-Datenbank und speichere die Mahlzeit inklusive Foto.
        </div>
      ) : (
        <ul className="space-y-3">
          {meals.map((meal) => {
            const imageBusy = imageMutation.isPending && imageMutation.variables === meal.id;
            return (
              <li key={meal.id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-start gap-3">
                  <MealImageThumb
                    name={meal.name}
                    imageUrl={meal.image_url}
                    status={imageBusy ? "generating" : meal.image_status}
                    className="h-20 w-24"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{meal.name}</div>
                        <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                          {meal.ingredients
                            .map(
                              (ingredient) =>
                                `${ingredient.name}${
                                  ingredient.amount_g ? ` ${Math.round(ingredient.amount_g)}g` : ""
                                }`,
                            )
                            .join(" · ")}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {meal.kcal ?? 0} kcal · P {Math.round(meal.protein_g ?? 0)}g · KH{" "}
                          {Math.round(meal.carbs_g ?? 0)}g · F {Math.round(meal.fat_g ?? 0)}g
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`„${meal.name}“ löschen?`)) {
                            removeMutation.mutate(meal.id);
                          }
                        }}
                        className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:text-warning"
                        aria-label="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => imageMutation.mutate(meal.id)}
                      disabled={imageBusy}
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-gold disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${imageBusy ? "animate-spin" : ""}`} />
                      {meal.image_url ? "Foto neu erstellen" : "Foto erstellen"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1">
                  {TRACK_SLOTS.map((slot) => (
                    <button
                      key={slot.key}
                      type="button"
                      onClick={() => trackMutation.mutate({ id: meal.id, slot: slot.key })}
                      disabled={trackMutation.isPending}
                      className="flex flex-col items-center gap-0.5 rounded-md border border-border bg-card px-1 py-1.5 text-[10px] font-semibold hover:border-gold/60 hover:bg-gold/10 disabled:opacity-50"
                    >
                      <span className="text-sm leading-none">{slot.emoji}</span>
                      <span>{slot.label}</span>
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
