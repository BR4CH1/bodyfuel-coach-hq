import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ShoppingBasket, Users } from "lucide-react";
import {
  getCoachMealShoppingBreakdown,
  type CoachMealShoppingPlan,
} from "@/lib/coach-meal-shopping.functions";

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function PlanChoice({
  label,
  plan,
  active,
  onClick,
}: {
  label: string;
  plan: CoachMealShoppingPlan;
  active: boolean;
  onClick: () => void;
}) {
  const start = formatDate(plan.scheduled_start_date);
  const end = formatDate(plan.scheduled_end_date);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-accent"
      }`}
    >
      <span className="block font-semibold">{label}</span>
      {(start || end) && (
        <span className={`mt-0.5 block ${active ? "opacity-80" : "text-muted-foreground"}`}>
          {start ?? "?"} – {end ?? "?"}
        </span>
      )}
    </button>
  );
}

export function CoachMealShoppingCard({ userId }: { userId: string }) {
  const getFn = useServerFn(getCoachMealShoppingBreakdown);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["coach-meal-shopping", userId],
    queryFn: () => getFn({ data: { user_id: userId } }),
    staleTime: 60_000,
  });
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const available = [data.next?.id, data.active?.id].filter(Boolean) as string[];
    if (!selectedPlanId || !available.includes(selectedPlanId)) {
      setSelectedPlanId(data.default_plan_id);
    }
  }, [data, selectedPlanId]);

  const selected =
    data?.next?.id === selectedPlanId
      ? data.next
      : data?.active?.id === selectedPlanId
        ? data.active
        : data?.next ?? data?.active ?? null;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Einkauf</p>
          <h2 className="font-display text-xl font-bold">Einkauf nach Gerichten</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Zeigt dir direkt, wofür ein Lebensmittel gebraucht wird. Wiederholt sich ein Gericht im
            Einkaufsfenster, werden seine Zutaten innerhalb dieses Gerichts summiert.
          </p>
        </div>
        <ShoppingBasket className="h-5 w-5 text-muted-foreground" />
      </div>

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Lade Einkaufsvorschau…</p>}

      {isError && (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          {error instanceof Error ? error.message : "Einkaufsvorschau konnte nicht geladen werden."}
        </div>
      )}

      {!isLoading && !isError && data && !data.active && !data.next && (
        <p className="mt-4 text-sm text-muted-foreground">Noch kein aktiver oder nächster Ernährungsplan vorhanden.</p>
      )}

      {data && (data.active || data.next) && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.next && (
              <PlanChoice
                label="Nächster Plan"
                plan={data.next}
                active={selected?.id === data.next.id}
                onClick={() => setSelectedPlanId(data.next!.id)}
              />
            )}
            {data.active && (
              <PlanChoice
                label="Aktiver Plan"
                plan={data.active}
                active={selected?.id === data.active.id}
                onClick={() => setSelectedPlanId(data.active!.id)}
              />
            )}
          </div>

          {selected && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{selected.title}</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Einkauf: Tag {selected.window_start_day}–{selected.window_end_day}
                </span>
                <span>{selected.window_days} Tag{selected.window_days === 1 ? "" : "e"}</span>
                <span>{selected.dishes.length} Gericht{selected.dishes.length === 1 ? "" : "e"}</span>
              </div>

              {selected.dishes.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Für diesen Zeitraum wurden keine Mahlzeiten gefunden.</p>
              ) : (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {selected.dishes.map((dish) => (
                    <article key={dish.key} className="rounded-xl border border-border bg-background/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold leading-tight">{dish.name}</h3>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {dish.occurrences > 1 && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {dish.occurrences}× im Zeitraum
                              </span>
                            )}
                            {dish.shared && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                                <Users className="h-3 w-3" /> Gemeinsam
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {dish.items.length ? (
                        <div className="mt-3 divide-y divide-border">
                          {dish.items.map((item) => (
                            <div key={`${dish.key}-${item.name}`} className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
                              <span>{item.name}</span>
                              <span className="shrink-0 font-semibold tabular-nums">{item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">Keine auswertbaren Zutaten hinterlegt.</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
