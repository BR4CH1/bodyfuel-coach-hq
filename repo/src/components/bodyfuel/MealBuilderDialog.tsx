import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, X, ChefHat, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchFoods, searchFoodsDb, estimateFoodFromText, type FoodResult } from "@/lib/nutrition.functions";
import { saveCustomMeal } from "@/lib/custom-meals.functions";
import { LOCAL_FOODS } from "@/lib/bodyfuel/localFoods";


type Ingredient = {
  name: string;
  amount_g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

function normalizeFoodSearchTerm(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactFoodSearchTerm(value: string) {
  return normalizeFoodSearchTerm(value).replace(/\s+/g, "");
}

function localFoodMatches(value: string, term: string) {
  const haystack = normalizeFoodSearchTerm(value);
  const compactHaystack = compactFoodSearchTerm(value);
  const needle = normalizeFoodSearchTerm(term);
  const compactNeedle = compactFoodSearchTerm(term);
  const tokens = needle.split(/\s+/).filter(Boolean);
  return (
    haystack.includes(needle) ||
    compactHaystack.includes(compactNeedle) ||
    tokens.every((token) => haystack.includes(token) || compactHaystack.includes(token))
  );
}

export function MealBuilderDialog({
  userId,
  open,
  onClose,
}: {
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const searchFn = useServerFn(searchFoods);
  const searchDbFn = useServerFn(searchFoodsDb);
  const estimateFn = useServerFn(estimateFoodFromText);
  const saveFn = useServerFn(saveCustomMeal);


  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState<FoodResult | null>(null);
  const [unit, setUnit] = useState<"g" | "piece">("g");
  const [amountStr, setAmountStr] = useState("100");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);

  const estimateWithAi = async () => {
    const term = query.trim();
    if (!term) return;
    setEstimating(true);
    try {
      const r = await estimateFn({ data: { query: term } });
      setResults([r]);
      setPicking(r);
      setUnit(r.serving_g ? "piece" : "g");
      setAmountStr(r.serving_g ? "1" : "100");
      toast.success("Schätzung erstellt – Werte prüfen & übernehmen.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEstimating(false);
    }
  };


  // Reset when opened
  useEffect(() => {
    if (open) {
      setName("");
      setQuery("");
      setResults([]);
      setPicking(null);
      setIngredients([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open || picking) return;
    const term = query.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const local = LOCAL_FOODS.filter(
        (f) => localFoodMatches(f.name, term) || (f.aliases ?? []).some((a) => localFoodMatches(a, term)),
      ).map(({ aliases: _aliases, ...r }) => r);
      if (local.length > 0) setResults(local);
      setSearching(true);
      try {
        const [dbResults, remote] = await Promise.all([
          searchDbFn({ data: { query: term, limit: 15 } }).catch(() => [] as FoodResult[]),
          searchFn({ data: { query: term } }).catch(() => [] as FoodResult[]),
        ]);
        const seen = new Set<string>();
        const merged: FoodResult[] = [];
        for (const r of [...dbResults, ...local, ...remote]) {
          const key = `${r.barcode || compactFoodSearchTerm(r.name)}|${(r.brand ?? "").toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(r);
        }
        setResults(merged);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, open, picking, searchFn, searchDbFn]);

  if (!open) return null;

  const totals = ingredients.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      protein_g: acc.protein_g + i.protein_g,
      carbs_g: acc.carbs_g + i.carbs_g,
      fat_g: acc.fat_g + i.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  const addPicked = () => {
    if (!picking) return;
    const amt = parseFloat(amountStr.replace(",", "."));
    if (!isFinite(amt) || amt <= 0) {
      toast.error("Bitte gültige Menge eingeben");
      return;
    }
    const grams = unit === "piece" && picking.serving_g ? amt * picking.serving_g : amt;
    const f = grams / 100;
    setIngredients((xs) => [
      ...xs,
      {
        name: picking.name,
        amount_g: +grams.toFixed(1),
        kcal: Math.round(picking.kcal_per_100g * f),
        protein_g: +(picking.protein_per_100g * f).toFixed(1),
        carbs_g: +(picking.carbs_per_100g * f).toFixed(1),
        fat_g: +(picking.fat_per_100g * f).toFixed(1),
      },
    ]);
    setPicking(null);
    setQuery("");
    setResults([]);
    setAmountStr("100");
    setUnit("g");
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Bitte einen Namen für die Mahlzeit eingeben");
      return;
    }
    if (ingredients.length === 0) {
      toast.error("Mindestens eine Zutat hinzufügen");
      return;
    }
    setSaving(true);
    try {
      await saveFn({
        data: {
          name: trimmed,
          meal_slot: "any",
          ingredients: ingredients.map((i) => ({
            name: i.name,
            amount_g: i.amount_g,
            kcal: i.kcal,
            protein_g: i.protein_g,
            carbs_g: i.carbs_g,
            fat_g: i.fat_g,
          })),
        },
      });
      toast.success(`„${trimmed}" gespeichert — jetzt unter „Deine Mahlzeiten"`);
      qc.invalidateQueries({ queryKey: ["custom-meals", userId] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden border-border bg-card sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:border">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-gold" />
            <div className="text-sm font-semibold">Mahlzeit erstellen</div>
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Name + totals */}
        <div className="shrink-0 border-b border-border bg-background/30 px-4 py-3">
          <Input
            placeholder="Name (z.B. Bowl mit Skyr & Beeren)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-2"
          />
          <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
            <div className="rounded-md bg-secondary/40 py-1.5">
              <div className="font-bold">{Math.round(totals.kcal)}</div>
              <div className="text-muted-foreground">kcal</div>
            </div>
            <div className="rounded-md bg-secondary/40 py-1.5">
              <div className="font-bold">{totals.protein_g.toFixed(1)}</div>
              <div className="text-muted-foreground">Protein</div>
            </div>
            <div className="rounded-md bg-secondary/40 py-1.5">
              <div className="font-bold">{totals.carbs_g.toFixed(1)}</div>
              <div className="text-muted-foreground">Carbs</div>
            </div>
            <div className="rounded-md bg-secondary/40 py-1.5">
              <div className="font-bold">{totals.fat_g.toFixed(1)}</div>
              <div className="text-muted-foreground">Fett</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* Current ingredients */}
          {ingredients.length > 0 && (
            <div className="mb-4">
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Zutaten ({ingredients.length})
              </div>
              <ul className="divide-y divide-border rounded-xl border border-border bg-background/30">
                {ingredients.map((i, idx) => (
                  <li key={idx} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{i.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {Math.round(i.amount_g)} g · {i.kcal} kcal · P {i.protein_g.toFixed(1)} · K {i.carbs_g.toFixed(1)} · F {i.fat_g.toFixed(1)}
                      </div>
                    </div>
                    <button
                      onClick={() => setIngredients((xs) => xs.filter((_, k) => k !== idx))}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-warning"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Search / Picker */}
          {!picking ? (
            <>
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Zutat hinzufügen
              </div>
              <Input
                placeholder="z.B. Ei, Skyr, Haferflocken…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="mt-3">
                {query.trim() === "" ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Tippe los — wähle Zutaten und Menge wie beim normalen Tracking.
                  </p>
                ) : results.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-center text-xs text-muted-foreground">
                    {searching ? (
                      <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Suche…</span>
                    ) : (
                      <>
                        <span>Keine Treffer in der Datenbank.</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={estimateWithAi}
                          disabled={estimating}
                        >
                          {estimating ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Schätzt…</>
                          ) : (
                            <><Sparkles className="h-3 w-3" /> Nährwerte mit KI schätzen</>
                          )}
                        </Button>
                      </>
                    )}
                  </div>

                ) : (
                  <ul className="divide-y divide-border">
                    {results.map((r, i) => (
                      <li key={i}>
                        <button
                          onClick={() => {
                            setPicking(r);
                            setUnit(r.serving_g ? "piece" : "g");
                            setAmountStr(r.serving_g ? "1" : "100");
                          }}
                          className="w-full px-2 py-3 text-left hover:bg-secondary"
                        >
                          <div className="truncate text-sm font-medium">{r.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.brand ? `${r.brand} · ` : ""}
                            {Math.round(r.kcal_per_100g)} kcal · P {r.protein_per_100g.toFixed(1)} · K {r.carbs_per_100g.toFixed(1)} · F {r.fat_per_100g.toFixed(1)} (/100g)
                            {r.serving_g ? ` · 1 Stück ≈ ${r.serving_g} g` : ""}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!searching && query.trim() !== "" && results.length > 0 && (
                  <div className="mt-2 flex justify-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={estimateWithAi}
                      disabled={estimating}
                      className="text-xs text-muted-foreground"
                    >
                      {estimating ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Schätzt…</>
                      ) : (
                        <><Sparkles className="h-3 w-3" /> Nichts passt? KI-Schätzung</>
                      )}
                    </Button>
                  </div>
                )}

              </div>
            </>
          ) : (
            (() => {
              const amt = parseFloat(amountStr.replace(",", ".")) || 0;
              const grams = unit === "piece" && picking.serving_g ? amt * picking.serving_g : amt;
              const f = grams / 100;
              return (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold">{picking.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {picking.brand ?? "—"}
                      {picking.serving_g ? ` · 1 Stück ≈ ${picking.serving_g} g` : ""}
                    </div>
                  </div>
                  {picking.serving_g && (
                    <div className="inline-flex rounded-md border border-border bg-background/40 p-0.5 text-xs">
                      <button
                        onClick={() => {
                          setUnit("g");
                          setAmountStr((s) => {
                            const a = parseFloat(s.replace(",", ".")) || 0;
                            return String(Math.round(a * (picking.serving_g ?? 1)));
                          });
                        }}
                        className={`rounded px-3 py-1 ${unit === "g" ? "bg-gold text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        Gramm
                      </button>
                      <button
                        onClick={() => {
                          setUnit("piece");
                          setAmountStr((s) => {
                            const a = parseFloat(s.replace(",", ".")) || 0;
                            const sg = picking.serving_g ?? 1;
                            return (a / sg).toFixed(a / sg < 1 ? 2 : 1).replace(/\.?0+$/, "");
                          });
                        }}
                        className={`rounded px-3 py-1 ${unit === "piece" ? "bg-gold text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        Stück
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Menge ({unit === "piece" ? "Stück" : "g"})
                    </label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={amountStr}
                      onChange={(e) =>
                        setAmountStr(e.target.value.replace(/[^0-9.,]/g, ""))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-3 text-xs">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <div className="font-bold">{Math.round(picking.kcal_per_100g * f)}</div>
                        <div className="text-muted-foreground">kcal</div>
                      </div>
                      <div>
                        <div className="font-bold">{(picking.protein_per_100g * f).toFixed(1)}</div>
                        <div className="text-muted-foreground">Protein</div>
                      </div>
                      <div>
                        <div className="font-bold">{(picking.carbs_per_100g * f).toFixed(1)}</div>
                        <div className="text-muted-foreground">Carbs</div>
                      </div>
                      <div>
                        <div className="font-bold">{(picking.fat_per_100g * f).toFixed(1)}</div>
                        <div className="text-muted-foreground">Fett</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setPicking(null)} className="flex-1">
                      Zurück
                    </Button>
                    <Button onClick={addPicked} className="flex-1 bg-gradient-gold text-primary-foreground">
                      <Plus className="h-4 w-4" /> Hinzufügen
                    </Button>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Footer save */}
        <div className="shrink-0 border-t border-border bg-card p-3">
          <Button
            onClick={save}
            disabled={saving || ingredients.length === 0 || !name.trim()}
            className="w-full bg-gradient-gold text-primary-foreground disabled:opacity-50"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Speichern…</> : "Mahlzeit speichern"}
          </Button>
        </div>
      </div>
    </div>
  );
}
