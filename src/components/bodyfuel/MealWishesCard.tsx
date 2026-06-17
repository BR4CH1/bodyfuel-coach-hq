import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Trash2, Check, X, Plus, Clock, Loader2, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import {
  addMealWish,
  deleteMealWish,
  listMealWishes,
  reviewMealWish,
  updateMealWishAssignment,
  type MealWish,
} from "@/lib/meal-wishes.functions";

type Props = {
  userId: string;
  mode: "client" | "coach";
};

const STATUS_LABEL: Record<MealWish["status"], string> = {
  pending: "Wartet auf Coach-Freigabe",
  approved: "Vom Coach freigegeben",
  rejected: "Vom Coach abgelehnt",
};

export function MealWishesCard({ userId, mode }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMealWishes);
  const addFn = useServerFn(addMealWish);
  const delFn = useServerFn(deleteMealWish);
  const reviewFn = useServerFn(reviewMealWish);
  const assignFn = useServerFn(updateMealWishAssignment);

  const queryKey = ["meal-wishes", userId];
  const { data: wishes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { userId } }),
    enabled: !!userId,
  });

  // Lookup display names for all wish authors (kann eigene + Partner sein)
  const authorIds = Array.from(new Set(wishes.map((w) => w.user_id)));
  const { data: authors = {} } = useQuery({
    queryKey: ["meal-wishes-authors", authorIds.sort().join(",")],
    queryFn: async () => {
      if (authorIds.length === 0) return {} as Record<string, string>;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", authorIds);
      const m: Record<string, string> = {};
      for (const p of data ?? []) m[p.id] = p.display_name ?? "Unbenannt";
      return m;
    },
    enabled: authorIds.length > 0,
  });


  const [text, setText] = useState("");
  const [slot, setSlot] = useState<"breakfast" | "lunch" | "dinner" | "snack" | "any">("any");
  const [forPerson, setForPerson] = useState("");
  const SLOT_LABEL = {
    any: "Egal",
    breakfast: "Frühstück",
    lunch: "Mittag",
    dinner: "Abend",
    snack: "Snack",
  } as const;
  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          wish: text.trim(),
          meal_slot: slot,
          for_person: forPerson.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setText("");
      setForPerson("");
      qc.invalidateQueries({ queryKey });
      toast.success("Wunsch gespeichert");
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const review = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" }) =>
      reviewFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Bewertung gespeichert");
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-gold" />
        <h2 className="font-display text-lg font-bold">Wunschgerichte für nächsten Plan</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {mode === "client"
          ? "Trag hier Gerichte ein, ordne sie einer Mahlzeit zu (Frühstück/Mittag/Abend/Snack) und – bei Partner-Plänen – wem sie gehören."
          : "Wünsche dieses Kunden — gib frei, was der Smart Plan im nächsten Lauf berücksichtigen darf."}
      </p>

      {mode === "client" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length === 0) return;
            add.mutate();
          }}
          className="mb-4 space-y-2"
        >
          <input
            type="text"
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            placeholder="z. B. Hähnchen-Reis-Bowl mit Süßkartoffel"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as any)}
              className="min-w-[7rem] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {(Object.keys(SLOT_LABEL) as Array<keyof typeof SLOT_LABEL>).map((k) => (
                <option key={k} value={k}>{SLOT_LABEL[k]}</option>
              ))}
            </select>
            <input
              type="text"
              value={forPerson}
              maxLength={60}
              onChange={(e) => setForPerson(e.target.value)}
              placeholder="Für wen? (optional)"
              className="min-w-[7rem] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={add.isPending || text.trim().length === 0}
              className="flex items-center gap-1 rounded-xl bg-gradient-gold px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Hinzufügen
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">Lade…</div>
      ) : wishes.length === 0 ? (
        <div className="rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">
          {mode === "client"
            ? "Noch keine Wünsche. Was hättest du gerne im nächsten Plan?"
            : "Aktuell keine offenen Wünsche."}
        </div>
      ) : (
        <ul className="space-y-2">
          {wishes.map((w) => (
            <li
              key={w.id}
              className={`rounded-xl border bg-background/40 p-3 ${
                w.status === "approved"
                  ? "border-emerald-500/40"
                  : w.status === "rejected"
                    ? "border-rose-500/40"
                    : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    {w.meal_slot && w.meal_slot !== "any" && (
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                        {SLOT_LABEL[w.meal_slot as keyof typeof SLOT_LABEL]}
                      </span>
                    )}
                    {w.for_person && (
                      <span className="rounded-full bg-accent/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        Für: {w.for_person}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold">{w.wish}</div>
                  <div
                    className={`mt-1 flex items-center gap-1 text-[11px] ${
                      w.status === "approved"
                        ? "text-emerald-500"
                        : w.status === "rejected"
                          ? "text-rose-500"
                          : "text-muted-foreground"
                    }`}
                  >
                    {w.status === "pending" ? (
                      <Clock className="h-3 w-3" />
                    ) : w.status === "approved" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    {STATUS_LABEL[w.status]}
                  </div>
                  {w.coach_note && (
                    <div className="mt-1 text-[11px] italic text-muted-foreground">
                      Notiz: {w.coach_note}
                    </div>
                  )}
                </div>

                {mode === "coach" ? (
                  <div className="flex shrink-0 gap-1">
                    {w.status !== "approved" && (
                      <button
                        onClick={() => review.mutate({ id: w.id, status: "approved" })}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-1.5 text-emerald-500 hover:bg-emerald-500/20"
                        title="Freigeben"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    {w.status !== "rejected" && (
                      <button
                        onClick={() => review.mutate({ id: w.id, status: "rejected" })}
                        className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-1.5 text-rose-500 hover:bg-rose-500/20"
                        title="Ablehnen"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => del.mutate(w.id)}
                      className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-warning"
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  w.status === "pending" && (
                    <button
                      onClick={() => del.mutate(w.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-warning"
                      title="Entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
