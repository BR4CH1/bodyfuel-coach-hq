import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, X, Sparkles } from "lucide-react";
import { generateMealRecipe } from "@/lib/nutrition-plan.functions";

type Meal = {
  id: string;
  name: string;
  description: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export function RecipeDialog({
  meal,
  displayName,
  isCoach,
  onClose,
}: {
  meal: Meal;
  displayName: string;
  isCoach: boolean;
  onClose: () => void;
}) {
  const generate = useServerFn(generateMealRecipe);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async (force = false) => {
    if (force) setRegenerating(true); else setLoading(true);
    setError(null);
    try {
      const res = await generate({ data: { meal_id: meal.id, force } });
      setIngredients(res.ingredients);
      setSteps(res.steps);
    } catch (e: any) {
      setError(e?.message ?? "Rezept konnte nicht erstellt werden");
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal.id]);

  const regenerate = async () => {
    try {
      await load(true);
      toast.success("Rezept neu erstellt");
    } catch {
      // already handled
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden border-border bg-card sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Rezept</div>
            <div className="font-display text-base font-bold leading-tight">{displayName}</div>
            {meal.description && (
              <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{meal.description}</div>
            )}
            {(meal.kcal != null || meal.protein_g != null) && (
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                {meal.kcal != null && <span>{meal.kcal} kcal</span>}
                {meal.protein_g != null && <span>· P {meal.protein_g}g</span>}
                {meal.carbs_g != null && <span>· KH {meal.carbs_g}g</span>}
                {meal.fat_g != null && <span>· F {meal.fat_g}g</span>}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-secondary"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
              <span>Rezept wird erstellt…</span>
              <span className="text-[11px]">Das dauert nur beim ersten Mal.</span>
            </div>
          ) : error ? (
            <div className="space-y-3 py-6 text-center text-sm">
              <p className="text-destructive">{error}</p>
              <button
                onClick={() => load(false)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-xs hover:border-gold/50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Erneut versuchen
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <div className="text-xs font-bold uppercase tracking-wider text-gold">Zutaten</div>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {ingredients.map((it, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold/70" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {steps.length > 0 && (
                <section>
                  <div className="text-xs font-bold uppercase tracking-wider text-gold">Zubereitung</div>
                  <ol className="mt-2 space-y-2 text-sm">
                    {steps.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-gold">
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{s}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <p className="text-[11px] text-muted-foreground">
                Vorschlag von der KI — Mengen können je nach Produkt leicht abweichen.
              </p>
            </div>
          )}
        </div>

        {isCoach && !loading && (
          <div className="shrink-0 border-t border-border px-4 py-3">
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-accent/30 px-3 py-2 text-xs font-semibold text-gold hover:bg-accent/50 disabled:opacity-60"
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Neu generieren
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
