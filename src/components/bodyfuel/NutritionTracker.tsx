import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Barcode, Plus, Trash2, Droplet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "./BarcodeScanner";
import {
  searchFoods,
  lookupBarcode,
  getNutritionTargets,
  getDayType,
  setDayType,
  type FoodResult,
  type DayType,
} from "@/lib/nutrition.functions";
import { Dumbbell, Moon } from "lucide-react";

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
const MEALS: { key: Meal; label: string; emoji: string }[] = [
  { key: "breakfast", label: "Frühstück", emoji: "🥐" },
  { key: "lunch", label: "Mittag", emoji: "🍱" },
  { key: "dinner", label: "Abend", emoji: "🍽️" },
  { key: "snack", label: "Snack", emoji: "🍎" },
];

type FoodEntry = {
  id: string;
  meal: Meal;
  name: string;
  brand: string | null;
  serving_g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type Targets = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_glasses: number;
};

const DEFAULT_TARGETS: Targets = {
  kcal: 2200,
  protein_g: 150,
  carbs_g: 220,
  fat_g: 70,
  water_glasses: 8,
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Ring({
  label,
  value,
  target,
  color,
  unit,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
  unit: string;
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const reached = value >= target;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
          <circle cx="36" cy="36" r={r} stroke="hsl(var(--secondary))" strokeWidth="6" fill="none" />
          <circle
            cx="36"
            cy="36"
            r={r}
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className="transition-all"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className={`text-sm font-bold ${reached ? "text-gold" : ""}`}>
              {Math.round(value)}
            </div>
            <div className="text-[9px] text-muted-foreground">/ {target}{unit}</div>
          </div>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

export function NutritionTracker() {
  const { supabaseUser } = useSession();
  const userId = supabaseUser?.id;
  const date = today();

  const [baseTargets, setBaseTargets] = useState<Targets>(DEFAULT_TARGETS);
  const [restTargets, setRestTargets] = useState<Targets | null>(null);
  const [dayType, setDayTypeState] = useState<DayType>("training");
  const [dayTypeSource, setDayTypeSource] = useState<"manual" | "auto">("auto");
  const [savingDayType, setSavingDayType] = useState(false);

  const targets: Targets =
    dayType === "rest" && restTargets ? restTargets : baseTargets;

  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [loading, setLoading] = useState(true);

  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoodResult[]>([]);
  const [picking, setPicking] = useState<FoodResult | null>(null);
  const [unit, setUnit] = useState<"g" | "piece">("g");
  const [amountStr, setAmountStr] = useState<string>("100");
  const [scannerOpen, setScannerOpen] = useState(false);

  const getTargetsFn = useServerFn(getNutritionTargets);
  const getDayTypeFn = useServerFn(getDayType);
  const setDayTypeFn = useServerFn(setDayType);
  const searchFn = useServerFn(searchFoods);
  const lookupFn = useServerFn(lookupBarcode);

  // Load targets + entries + water + day type
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [t, e, w, d] = await Promise.all([
        getTargetsFn({ data: { user_id: userId } }),
        supabase
          .from("food_entries")
          .select("id, meal, name, brand, serving_g, kcal, protein_g, carbs_g, fat_g")
          .eq("user_id", userId)
          .eq("entry_date", date)
          .order("created_at", { ascending: true }),
        supabase
          .from("water_logs")
          .select("glasses")
          .eq("user_id", userId)
          .eq("entry_date", date)
          .maybeSingle(),
        getDayTypeFn({ data: { user_id: userId, date } }),
      ]);
      if (cancelled) return;
      if (t) {
        setBaseTargets({
          kcal: t.kcal,
          protein_g: t.protein_g,
          carbs_g: t.carbs_g,
          fat_g: t.fat_g,
          water_glasses: t.water_glasses,
        });
        if (t.kcal_rest != null) {
          setRestTargets({
            kcal: t.kcal_rest,
            protein_g: t.protein_g_rest ?? t.protein_g,
            carbs_g: t.carbs_g_rest ?? t.carbs_g,
            fat_g: t.fat_g_rest ?? t.fat_g,
            water_glasses: t.water_glasses,
          });
        } else {
          setRestTargets(null);
        }
      }
      setEntries(((e.data as FoodEntry[]) ?? []).map((r) => ({ ...r })));
      setWaterGlasses(w.data?.glasses ?? 0);
      setDayTypeState(d.kind);
      setDayTypeSource(d.source);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, date, getTargetsFn, getDayTypeFn]);

  const toggleDayType = async () => {
    if (!userId) return;
    const next: DayType = dayType === "training" ? "rest" : "training";
    setSavingDayType(true);
    setDayTypeState(next);
    setDayTypeSource("manual");
    try {
      await setDayTypeFn({ data: { user_id: userId, date, kind: next } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingDayType(false);
    }
  };

  const resetDayType = async () => {
    if (!userId) return;
    setSavingDayType(true);
    try {
      await setDayTypeFn({ data: { user_id: userId, date, kind: null } });
      const d = await getDayTypeFn({ data: { user_id: userId, date } });
      setDayTypeState(d.kind);
      setDayTypeSource(d.source);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingDayType(false);
    }
  };


  const totals = useMemo(() => {
    return entries.reduce(
      (s, e) => ({
        kcal: s.kcal + Number(e.kcal),
        protein_g: s.protein_g + Number(e.protein_g),
        carbs_g: s.carbs_g + Number(e.carbs_g),
        fat_g: s.fat_g + Number(e.fat_g),
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );
  }, [entries]);

  // Auto-tick daily_checks based on targets reached
  const syncDailyCheck = async (
    proteinReached: boolean,
    waterReached: boolean,
  ) => {
    if (!userId) return;
    const { data: row } = await supabase
      .from("daily_checks")
      .select("id, tasks")
      .eq("user_id", userId)
      .eq("check_date", date)
      .maybeSingle();
    const tasks = (row?.tasks as Record<string, boolean>) ?? {};
    const updated = { ...tasks, protein: proteinReached, water: waterReached };
    // Punktwerte aus data.ts: protein=3, water=2 + Rest
    const POINTS: Record<string, number> = {
      protein: 3, water: 2, fruitsVeg: 2, steps: 2, training: 3, sleep: 2, recovery: 1,
    };
    const points = Object.entries(updated).reduce(
      (s, [k, v]) => s + (v ? POINTS[k] ?? 0 : 0),
      0,
    );
    await supabase
      .from("daily_checks")
      .upsert(
        { user_id: userId, check_date: date, tasks: updated, points },
        { onConflict: "user_id,check_date" },
      );
  };

  // Re-sync whenever totals or water cross thresholds
  useEffect(() => {
    if (loading || !userId) return;
    const proteinReached = totals.protein_g >= targets.protein_g;
    const waterReached = waterGlasses >= targets.water_glasses;
    syncDailyCheck(proteinReached, waterReached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.protein_g, waterGlasses, targets.protein_g, targets.water_glasses, loading]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await searchFn({ data: { query } });
      setResults(res);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const handleBarcode = async (code: string) => {
    setScannerOpen(false);
    try {
      const food = await lookupFn({ data: { barcode: code } });
      setPicking(food);
      setUnit(food.serving_g ? "piece" : "g");
      setAmountStr(food.serving_g ? "1" : "100");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const addPicked = async () => {
    if (!picking || !openMeal || !userId) return;
    const amt = parseFloat(amountStr.replace(",", "."));
    if (!isFinite(amt) || amt <= 0) {
      toast.error("Bitte gültige Menge eingeben");
      return;
    }
    const grams = unit === "piece" && picking.serving_g ? amt * picking.serving_g : amt;
    const factor = grams / 100;
    const payload = {
      user_id: userId,
      entry_date: date,
      meal: openMeal,
      name: picking.name,
      brand: picking.brand,
      barcode: picking.barcode,
      serving_g: +grams.toFixed(1),
      kcal: Math.round(picking.kcal_per_100g * factor),
      protein_g: +(picking.protein_per_100g * factor).toFixed(1),
      carbs_g: +(picking.carbs_per_100g * factor).toFixed(1),
      fat_g: +(picking.fat_per_100g * factor).toFixed(1),
      source: picking.barcode ? "barcode" : "manual",
    };
    const { data, error } = await supabase
      .from("food_entries")
      .insert(payload)
      .select("id, meal, name, brand, serving_g, kcal, protein_g, carbs_g, fat_g")
      .single();
    if (error) return toast.error(error.message);
    setEntries((e) => [...e, data as FoodEntry]);
    setPicking(null);
    setQuery("");
    setResults([]);
    setOpenMeal(null);
    toast.success("Eintrag hinzugefügt");
  };

  const removeEntry = async (id: string) => {
    const prev = entries;
    setEntries((e) => e.filter((x) => x.id !== id));
    const { error } = await supabase.from("food_entries").delete().eq("id", id);
    if (error) {
      setEntries(prev);
      toast.error(error.message);
    }
  };

  const updateWater = async (next: number) => {
    if (!userId) return;
    const v = Math.max(0, Math.min(40, next));
    setWaterGlasses(v);
    await supabase.from("water_logs").upsert(
      { user_id: userId, entry_date: date, glasses: v },
      { onConflict: "user_id,entry_date" },
    );
  };

  if (!userId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Bitte einloggen, um Essen zu tracken.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade…
      </div>
    );
  }

  const waterMl = waterGlasses * 250;
  const waterTargetMl = targets.water_glasses * 250;

  return (
    <div className="space-y-6">
      {/* Day-type badge */}
      <div
        className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${
          dayType === "training"
            ? "border-gold/50 bg-gradient-to-br from-accent/40 to-card"
            : "border-blue-400/40 bg-blue-400/10"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`grid h-11 w-11 place-items-center rounded-xl ${
              dayType === "training"
                ? "bg-gradient-gold text-primary-foreground"
                : "bg-blue-400/20 text-blue-300"
            }`}
          >
            {dayType === "training" ? <Dumbbell className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </div>
          <div>
            <div className="text-sm font-bold">
              {dayType === "training" ? "Trainingstag" : "Restday"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {restTargets
                ? dayType === "training"
                  ? `Training: ${baseTargets.kcal} kcal · P ${baseTargets.protein_g} · K ${baseTargets.carbs_g} · F ${baseTargets.fat_g}`
                  : `Restday: ${restTargets.kcal} kcal · P ${restTargets.protein_g} · K ${restTargets.carbs_g} · F ${restTargets.fat_g}`
                : "Im Plan ist kein Restday-Wert hinterlegt"}
              {" · "}
              {dayTypeSource === "auto" ? "automatisch erkannt" : "manuell gesetzt"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dayTypeSource === "manual" && (
            <Button size="sm" variant="ghost" onClick={resetDayType} disabled={savingDayType}>
              Auto
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={toggleDayType} disabled={savingDayType}>
            Auf {dayType === "training" ? "Restday" : "Trainingstag"} ändern
          </Button>
        </div>
      </div>

      {/* Header rings */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Heute</p>
            <h2 className="font-display text-xl font-bold">
              {Math.round(totals.kcal)} / {targets.kcal} kcal
            </h2>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Rest: <span className="text-gold font-semibold">{Math.max(0, targets.kcal - Math.round(totals.kcal))} kcal</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Ring label="kcal" value={totals.kcal} target={targets.kcal} color="hsl(var(--gold))" unit="" />
          <Ring label="Protein" value={totals.protein_g} target={targets.protein_g} color="#ef4444" unit="g" />
          <Ring label="Carbs" value={totals.carbs_g} target={targets.carbs_g} color="#3b82f6" unit="g" />
          <Ring label="Fett" value={totals.fat_g} target={targets.fat_g} color="#f59e0b" unit="g" />
        </div>
      </div>

      {/* Water tracker */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplet className="h-4 w-4 text-blue-400" />
            <div>
              <div className="text-sm font-semibold">Wasser</div>
              <div className="text-xs text-muted-foreground">
                {waterMl} ml / {waterTargetMl} ml ({waterGlasses}/{targets.water_glasses} Gläser à 0,25 L)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => updateWater(waterGlasses - 1)}>−</Button>
            <Button size="sm" variant="outline" onClick={() => updateWater(waterGlasses + 1)}>+ Glas</Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Array.from({ length: Math.max(targets.water_glasses, waterGlasses) }).map((_, i) => {
            const filled = i < waterGlasses;
            return (
              <button
                key={i}
                onClick={() => updateWater(i + 1 === waterGlasses ? i : i + 1)}
                className={`grid h-9 w-7 place-items-center rounded-md border transition ${
                  filled
                    ? "border-blue-400/70 bg-blue-400/20 text-blue-300"
                    : "border-border bg-background/40 text-muted-foreground hover:border-blue-400/40"
                }`}
                aria-label={`Glas ${i + 1}`}
              >
                <Droplet className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Meals */}
      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m.key);
        const sub = list.reduce((s, e) => s + Number(e.kcal), 0);
        return (
          <div key={m.key} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{m.emoji}</span>
                <div>
                  <div className="text-sm font-semibold">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{Math.round(sub)} kcal</div>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setOpenMeal(m.key);
                  setQuery("");
                  setResults([]);
                  setPicking(null);
                }}
                className="bg-gradient-gold text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Hinzufügen
              </Button>
            </div>
            {list.length > 0 && (
              <ul className="mt-3 divide-y divide-border">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{e.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {e.brand ? `${e.brand} · ` : ""}{Number(e.serving_g)} g · {Math.round(Number(e.kcal))} kcal · P {Number(e.protein_g)} · K {Number(e.carbs_g)} · F {Number(e.fat_g)}
                      </div>
                    </div>
                    <button
                      onClick={() => removeEntry(e.id)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {/* Add-Dialog */}
      {openMeal && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">
                {MEALS.find((x) => x.key === openMeal)?.label} — hinzufügen
              </div>
              <button
                onClick={() => {
                  setOpenMeal(null);
                  setPicking(null);
                }}
                className="rounded-md p-2 hover:bg-secondary"
              >
                ✕
              </button>
            </div>

            {!picking ? (
              <div className="p-4">
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="z.B. Skyr, Haferflocken…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  />
                  <Button onClick={runSearch} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" onClick={() => setScannerOpen(true)}>
                    <Barcode className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 max-h-80 overflow-y-auto">
                  {results.length === 0 && !searching && (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Suche oder Barcode scannen
                    </p>
                  )}
                  <ul className="divide-y divide-border">
                    {results.map((r, i) => (
                      <li key={i}>
                        <button
                          onClick={() => {
                            setPicking(r);
                            setUnit(r.serving_g ? "piece" : "g");
                            setAmountStr(r.serving_g ? "1" : "100");
                          }}
                          className="w-full px-2 py-2 text-left hover:bg-secondary"
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
                </div>
              </div>
            ) : (() => {
                const amt = parseFloat(amountStr.replace(",", ".")) || 0;
                const gramsCalc = unit === "piece" && picking.serving_g ? amt * picking.serving_g : amt;
                const factor = gramsCalc / 100;
                return (
              <div className="space-y-3 p-4">
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
                      type="button"
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
                      type="button"
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
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.,]/g, "");
                      setAmountStr(v);
                    }}
                    placeholder={unit === "piece" ? "z.B. 1" : "z.B. 50"}
                    className="mt-1"
                  />
                  {unit === "piece" && picking.serving_g && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      = {Math.round(gramsCalc)} g
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-secondary/40 p-3 text-xs">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="font-bold">{Math.round(picking.kcal_per_100g * factor)}</div>
                      <div className="text-muted-foreground">kcal</div>
                    </div>
                    <div>
                      <div className="font-bold">{(picking.protein_per_100g * factor).toFixed(1)}</div>
                      <div className="text-muted-foreground">Protein</div>
                    </div>
                    <div>
                      <div className="font-bold">{(picking.carbs_per_100g * factor).toFixed(1)}</div>
                      <div className="text-muted-foreground">Carbs</div>
                    </div>
                    <div>
                      <div className="font-bold">{(picking.fat_per_100g * factor).toFixed(1)}</div>
                      <div className="text-muted-foreground">Fett</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPicking(null)} className="flex-1">
                    Zurück
                  </Button>
                  <Button onClick={addPicked} className="flex-1 bg-gradient-gold text-primary-foreground">
                    Eintragen
                  </Button>
                </div>
              </div>
                );
              })()}
          </div>
        </div>
      )}

      {scannerOpen && (
        <BarcodeScanner onDetected={handleBarcode} onClose={() => setScannerOpen(false)} />
      )}
    </div>
  );
}
