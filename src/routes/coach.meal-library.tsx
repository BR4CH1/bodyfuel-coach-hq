import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronDown, Search, Utensils } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listMealLibrary, type LibraryMeal } from "@/lib/plan-builder.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/coach/meal-library")({
  head: () => ({
    meta: [
      { title: "Rezeptbibliothek — BODYFUEL" },
      { name: "description", content: "Alle BodyFuel-Rezepte nach Sammlung filtern." },
      { property: "og:title", content: "Rezeptbibliothek — BODYFUEL" },
      { property: "og:description", content: "Alle BodyFuel-Rezepte nach Sammlung filtern." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MealLibraryPage,
});

const hasTag = (m: LibraryMeal, ...tags: string[]) =>
  (m.tags ?? []).some((t) => tags.includes(t.trim().toLowerCase()));

const FILTERS: { key: string; label: string; test: (m: LibraryMeal) => boolean }[] = [
  { key: "all", label: "Alle", test: () => true },
  { key: "breakfast", label: "Frühstück", test: (m) => m.category === "breakfast" },
  { key: "lunch", label: "Mittag", test: (m) => m.category === "lunch" },
  { key: "dinner", label: "Abend", test: (m) => m.category === "dinner" },
  { key: "snack", label: "Snacks", test: (m) => m.category === "snack" },
  { key: "hp", label: "High Protein", test: (m) => hasTag(m, "high_protein", "high-protein") },
  { key: "veg", label: "Vegetarisch", test: (m) => hasTag(m, "vegetarisch", "vegetarian", "vegan") },
  { key: "vegan", label: "Vegan", test: (m) => hasTag(m, "vegan") },
  { key: "soul", label: "Soulfood", test: (m) => hasTag(m, "soulfood", "comfort-food", "comfort_food") },
];

const SLOT: Record<string, string> = {
  breakfast: "Frühstück",
  lunch: "Mittag",
  dinner: "Abend",
  snack: "Snack",
};

function MealLibraryPage() {
  const list = useServerFn(listMealLibrary);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["meal-library"],
    queryFn: () => list(),
  });
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    const q = query.trim().toLowerCase();
    return data.filter(
      (m) =>
        f.test(m) &&
        (!q ||
          m.name.toLowerCase().includes(q) ||
          (m.ingredients ?? []).some((i: any) => String(i?.name ?? "").toLowerCase().includes(q))),
    );
  }, [data, filter, query]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div>
          <h1 className="text-xl font-bold">Rezeptbibliothek</h1>
          <p className="text-sm text-muted-foreground">
            {data.length} Rezepte · Nährwerte pro Portion
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nach Rezept oder Zutat suchen …"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              type="button"
              size="sm"
              variant={filter === f.key ? "secondary" : "outline"}
              className="h-9"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="ml-1 text-xs text-muted-foreground">
                {data.filter(f.test).length}
              </span>
            </Button>
          ))}
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Lädt …</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

        <div className="space-y-2">
          {visible.map((m) => {
            const isOpen = open === m.id;
            return (
              <div key={m.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left"
                  onClick={() => setOpen(isOpen ? null : m.id)}
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {m.image_url ? (
                      <img src={m.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Utensils className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{m.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {SLOT[m.category] ?? m.category} · {Math.round(m.kcal)} kcal ·{" "}
                      {Math.round(m.protein_g)} P · {Math.round(m.carbs_g)} KH · {Math.round(m.fat_g)} F
                    </div>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="space-y-3 border-t border-border p-3 text-sm">
                    <div className="grid grid-cols-4 gap-1 text-center text-xs">
                      {[
                        [Math.round(m.kcal), "kcal"],
                        [Math.round(m.protein_g), "Protein"],
                        [Math.round(m.carbs_g), "KH"],
                        [Math.round(m.fat_g), "Fett"],
                      ].map(([v, l]) => (
                        <div key={l} className="rounded-md bg-secondary/40 py-1.5">
                          <div className="font-bold">{v}</div>
                          <div className="text-muted-foreground">{l}</div>
                        </div>
                      ))}
                    </div>
                    {m.portion_label && (
                      <div className="text-xs text-muted-foreground">Portion: {m.portion_label}</div>
                    )}
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Zutaten
                      </div>
                      <ul className="space-y-0.5">
                        {(m.ingredients ?? []).map((i: any, idx: number) => (
                          <li key={idx} className="flex justify-between gap-2">
                            <span>{i.name}</span>
                            <span className="shrink-0 text-muted-foreground">
                              {Math.round(Number(i.amount_g ?? i.grams ?? 0))} {i.unit === "ml" ? "ml" : "g"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {m.instructions && (
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Zubereitung
                        </div>
                        <p className="whitespace-pre-line text-muted-foreground">{m.instructions}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
