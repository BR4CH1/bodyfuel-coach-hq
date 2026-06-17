import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Utensils, Loader2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  listCustomMeals,
  saveCustomMeal,
  deleteCustomMeal,
  trackCustomMeal,
  type CustomMeal,
  type CustomMealIngredient,
  type MealSlot,
} from "@/lib/custom-meals.functions";

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Frühstück",
  lunch: "Mittag",
  dinner: "Abend",
  snack: "Snack",
  any: "Beliebig",
};

const emptyIngredient = (): CustomMealIngredient => ({
  name: "",
  amount_g: null,
  kcal: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
});

export function CustomMealsCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCustomMeals);
  const saveFn = useServerFn(saveCustomMeal);
  const delFn = useServerFn(deleteCustomMeal);
  const trackFn = useServerFn(trackCustomMeal);

  const queryKey = ["custom-meals", userId];
  const { data: meals = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { userId } }),
    enabled: !!userId,
  });

  const [editing, setEditing] = useState<Partial<CustomMeal> | null>(null);
  const [ings, setIngs] = useState<CustomMealIngredient[]>([emptyIngredient()]);

  const startNew = () => {
    setEditing({ name: "", meal_slot: "any", notes: "" });
    setIngs([emptyIngredient()]);
  };
  const startEdit = (m: CustomMeal) => {
    setEditing(m);
    setIngs(m.ingredients.length ? m.ingredients : [emptyIngredient()]);
  };

  const save = useMutation({
    mutationFn: () => {
      const valid = ings.filter((i) => i.name.trim().length > 0);
      if (!editing?.name?.trim()) throw new Error("Name fehlt");
      if (!valid.length) throw new Error("Mindestens eine Zutat");
      return saveFn({
        data: {
          id: editing.id,
          name: editing.name!.trim(),
          meal_slot: (editing.meal_slot as MealSlot) ?? "any",
          ingredients: valid,
          notes: editing.notes ?? undefined,
        },
      });
    },
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey });
      toast.success("Mahlzeit gespeichert");
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Utensils className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-bold">Eigene Mahlzeiten</h2>
        </div>
        {!editing && (
          <button
            onClick={startNew}
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-gold px-3 py-1.5 text-xs font-bold text-primary-foreground"
          >
            <Plus className="h-3 w-3" /> Neu
          </button>
        )}
      </div>

      {editing && (
        <div className="mb-4 space-y-3 rounded-xl border border-gold/30 bg-background/40 p-3">
          <input
            type="text"
            value={editing.name ?? ""}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder="Name (z. B. Skyr mit Banane & Haferflocken)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={(editing.meal_slot as string) ?? "any"}
              onChange={(e) => setEditing({ ...editing, meal_slot: e.target.value as MealSlot })}
              className="rounded-md border border-border bg-background px-2 py-2 text-sm"
            >
              {(["any", "breakfast", "lunch", "dinner", "snack"] as MealSlot[]).map((s) => (
                <option key={s} value={s}>{SLOT_LABEL[s]}</option>
              ))}
            </select>
            <input
              type="text"
              value={editing.notes ?? ""}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              placeholder="Notiz (optional)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Zutaten</div>
            {ings.map((ing, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1.5">
                <input
                  type="text"
                  placeholder="Zutat"
                  value={ing.name}
                  onChange={(e) => {
                    const n = [...ings]; n[idx] = { ...ing, name: e.target.value }; setIngs(n);
                  }}
                  className="col-span-4 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
                <input
                  type="number" placeholder="g"
                  value={ing.amount_g ?? ""}
                  onChange={(e) => { const n=[...ings]; n[idx]={...ing,amount_g:e.target.value?+e.target.value:null}; setIngs(n); }}
                  className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
                <input
                  type="number" placeholder="kcal"
                  value={ing.kcal ?? ""}
                  onChange={(e) => { const n=[...ings]; n[idx]={...ing,kcal:e.target.value?+e.target.value:null}; setIngs(n); }}
                  className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
                <input
                  type="number" placeholder="P"
                  value={ing.protein_g ?? ""}
                  onChange={(e) => { const n=[...ings]; n[idx]={...ing,protein_g:e.target.value?+e.target.value:null}; setIngs(n); }}
                  className="col-span-1 rounded-md border border-border bg-background px-1 py-1.5 text-xs"
                />
                <input
                  type="number" placeholder="KH"
                  value={ing.carbs_g ?? ""}
                  onChange={(e) => { const n=[...ings]; n[idx]={...ing,carbs_g:e.target.value?+e.target.value:null}; setIngs(n); }}
                  className="col-span-1 rounded-md border border-border bg-background px-1 py-1.5 text-xs"
                />
                <input
                  type="number" placeholder="F"
                  value={ing.fat_g ?? ""}
                  onChange={(e) => { const n=[...ings]; n[idx]={...ing,fat_g:e.target.value?+e.target.value:null}; setIngs(n); }}
                  className="col-span-1 rounded-md border border-border bg-background px-1 py-1.5 text-xs"
                />
                <button
                  onClick={() => setIngs(ings.filter((_, i) => i !== idx))}
                  className="col-span-1 rounded-md border border-border text-muted-foreground hover:text-warning"
                  title="Entfernen"
                >
                  <X className="mx-auto h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setIngs([...ings, emptyIngredient()])}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground hover:border-gold/50 hover:text-gold"
            >
              <Plus className="h-3 w-3" /> Zutat
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(null)}
              className="rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Abbrechen
            </button>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="inline-flex items-center gap-1 rounded-md bg-gradient-gold px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Speichern
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Lade…</div>
      ) : meals.length === 0 ? (
        <div className="rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">
          Noch keine eigenen Mahlzeiten. Speichere deine Lieblings-Kombinationen, um sie jederzeit zu tracken.
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
                    onClick={() => startEdit(m)}
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-gold"
                  >
                    <Pencil className="h-3 w-3" />
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
