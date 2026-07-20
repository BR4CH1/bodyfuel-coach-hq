import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Heart, Search, ChevronLeft, Star, Loader2, BookOpen } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { listMyFavorites } from "@/lib/meal-feedback.functions";
import { RecipeDialog } from "@/components/bodyfuel/RecipeDialog";
import { useSession } from "@/lib/bodyfuel/session";
import { getActiveContext } from "@/components/organizations/OrganizationContextSwitcher";

export const Route = createFileRoute("/nutrition/favorites")({
  head: () => ({ meta: [{ title: "Meine Favoriten — BODYFUEL" }] }),
  component: NutritionFavoritesPage,
});

function NutritionFavoritesPage() {
  const { isCoach, hasGroup } = useSession();
  const activeOrgSlug = getActiveContext();

  if (!isCoach && hasGroup("bulls") && activeOrgSlug) {
    return <Navigate to="/$orgSlug/nutrition/favorites" params={{ orgSlug: activeOrgSlug }} replace />;
  }

  return (
    <AppLayout>
      <NutritionFavoritesContent backTo="/nutrition" />
    </AppLayout>
  );
}

type Item = {
  favorite_id: string;
  favorited_at: string;
  meal: {
    id: string;
    name: string;
    description: string | null;
    kcal: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  };
  stars: number | null;
  eaten_count: number;
};

type Sort = "recent" | "rating" | "eaten";
type Slot = "all" | "breakfast" | "lunch" | "dinner" | "snack";

const detectSlot = (name: string): Exclude<Slot, "all"> => {
  const n = name.toLowerCase();
  if (/fr(ü|u)hst(ü|u)ck|breakfast/.test(n)) return "breakfast";
  if (/mittag|lunch/.test(n)) return "lunch";
  if (/abend|dinner|sp(ä|a)t/.test(n)) return "dinner";
  return "snack";
};

const slotLabel: Record<Exclude<Slot, "all">, string> = {
  breakfast: "Frühstück",
  lunch: "Mittag",
  dinner: "Abend",
  snack: "Snack",
};

export function NutritionFavoritesContent({ backTo = "/nutrition" }: { backTo?: string }) {
  const { isCoach } = useSession();
  const fetchFn = useServerFn(listMyFavorites);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [slot, setSlot] = useState<Slot>("all");
  const [openMeal, setOpenMeal] = useState<Item["meal"] | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchFn();
      setItems(res.items as Item[]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let arr = [...items];
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter(
        (i) =>
          i.meal.name.toLowerCase().includes(q) ||
          (i.meal.description ?? "").toLowerCase().includes(q),
      );
    }
    if (slot !== "all") {
      arr = arr.filter((i) => detectSlot(i.meal.name) === slot);
    }
    if (sort === "recent") {
      arr.sort((a, b) => +new Date(b.favorited_at) - +new Date(a.favorited_at));
    } else if (sort === "rating") {
      arr.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    } else if (sort === "eaten") {
      arr.sort((a, b) => b.eaten_count - a.eaten_count);
    }
    return arr;
  }, [items, query, sort, slot]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link
            to={backTo as any}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Zurück"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Ernährung
            </div>
            <div className="flex items-center gap-2 font-display text-lg font-bold">
              <Heart className="h-4 w-4 text-rose-500" /> Meine Favoriten
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rezept suchen…"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {([
              ["all", "Alle"],
              ["breakfast", "Frühstück"],
              ["lunch", "Mittag"],
              ["dinner", "Abend"],
              ["snack", "Snacks"],
            ] as [Slot, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSlot(k)}
                className={`rounded-full px-3 py-1 transition ${
                  slot === k
                    ? "bg-gradient-gold text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground self-center mr-1">Sortieren:</span>
            {([
              ["recent", "Zuletzt gespeichert"],
              ["rating", "Höchste Bewertung"],
              ["eaten", "Meist gegessen"],
            ] as [Sort, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`rounded-md px-2 py-1 transition ${
                  sort === k
                    ? "border border-gold/50 bg-accent/40 text-gold"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Favoriten…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {items.length === 0 ? (
              <>
                Noch keine Favoriten. Öffne ein Rezept und tippe ❤️ um es hier zu speichern.
              </>
            ) : (
              <>Keine Treffer für die aktuelle Auswahl.</>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((i) => (
              <button
                key={i.favorite_id}
                onClick={() => setOpenMeal(i.meal)}
                className="text-left rounded-2xl border border-border bg-card p-4 transition hover:border-gold/50"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm font-bold">{i.meal.name}</div>
                  {i.meal.kcal != null && (
                    <div className="text-[11px] text-muted-foreground shrink-0">
                      {i.meal.kcal} kcal
                    </div>
                  )}
                </div>
                {i.meal.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {i.meal.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {i.meal.protein_g != null && <span>P {i.meal.protein_g}g</span>}
                  {i.meal.carbs_g != null && <span>· KH {i.meal.carbs_g}g</span>}
                  {i.meal.fat_g != null && <span>· F {i.meal.fat_g}g</span>}
                  <span className="ml-auto rounded-full bg-accent/40 px-2 py-0.5 text-gold">
                    {slotLabel[detectSlot(i.meal.name)]}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${
                          (i.stars ?? 0) >= n ? "fill-gold text-gold" : "text-muted-foreground/40"
                        }`}
                      />
                    ))}
                    {i.stars == null && (
                      <span className="ml-1 text-muted-foreground">noch nicht bewertet</span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <BookOpen className="h-3 w-3" /> {i.eaten_count}× gegessen
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {openMeal && (
        <RecipeDialog
          meal={openMeal}
          displayName={openMeal.name}
          isCoach={isCoach}
          onClose={() => {
            setOpenMeal(null);
            // re-fetch to reflect rating/fav changes
            load();
          }}
        />
      )}
    </>
  );
}
