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

const TRACK_SLOTS: { key: Exclude<MealSlot, "any">; label: string; emoji: string }[] = [
  { key: "breakfast", label: "Frühstück", emoji: "🥐" },
  { key: "lunch", label: "Mittag", emoji: "🍱" },
  { key: "dinner", label: "Abend", emoji: "🍽️" },
  { key: "snack", label: "Snack", emoji: "🍎" },
];

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
    mutationFn: (v: { id: string; slot: Exclude<MealSlot, "any"> }) =>
      trackFn({ data: { id: v.id, slot: v.slot } }),
    onSuccess: (_d, v) => {
      const lbl = TRACK_SLOTS.find((s) => s.key === v.slot)?.label ?? "Mahlzeit";
      toast.success(`Zu ${lbl} hinzugefügt`);
      qc.invalidateQueries({ queryKey: ["food_entries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Utensils className="h-5 w-5 text-gold" />
        <h2 className="font-display text-lg font-bold">Deine Mahlzeiten</h2>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Lade…</div>
      ) : meals.length === 0 ? (
        <div className="rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">
          Noch keine eigenen Mahlzeiten. Tippe oben auf <span className="font-semibold text-gold">„Mahlzeit erstellen"</span>,
          such die Zutaten zusammen und speichere sie hier ab. Danach kannst du sie mit einem Klick
          zu Frühstück, Mittag, Abend oder Snack tracken.
        </div>
      ) : (
        <ul className="space-y-3">
          {meals.map((m) => (
            <li key={m.id} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{m.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.ingredients.map((i) => `${i.name}${i.amount_g ? ` ${Math.round(i.amount_g)}g` : ""}`).join(" · ")}
                  </div>
                  {(m.kcal || m.protein_g) && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {m.kcal ?? 0} kcal · P {Math.round(m.protein_g ?? 0)}g · KH {Math.round(m.carbs_g ?? 0)}g · F {Math.round(m.fat_g ?? 0)}g
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm(`„${m.name}" löschen?`)) del.mutate(m.id);
                  }}
                  className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:text-warning"
                  aria-label="Löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {TRACK_SLOTS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => track.mutate({ id: m.id, slot: s.key })}
                    disabled={track.isPending}
                    className="flex flex-col items-center gap-0.5 rounded-md border border-border bg-card px-1 py-1.5 text-[10px] font-semibold hover:border-gold/60 hover:bg-gold/10 disabled:opacity-50"
                  >
                    <span className="text-sm leading-none">{s.emoji}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
