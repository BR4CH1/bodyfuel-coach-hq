import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ShoppingCart, Loader2, Printer } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { Button } from "@/components/ui/button";
import { generateShoppingList } from "@/lib/shopping-list.functions";

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
  const fn = useServerFn(generateShoppingList);
  const [days, setDays] = useState(7);
  const [items, setItems] = useState<Item[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const gen = useMutation({
    mutationFn: () => fn({ data: { days } }),
    onSuccess: (d) => {
      setItems(d.items as Item[]);
      setChecked({});
      if (!d.items?.length) toast.info("Keine Zutaten gefunden.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = items.reduce<Record<string, Item[]>>((acc, it) => {
    const c = it.category || "Sonstiges";
    (acc[c] ??= []).push(it);
    return acc;
  }, {});

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
          Automatisch aus deinem aktiven Ernährungsplan erstellt.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Zeitraum
          </label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value={3}>3 Tage</option>
            <option value={7}>7 Tage</option>
            <option value={14}>14 Tage</option>
          </select>
        </div>
        <Button
          onClick={() => gen.mutate()}
          disabled={gen.isPending}
          className="bg-gradient-gold text-primary-foreground"
        >
          {gen.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generiere…
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

      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat} className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-base font-bold">{cat}</h2>
          <ul className="space-y-2">
            {list.map((it, i) => {
              const k = `${cat}-${i}-${it.name}`;
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
