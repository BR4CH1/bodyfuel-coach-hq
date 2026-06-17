import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Trash2, Check, X, Plus, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  addMealWish,
  deleteMealWish,
  listMealWishes,
  reviewMealWish,
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

  const queryKey = ["meal-wishes", userId];
  const { data: wishes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { userId } }),
    enabled: !!userId,
  });

  const [text, setText] = useState("");
  const add = useMutation({
    mutationFn: () => addFn({ data: { wish: text.trim() } }),
    onSuccess: () => {
      setText("");
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
          ? "Trag hier Gerichte ein, die dein Coach prüfen und der Smart Plan dann automatisch verwenden kann. Nach jedem neuen Plan wird die Liste zurückgesetzt."
          : "Wünsche dieses Kunden — gib frei, was der Smart Plan im nächsten Lauf berücksichtigen darf."}
      </p>

      {mode === "client" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length === 0) return;
            add.mutate();
          }}
          className="mb-4 flex gap-2"
        >
          <input
            type="text"
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            placeholder="z. B. Hähnchen-Reis-Bowl mit Süßkartoffel"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <button
            type="submit"
            disabled={add.isPending || text.trim().length === 0}
            className="flex items-center gap-1 rounded-xl bg-gradient-gold px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Hinzufügen
          </button>
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
