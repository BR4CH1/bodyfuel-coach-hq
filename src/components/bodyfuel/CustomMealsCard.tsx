import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import {
  listCustomMeals,
  deleteCustomMeal,
  trackCustomMeal,
  type CustomMeal,
  type MealSlot,
} from "@/lib/custom-meals.functions";

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Frühstück",
  lunch: "Mittag",
  dinner: "Abend",
  snack: "Snack",
  any: "Beliebig",
};

export function CustomMealsCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCustomMeals);
  const delFn = useServerFn(deleteCustomMeal);
  const trackFn = useServerFn(trackCustomMeal);

  const queryKey = ["custom-meals", userId];
  const { data: meals = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { userId } }),
    enabled: !!userId,
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const track = useMutation({
    mutationFn: (m: CustomMeal) =>
      trackFn({ data: { id: m.id, slot: (m.meal_slot as MealSlot) ?? "any" } }),
    onSuccess: () => toast.success("Getrackt"),
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Utensils className="h-5 w-5 text-gold" />
        <h2 className="font-display text-lg font-bold">Eigene Mahlzeiten</h2>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Lade…</div>
      ) : meals.length === 0 ? (
        <div className="rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">
          Noch keine eigenen Mahlzeiten. Tracke deine Lieblings-Kombination und tippe
          oben bei der Mahlzeit auf <span className="font-semibold text-gold">„Mahlzeit erstellen"</span> –
          dann kannst du sie hier jederzeit mit einem Klick erneut tracken.
        </div>
      ) : (
        <ul className="space-y-2">
          {meals.map((m) => (
            <li key={m.id} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-gold">
                    {SLOT_LABEL[m.meal_slot as MealSlot]}
                  </div>
                  <div className="text-sm font-bold">{m.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.ingredients.map((i) => `${i.name}${i.amount_g ? ` ${i.amount_g}g` : ""}`).join(", ")}
                  </div>
                  {(m.kcal || m.protein_g) && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {m.kcal ?? 0} kcal · P {Math.round(m.protein_g ?? 0)}g · KH {Math.round(m.carbs_g ?? 0)}g · F {Math.round(m.fat_g ?? 0)}g
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => track.mutate(m)}
                    disabled={track.isPending}
                    className="rounded-md bg-gradient-gold px-2 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                  >
                    Tracken
                  </button>
                  <button
                    onClick={() => del.mutate(m.id)}
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-warning"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
