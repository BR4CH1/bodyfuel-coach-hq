import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Heart, Repeat, Utensils } from "lucide-react";
import { getCustomerRecipeInsights } from "@/lib/recipe-insights.functions";

export function RecipeInsightsCard({ userId }: { userId: string }) {
  const fn = useServerFn(getCustomerRecipeInsights);
  const { data, isLoading } = useQuery({
    queryKey: ["recipe-insights", userId],
    queryFn: () => fn({ data: { user_id: userId } }),
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Rezept-Insights</h2>
        <p className="mt-3 text-sm text-muted-foreground">Lade…</p>
      </div>
    );
  }
  if (!data) return null;

  const stars = (n: number) =>
    Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${i < n ? "fill-gold text-gold" : "text-muted-foreground/30"}`}
      />
    ));

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Rezept-Insights</h2>
        <div className="text-xs text-muted-foreground">
          {data.ratings_count} Bewertungen · Ø{" "}
          <span className="font-bold text-gold">{data.avg_stars || "–"}</span>
        </div>
      </div>

      <Section icon={<Star className="h-4 w-4 text-gold" />} title="Top 5 Lieblingsrezepte">
        {data.top5.length === 0 ? (
          <Empty text="Noch keine Bewertungen." />
        ) : (
          <ul className="space-y-2">
            {data.top5.map((r) => (
              <li key={r.meal_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{r.name}</span>
                <span className="flex gap-0.5">{stars(r.stars)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Star className="h-4 w-4 text-destructive" />} title="Bottom 5">
        {data.bottom5.length === 0 ? (
          <Empty text="Keine Daten." />
        ) : (
          <ul className="space-y-2">
            {data.bottom5.map((r) => (
              <li key={r.meal_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{r.name}</span>
                <span className="flex gap-0.5">{stars(r.stars)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Heart className="h-4 w-4 text-rose-500" />} title="Favoriten">
        {data.favorites.length === 0 ? (
          <Empty text="Keine Favoriten." />
        ) : (
          <ul className="space-y-1 text-sm">
            {data.favorites.slice(0, 8).map((f) => (
              <li key={f.meal_id} className="truncate">{f.name}</li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section icon={<Utensils className="h-4 w-4 text-gold" />} title="Meist gegessen">
          {data.most_eaten.length === 0 ? (
            <Empty text="Noch keine Tracking-Daten." />
          ) : (
            <ul className="space-y-1 text-sm">
              {data.most_eaten.map((m) => (
                <li key={m.meal_id} className="flex justify-between gap-2">
                  <span className="truncate">{m.name}</span>
                  <span className="text-muted-foreground">{m.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section icon={<Repeat className="h-4 w-4 text-warning" />} title="Meist getauscht">
          {data.most_swapped.length === 0 ? (
            <Empty text="Noch nichts getauscht." />
          ) : (
            <ul className="space-y-1 text-sm">
              {data.most_swapped.map((m) => (
                <li key={m.meal_id} className="flex justify-between gap-2">
                  <span className="truncate">{m.name}</span>
                  <span className="text-muted-foreground">{m.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}
