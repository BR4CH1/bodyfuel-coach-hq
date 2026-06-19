import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ShoppingCart, Loader2, Printer, RefreshCw, ChevronDown, ChevronUp, CalendarRange } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { Button } from "@/components/ui/button";
import { generateShoppingList, getMyShoppingLists, getPlanContent } from "@/lib/shopping-list.functions";
import { formatDateRange } from "@/lib/format-date-range";

export const Route = createFileRoute("/nutrition/shopping")({
  head: () => ({ meta: [{ title: "Einkaufsliste — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <ShoppingListPage />
    </AppLayout>
  ),
});

type Item = { name: string; quantity: string; category: string };

function ShoppingListPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyShoppingLists);
  const genFn = useServerFn(generateShoppingList);
  const planFn = useServerFn(getPlanContent);

  const { data, isLoading } = useQuery({
    queryKey: ["my-shopping-lists"],
    queryFn: () => getFn(),
  });

  type Scope = "active" | "next" | "partner" | "combined" | `archive:${string}`;
  const [scope, setScope] = useState<Scope>("active");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [showPlan, setShowPlan] = useState(false);

  useEffect(() => {
    if (!data) return;
    if (!data.active && data.next) setScope("next");
    else if (data.active && !data.next) setScope("active");
  }, [data]);

  const partner = (data as any)?.partner;
  const archive = (data?.archive ?? []) as any[];

  const selected = useMemo(() => {
    if (scope === "active") return data?.active ?? null;
    if (scope === "next") return data?.next ?? null;
    if (scope === "partner") return partner?.plan ?? null;
    if (scope === "combined") return data?.active ?? data?.next ?? null;
    if (scope.startsWith("archive:")) {
      const id = scope.slice("archive:".length);
      return archive.find((p) => p.id === id) ?? null;
    }
    return null;
  }, [scope, data, partner, archive]);

  const items: Item[] =
    scope === "combined"
      ? (((data?.active as any)?.combined?.items ?? (data?.next as any)?.combined?.items ?? []) as Item[])
      : scope === "partner"
        ? ((partner?.list?.items as Item[]) ?? [])
        : (((selected as any)?.list?.items as Item[]) ?? []);

  // Plan content fetch — only for current/next/partner/archive (not combined)
  const planIdForView = scope === "combined" ? null : (selected as any)?.id ?? null;
  const { data: planContent, isFetching: planLoading } = useQuery({
    queryKey: ["plan-content", planIdForView],
    queryFn: () => planFn({ data: { plan_id: planIdForView as string } }),
    enabled: !!planIdForView && showPlan,
    staleTime: 60_000,
  });

  const gen = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          plan_id: (selected as any)?.id,
          force: true,
          scope: scope === "combined" ? "combined" : "individual",
        },
      }),
    onSuccess: () => {
      toast.success("Liste aktualisiert");
      setChecked({});
      qc.invalidateQueries({ queryKey: ["my-shopping-lists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = items.reduce<Record<string, Item[]>>((acc, it) => {
    const c = it.category || "Sonstiges";
    (acc[c] ??= []).push(it);
    return acc;
  }, {});

  const hasAny = !!(data?.active || data?.next || partner || archive.length);
  const dateRange = formatDateRange(
    (selected as any)?.scheduled_start_date,
    (selected as any)?.scheduled_end_date,
  );

  return (
    <div className="space-y-5">
      <Link
        to="/nutrition"
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Zurück
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold">Einkaufsliste</h1>
        <p className="text-sm text-muted-foreground">
          {scope === "active"
            ? "Gültig bis zum nächsten Einkaufstag."
            : scope === "next"
              ? "Vorab — gültig ab Plan-Start."
              : scope.startsWith("archive:")
                ? "Archivierte Liste — nur zur Ansicht."
                : "Gültig ab dem nächsten Einkaufstag."}
        </p>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Lade…</div>
      )}

      {!isLoading && !hasAny && (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Noch kein Plan vorhanden. Sobald dein Coach einen Plan freigibt,
          erscheint hier deine Einkaufsliste.
        </div>
      )}

      {hasAny && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[16rem]">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Zeitraum
              </label>
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value as Scope);
                  setChecked({});
                  setShowPlan(false);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="active" disabled={!data?.active}>
                  Aktuell {data?.active && formatDateRange((data.active as any).scheduled_start_date, (data.active as any).scheduled_end_date)
                    ? `(${formatDateRange((data.active as any).scheduled_start_date, (data.active as any).scheduled_end_date)})`
                    : data?.active ? "" : "(keine)"}
                </option>
                <option value="next" disabled={!data?.next}>
                  Nächste {data?.next && formatDateRange((data.next as any).scheduled_start_date, (data.next as any).scheduled_end_date)
                    ? `(${formatDateRange((data.next as any).scheduled_start_date, (data.next as any).scheduled_end_date)})`
                    : data?.next ? "" : "(keine)"}
                </option>
                {partner && (
                  <option value="partner" disabled={!partner.plan}>
                    Partner ({partner.name}){partner.plan ? "" : " (keine)"}
                  </option>
                )}
                {partner && (
                  <option
                    value="combined"
                    disabled={!(data?.active || data?.next)}
                  >
                    Gemeinsame Einkaufsliste
                  </option>
                )}
                {archive.length > 0 && (
                  <optgroup label="Archiv">
                    {archive.map((p) => {
                      const r = formatDateRange(p.scheduled_start_date, p.scheduled_end_date);
                      return (
                        <option key={p.id} value={`archive:${p.id}`}>
                          {r ?? p.title}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
            </div>

            {scope !== "combined" && !scope.startsWith("archive:") && (
              <Button
                onClick={() => gen.mutate()}
                disabled={gen.isPending || !selected}
                className="bg-gradient-gold text-primary-foreground"
              >
                {gen.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generiere…</>
                ) : items.length ? (
                  <><RefreshCw className="mr-2 h-4 w-4" /> Neu berechnen</>
                ) : (
                  <><ShoppingCart className="mr-2 h-4 w-4" /> Liste erstellen</>
                )}
              </Button>
            )}

            {items.length > 0 && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Drucken
              </Button>
            )}
          </div>

          {selected && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs">
              <CalendarRange className="h-4 w-4 text-primary" />
              <span className="font-semibold">{dateRange ?? "Kein Datum hinterlegt"}</span>
              <span className="text-muted-foreground">· {(selected as any).title}</span>
              {(selected as any).status && (
                <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  {(selected as any).status}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Plan anzeigen dropdown */}
      {selected && scope !== "combined" && (
        <div className="rounded-2xl border border-border bg-card">
          <button
            onClick={() => setShowPlan((v) => !v)}
            className="flex w-full items-center justify-between p-5 text-left"
          >
            <span className="font-display text-base font-bold">
              Plan zu dieser Liste anzeigen
            </span>
            {showPlan ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          {showPlan && (
            <div className="border-t border-border p-5 space-y-4">
              {planLoading && <p className="text-sm text-muted-foreground">Lade Plan…</p>}
              {!planLoading && planContent && (
                <PlanContentInline plan={planContent} />
              )}
            </div>
          )}
        </div>
      )}

      {hasAny && selected && !items.length && !gen.isPending && !scope.startsWith("archive:") && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
          Noch keine Liste für diesen Plan — klicke „Liste erstellen".
        </div>
      )}

      {scope.startsWith("archive:") && !items.length && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
          Für diesen archivierten Plan wurde keine Einkaufsliste gespeichert.
        </div>
      )}

      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat} className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-base font-bold">{cat}</h2>
          <ul className="space-y-2">
            {list.map((it, i) => {
              const k = `${scope}-${cat}-${i}-${it.name}`;
              return (
                <li key={k} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!checked[k]}
                    onChange={(e) => setChecked((c) => ({ ...c, [k]: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span
                    className={`flex-1 text-sm ${checked[k] ? "line-through text-muted-foreground" : ""}`}
                  >
                    {it.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{it.quantity}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PlanContentInline({ plan }: { plan: Awaited<ReturnType<ReturnType<typeof useServerFn<typeof getPlanContent>>>> }) {
  const dateRange = formatDateRange(plan.plan.scheduled_start_date, plan.plan.scheduled_end_date);
  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{plan.plan.title}</span>
        {dateRange && <> · {dateRange}</>}
      </div>
      {plan.days.length === 0 && (
        <p className="text-sm text-muted-foreground">Plan enthält noch keine Tage.</p>
      )}
      {plan.days.map((d: any) => {
        const meals = (plan.meals ?? []).filter((m: any) => m.day_id === d.id);
        return (
          <div key={d.id} className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 text-sm font-bold">{d.name}</div>
            {meals.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Mahlzeiten.</p>
            ) : (
              <ul className="space-y-1.5">
                {meals.map((m: any) => (
                  <li key={m.id} className="text-xs">
                    <span className="font-semibold">{m.name}</span>
                    {m.kcal != null && (
                      <span className="ml-2 text-muted-foreground">
                        {m.kcal} kcal · {m.protein_g ?? 0}P / {m.carbs_g ?? 0}C / {m.fat_g ?? 0}F
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
