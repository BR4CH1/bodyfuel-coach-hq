import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Shuffle, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { suggestMealSwaps } from "@/lib/meal-swap.functions";
import { logInteraction } from "@/lib/meal-feedback.functions";

type Meal = {
  id: string;
  name: string;
  description: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

type Suggestion = {
  name: string;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  category?: string;
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const slotFromName = (name: string): "breakfast" | "lunch" | "dinner" | "snack" => {
  const n = name.toLowerCase();
  if (/fr(ü|u)hst(ü|u)ck|breakfast/.test(n)) return "breakfast";
  if (/mittag|lunch/.test(n)) return "lunch";
  if (/abend|dinner|sp(ä|a)t/.test(n)) return "dinner";
  return "snack";
};

export function MealSwapDialog({
  meal,
  displayName,
  userId,
  onClose,
  onSwapped,
}: {
  meal: Meal;
  displayName: string;
  userId: string;
  onClose: () => void;
  onSwapped?: () => void;
}) {
  const fetchSwaps = useServerFn(suggestMealSwaps);
  const logFn = useServerFn(logInteraction);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSwaps({ data: { meal_id: meal.id } });
      setSuggestions(res.suggestions);
      if (!res.suggestions.length) {
        setError("Keine passenden Alternativen mit ±5 % Makros gefunden. Versuch es nochmal.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Vorschläge konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal.id]);

  const apply = async (s: Suggestion, idx: number) => {
    setApplyingIdx(idx);
    try {
      // Replace today's tracked entry (if any) with the swap
      await supabase
        .from("food_entries")
        .delete()
        .eq("user_id", userId)
        .eq("entry_date", todayKey())
        .eq("source", `plan:${meal.id}`);

      const { error } = await supabase.from("food_entries").insert({
        user_id: userId,
        entry_date: todayKey(),
        meal: slotFromName(meal.name),
        name: `${s.name} — ${s.description}`,
        serving_g: 100,
        kcal: s.kcal,
        protein_g: s.protein_g,
        carbs_g: s.carbs_g,
        fat_g: s.fat_g,
        source: `swap:${meal.id}`,
      });
      if (error) throw error;
      await logFn({ data: { meal_id: meal.id, kind: "swapped", meta: { to: s.name } } });
      toast.success(`${s.name} getrackt`);
      onSwapped?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Tausch fehlgeschlagen");
    } finally {
      setApplyingIdx(null);
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
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Mahlzeit tauschen
            </div>
            <div className="font-display text-base font-bold leading-tight">{displayName}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Ziel: {meal.kcal} kcal · P {meal.protein_g}g · KH {meal.carbs_g}g · F {meal.fat_g}g
              <span className="ml-1 text-gold">(max ±5 %)</span>
            </div>
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
              <span>Wir suchen passende Alternativen…</span>
            </div>
          ) : error ? (
            <div className="space-y-3 py-6 text-center text-sm">
              <p className="text-destructive">{error}</p>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-xs hover:border-gold/50"
              >
                <Shuffle className="h-3.5 w-3.5" /> Erneut versuchen
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s, i) => (
                <div key={i} className="rounded-2xl border border-border bg-background/40 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-bold">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">{s.kcal} kcal</div>
                  </div>
                  {s.description && (
                    <p className="mt-1 text-sm text-foreground/90">{s.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span>P {s.protein_g}g</span>
                    <span>· KH {s.carbs_g}g</span>
                    <span>· F {s.fat_g}g</span>
                    {s.category && <span className="ml-auto text-gold">{s.category}</span>}
                  </div>
                  <button
                    onClick={() => apply(s, i)}
                    disabled={applyingIdx !== null}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-gold px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {applyingIdx === i ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Diese Mahlzeit nehmen
                  </button>
                </div>
              ))}
              <button
                onClick={load}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-xs hover:border-gold/50"
              >
                <Shuffle className="h-3.5 w-3.5" /> Andere Vorschläge
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
