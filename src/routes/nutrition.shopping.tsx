import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ShoppingCart, Loader2, Printer, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { Button } from "@/components/ui/button";
import { generateShoppingList, getMyShoppingLists } from "@/lib/shopping-list.functions";

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

  const { data, isLoading } = useQuery({
    queryKey: ["my-shopping-lists"],
    queryFn: () => getFn(),
  });

  type Scope = "active" | "next" | "partner" | "combined";
  const [scope, setScope] = useState<Scope>("active");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) return;
    if (!data.active && data.next) setScope("next");
    else if (data.active && !data.next) setScope("active");
  }, [data]);

  const partner = (data as any)?.partner;
  const current =
    scope === "active"
      ? data?.active
      : scope === "next"
        ? data?.next
        : scope === "partner"
          ? partner?.plan
          : data?.active ?? data?.next;
  const items: Item[] =
    scope === "combined"
      ? (((data?.active as any)?.combined?.items ?? (data?.next as any)?.combined?.items ?? []) as Item[])
      : scope === "partner"
        ? ((partner?.list?.items as Item[]) ?? [])
        : (((current as any)?.list?.items as Item[]) ?? []);

  const gen = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          plan_id: (current as any)?.id,
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

  const hasAny = !!(data?.active || data?.next || partner);


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
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Zeitraum
            </label>
            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as any);
                setChecked({});
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[16rem]"
            >
              <option value="active" disabled={!data?.active}>
                Meine Einkaufsliste{data?.active ? "" : " (keine)"}
              </option>
              <option value="next" disabled={!data?.next}>
                Nächste Einkaufsliste{data?.next ? "" : " (keine)"}
              </option>
              {partner && (
                <option value="partner" disabled={!partner.plan}>
                  Partner-Liste ({partner.name}){partner.plan ? "" : " (keine)"}
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
            </select>
            {current && (
              <p className="text-[11px] text-muted-foreground">{(current as any).title}</p>
            )}
          </div>


          <Button
            onClick={() => gen.mutate()}
            disabled={gen.isPending || !current}
            className="bg-gradient-gold text-primary-foreground"
          >
            {gen.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generiere…
              </>
            ) : items.length ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" /> Neu berechnen
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" /> Liste erstellen
              </>
            )}
          </Button>

          {items.length > 0 && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Drucken
            </Button>
          )}
        </div>
      )}

      {hasAny && current && !items.length && !gen.isPending && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
          Noch keine Liste für diesen Plan — klicke „Liste erstellen".
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
