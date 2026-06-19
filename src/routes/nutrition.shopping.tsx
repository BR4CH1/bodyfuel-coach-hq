import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
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

  type PeriodScope = "active" | "next" | `archive:${string}`;
  type PartnerMode = "mine" | "combined";
  const [periodScope, setPeriodScope] = useState<PeriodScope>("active");
  const [partnerMode, setPartnerMode] = useState<PartnerMode>("mine");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [showPlan, setShowPlan] = useState(false);

  const checkedStorageKey = useMemo(() => {
    const planId = periodScope === "active"
      ? (data?.active as any)?.id
      : periodScope === "next"
        ? (data?.next as any)?.id
        : periodScope.startsWith("archive:")
          ? periodScope.slice("archive:".length)
          : null;
    if (!planId) return null;
    return `bodyfuel.shopping.checked.${planId}.${partnerMode}`;
  }, [periodScope, partnerMode, data]);

  // Load persisted checked state when scope/plan/partnerMode changes
  const loadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!checkedStorageKey) {
      loadedKeyRef.current = null;
      setChecked({});
      return;
    }
    try {
      const raw = localStorage.getItem(checkedStorageKey);
      setChecked(raw ? JSON.parse(raw) : {});
    } catch {
      setChecked({});
    }
    loadedKeyRef.current = checkedStorageKey;
  }, [checkedStorageKey]);

  // Persist on change (only after load for current key has run)
  useEffect(() => {
    if (!checkedStorageKey) return;
    if (loadedKeyRef.current !== checkedStorageKey) return;
    try {
      localStorage.setItem(checkedStorageKey, JSON.stringify(checked));
    } catch {}
  }, [checked, checkedStorageKey]);

  useEffect(() => {
    if (!data) return;
    if (!data.active && data.next) setPeriodScope("next");
    else if (data.active && !data.next) setPeriodScope("active");
  }, [data]);

  const partner = (data as any)?.partner;
  const archive = (data?.archive ?? []) as any[];

  const selected = useMemo(() => {
    if (periodScope === "active") return data?.active ?? null;
    if (periodScope === "next") return data?.next ?? null;
    if (periodScope.startsWith("archive:")) {
      const id = periodScope.slice("archive:".length);
      return archive.find((p) => p.id === id) ?? null;
    }
    return null;
  }, [periodScope, data, archive]);

  const isArchive = periodScope.startsWith("archive:");
  const useCombined = !!partner && partnerMode === "combined" && !isArchive;

  const items: Item[] = useCombined
    ? (((selected as any)?.combined?.items ?? []) as Item[])
    : (((selected as any)?.list?.items as Item[]) ?? []);

  // Plan content fetch
  const planIdForView = (selected as any)?.id ?? null;
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
          scope: useCombined ? "combined" : "individual",
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
          {periodScope === "active"
            ? "Gültig bis zum nächsten Einkaufstag."
            : periodScope === "next"
              ? "Vorab — gültig ab Plan-Start."
              : isArchive
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
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          {/* Zeitraum (Datum) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Zeitraum
            </label>
            <select
              value={periodScope}
              onChange={(e) => {
                setPeriodScope(e.target.value as PeriodScope);
                setShowPlan(false);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="active" disabled={!data?.active}>
                {data?.active
                  ? `Aktuell${formatDateRange((data.active as any).scheduled_start_date, (data.active as any).scheduled_end_date) ? ` — ${formatDateRange((data.active as any).scheduled_start_date, (data.active as any).scheduled_end_date)}` : ""}`
                  : "Aktuell (keine)"}
              </option>
              <option value="next" disabled={!data?.next}>
                {data?.next
                  ? `Nächste${formatDateRange((data.next as any).scheduled_start_date, (data.next as any).scheduled_end_date) ? ` — ${formatDateRange((data.next as any).scheduled_start_date, (data.next as any).scheduled_end_date)}` : ""}`
                  : "Nächste (keine)"}
              </option>
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

          {/* Partner-Modus */}
          {partner && !isArchive && (
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Partnerprogramm
              </label>
              <div className="inline-flex w-full overflow-hidden rounded-md border border-input">
                <button
                  type="button"
                  onClick={() => { setPartnerMode("mine"); }}
                  className={`flex-1 px-3 py-2 text-sm font-semibold transition ${partnerMode === "mine" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-secondary"}`}
                >
                  Meine Liste
                </button>
                <button
                  type="button"
                  onClick={() => { setPartnerMode("combined"); }}
                  className={`flex-1 px-3 py-2 text-sm font-semibold transition border-l border-input ${partnerMode === "combined" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-secondary"}`}
                >
                  Gemeinsame Liste
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Partner: {partner.name}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {!isArchive && (
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
      {selected && (
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

      {hasAny && selected && !items.length && !gen.isPending && !isArchive && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
          Noch keine Liste für diesen Plan — klicke „Liste erstellen".
        </div>
      )}

      {isArchive && !items.length && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
          Für diesen archivierten Plan wurde keine Einkaufsliste gespeichert.
        </div>
      )}

      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat} className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-base font-bold">{cat}</h2>
          <ul className="space-y-2">
            {list.map((it, i) => {
              const k = `${periodScope}-${partnerMode}-${cat}-${i}-${it.name}`;
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

function PlanContentInline({ plan }: { plan: any }) {
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
