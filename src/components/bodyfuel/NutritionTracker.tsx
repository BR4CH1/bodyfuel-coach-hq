import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Barcode, Plus, Trash2, Droplet, Loader2, Star, ChefHat, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormDraft, clearFormDraft } from "@/hooks/use-form-draft";
import { BarcodeScanner } from "./BarcodeScanner";
import { MealBuilderDialog } from "./MealBuilderDialog";
import { MealPhotoDialog } from "./MealPhotoDialog";
import { Camera } from "lucide-react";
import {
  searchFoods,
  searchFoodsDb,
  lookupBarcode,
  estimateFoodFromText,
  getNutritionTargets,
  getDayType,
  setDayType,
  type FoodResult,
  type DayType,
} from "@/lib/nutrition.functions";
import {
  getBullsDailyNutritionTargets,
  setBullsDayType,
  BULLS_DAY_TYPE_LABELS,
  type BullsDayType,
} from "@/lib/performance-nutrition/bulls-nutrition.functions";

function bullsDayTypeLabel(k: BullsDayType | string): string {
  return (BULLS_DAY_TYPE_LABELS as Record<string, string>)[k] ?? String(k);
}
import { listCustomMeals, type CustomMeal } from "@/lib/custom-meals.functions";
import { LOCAL_FOODS } from "@/lib/bodyfuel/localFoods";

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
  source: string | null;
};

type RecentFood = FoodResult & { last_amount_g: number };
type FavoriteFood = FoodResult & { fav_id: string; last_amount_g: number | null };

type Targets = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_glasses: number;
};

type PlanMealDayRow = {
  id: string;
  name: string;
  nutrition_plan_days?: { name: string } | { name: string }[] | null;
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

function SourceBadge({
  source,
  verified,
}: {
  source?: FoodResult["source"];
  verified?: boolean;
}) {
  if (verified) {
    return (
      <span className="ml-1 inline-flex items-center rounded-sm bg-emerald-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
        BodyFuel ✓
      </span>
    );
  }
  switch (source) {
    case "bls_4_0":
      return (
        <span className="ml-1 inline-flex items-center rounded-sm bg-emerald-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
          BLS 4.0
        </span>
      );
    case "bodyfuel_verified":
      return (
        <span className="ml-1 inline-flex items-center rounded-sm bg-emerald-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
          BodyFuel ✓
        </span>
      );
    case "open_food_facts":
      return (
        <span className="ml-1 inline-flex items-center rounded-sm bg-sky-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-400">
          OFF
        </span>
      );
    case "usda":
      return (
        <span className="ml-1 inline-flex items-center rounded-sm bg-sky-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-400">
          USDA
        </span>
      );
    case "ai_estimate":
      return (
        <span className="ml-1 inline-flex items-center rounded-sm bg-amber-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-400">
          ⚠ geschätzt
        </span>
      );
    default:
      return null;
  }
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

export function NutritionTracker({
  variant = "personal",
}: {
  variant?: "personal" | "bulls";
}) {
  const { supabaseUser, isCoach } = useSession();
  const userId = supabaseUser?.id;
  const [date, setDate] = useState<string>(() => today());
  const isToday = date === today();
  const isBulls = variant === "bulls";

  const [baseTargets, setBaseTargets] = useState<Targets>(DEFAULT_TARGETS);
  const [restTargets, setRestTargets] = useState<Targets | null>(null);
  const [dayType, setDayTypeState] = useState<DayType | BullsDayType>("training");
  const [dayTypeSource, setDayTypeSource] = useState<"manual" | "auto">("auto");
  const [savingDayType, setSavingDayType] = useState(false);

  const targets: Targets =
    dayType === "rest" && restTargets ? restTargets : baseTargets;

  const [allEntries, setAllEntries] = useState<FoodEntry[]>([]);
  const [planMealKinds, setPlanMealKinds] = useState<Record<string, DayType>>({});
  // Tracked entries always count for the currently selected day —
  // no Filterung nach Plan-Tag-Kind (Training/Rest), damit eine
  // bewusst gewählte Mahlzeit auch am eingestellten Tag erscheint.
  const entries = allEntries;
  void planMealKinds;

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
  const [photoOpen, setPhotoOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [source, setSource] = useState<"food" | "meal">("food");
  const [customMeals, setCustomMeals] = useState<CustomMeal[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const listCustomMealsFn = useServerFn(listCustomMeals);

  // Persist in-progress add-meal dialog so phone-lock / tab switch doesn't wipe it.
  const draftKey = userId ? `bf.nutritionTracker.add.${userId}.${date}.v1` : null;
  useFormDraft(
    draftKey,
    { openMeal, query, picking, unit, amountStr, source },
    (d) => {
      if (d.openMeal === null || typeof d.openMeal === "string") {
        setOpenMeal(d.openMeal as Meal | null);
      }
      if (typeof d.query === "string") setQuery(d.query);
      if (d.picking && typeof d.picking === "object") setPicking(d.picking as FoodResult);
      if (d.unit === "g" || d.unit === "piece") setUnit(d.unit);
      if (typeof d.amountStr === "string") setAmountStr(d.amountStr);
      if (d.source === "food" || d.source === "meal") setSource(d.source);
    },
  );

  const favKey = (f: { barcode?: string | null; name: string; brand?: string | null }) =>
    `${f.barcode ?? f.name}|${f.brand ?? ""}`;
  const favIndex = useMemo(() => {
    const m = new Map<string, string>();
    favorites.forEach((f) => m.set(favKey(f), f.fav_id));
    return m;
  }, [favorites]);
  const isFavorite = (f: { barcode?: string | null; name: string; brand?: string | null }) =>
    favIndex.has(favKey(f));

  const reloadFavorites = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("food_favorites")
      .select("id, name, brand, barcode, serving_g, serving_label, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, last_amount_g")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Array<{
      id: string; name: string; brand: string | null; barcode: string | null;
      serving_g: number | null; serving_label: string | null;
      kcal_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number;
      last_amount_g: number | null;
    }>;
    setFavorites(rows.map((r) => ({
      fav_id: r.id,
      name: r.name,
      brand: r.brand,
      barcode: r.barcode,
      serving_g: r.serving_g,
      serving_label: r.serving_label,
      kcal_per_100g: Number(r.kcal_per_100g),
      protein_per_100g: Number(r.protein_per_100g),
      carbs_per_100g: Number(r.carbs_per_100g),
      fat_per_100g: Number(r.fat_per_100g),
      last_amount_g: r.last_amount_g != null ? Number(r.last_amount_g) : null,
    })));
  };

  const toggleFavorite = async (
    food: FoodResult & { last_amount_g?: number | null },
  ) => {
    if (!userId) return;
    const existingId = favIndex.get(favKey(food));
    if (existingId) {
      const prev = favorites;
      setFavorites((xs) => xs.filter((x) => x.fav_id !== existingId));
      const { error } = await supabase.from("food_favorites").delete().eq("id", existingId);
      if (error) {
        setFavorites(prev);
        toast.error(error.message);
      } else {
        toast.success("Favorit entfernt");
      }
      return;
    }
    const { data, error } = await supabase
      .from("food_favorites")
      .insert({
        user_id: userId,
        name: food.name,
        brand: food.brand,
        barcode: food.barcode,
        serving_g: food.serving_g,
        serving_label: food.serving_label ?? null,
        kcal_per_100g: food.kcal_per_100g,
        protein_per_100g: food.protein_per_100g,
        carbs_per_100g: food.carbs_per_100g,
        fat_per_100g: food.fat_per_100g,
        last_amount_g: food.last_amount_g ?? null,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setFavorites((xs) => [
      {
        fav_id: (data as { id: string }).id,
        name: food.name,
        brand: food.brand,
        barcode: food.barcode,
        serving_g: food.serving_g,
        serving_label: food.serving_label ?? null,
        kcal_per_100g: food.kcal_per_100g,
        protein_per_100g: food.protein_per_100g,
        carbs_per_100g: food.carbs_per_100g,
        fat_per_100g: food.fat_per_100g,
        last_amount_g: food.last_amount_g ?? null,
      },
      ...xs,
    ]);
    toast.success("Als Favorit gespeichert");
  };

  const getTargetsFn = useServerFn(getNutritionTargets);
  const getDayTypeFn = useServerFn(getDayType);
  const setDayTypeFn = useServerFn(setDayType);
  const getBullsTargetsFn = useServerFn(getBullsDailyNutritionTargets);
  const setBullsDayTypeFn = useServerFn(setBullsDayType);
  const searchFn = useServerFn(searchFoods);
  const searchDbFn = useServerFn(searchFoodsDb);
  const lookupFn = useServerFn(lookupBarcode);
  const estimateFn = useServerFn(estimateFoodFromText);
  const [aiEstimating, setAiEstimating] = useState(false);

  const estimateWithAi = async () => {
    const term = query.trim();
    if (!term) return;
    setAiEstimating(true);
    try {
      const r = await estimateFn({ data: { query: term } });
      setResults((prev) => [r, ...prev]);
      setPicking(r);
      setUnit(r.serving_g ? "piece" : "g");
      setAmountStr(r.serving_g ? "1" : "100");
      toast.success("Schätzung erstellt – Werte prüfen & speichern.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiEstimating(false);
    }
  };

  // Load targets + entries + water + day type
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [entriesRes, waterRes] = await Promise.all([
        supabase
          .from("food_entries")
          .select("id, meal, name, brand, serving_g, kcal, protein_g, carbs_g, fat_g, source")
          .eq("user_id", userId)
          .eq("entry_date", date)
          .order("created_at", { ascending: true }),
        supabase
          .from("water_logs")
          .select("glasses")
          .eq("user_id", userId)
          .eq("entry_date", date)
          .maybeSingle(),
      ]);

      if (isBulls) {
        // BULLS: engine (org-scoped Performance Nutrition Engine) is the single
        // source of truth. No local fallback, no hardcoded rest/training kcal.
        try {
          const b = await getBullsTargetsFn({ data: { date } });
          if (cancelled) return;
          // Use the ACTIVE engine target for the resolved day type — supports
          // all 5 Bulls day types (rest / strength / football_training /
          // game_day / double_session). No hardcoded training/rest split.
          if (b.targets) {
            setBaseTargets({
              kcal: b.targets.kcal,
              protein_g: b.targets.protein_g,
              carbs_g: b.targets.carbs_g,
              fat_g: b.targets.fat_g,
              water_glasses: DEFAULT_TARGETS.water_glasses,
            });
          } else {
            setBaseTargets(DEFAULT_TARGETS);
          }
          // restTargets kept null in Bulls — 5 day types, no binary fallback.
          setRestTargets(null);
          setDayTypeState(b.dayType);
          setDayTypeSource(b.dayTypeSource);
        } catch (err) {
          if (!cancelled) toast.error((err as Error).message);
        }
      } else {
        const [t, d] = await Promise.all([
          getTargetsFn({ data: { user_id: userId } }),
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
        setDayTypeState(d.kind);
        setDayTypeSource(d.source);
      }

      const rows = ((entriesRes.data as FoodEntry[]) ?? []).map((r) => ({ ...r }));
      setPlanMealKinds({});
      setAllEntries(rows);
      setWaterGlasses(waterRes.data?.glasses ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, date, isBulls, getTargetsFn, getDayTypeFn, getBullsTargetsFn]);

  const toggleDayType = async () => {
    if (!userId) return;
    setSavingDayType(true);
    setDayTypeSource("manual");
    try {
      if (isBulls) {
        // In Bulls the tracker keeps a simple rest ↔ football_training toggle
        // (the full 5-way selection lives in BullsWeekScheduleCard /
        // BullsPlanContentView). Any non-rest current type flips to rest.
        const next: BullsDayType = dayType === "rest" ? "football_training" : "rest";
        setDayTypeState(next);
        await setBullsDayTypeFn({ data: { date, kind: next } });
        const b = await getBullsTargetsFn({ data: { date } });
        if (b.targets) {
          setBaseTargets({
            kcal: b.targets.kcal,
            protein_g: b.targets.protein_g,
            carbs_g: b.targets.carbs_g,
            fat_g: b.targets.fat_g,
            water_glasses: DEFAULT_TARGETS.water_glasses,
          });
        }
        setDayTypeState(b.dayType);
      } else {
        const next: DayType = dayType === "training" ? "rest" : "training";
        setDayTypeState(next);
        await setDayTypeFn({ data: { user_id: userId, date, kind: next } });
      }
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
      if (isBulls) {
        await setBullsDayTypeFn({ data: { date, kind: null } });
        const b = await getBullsTargetsFn({ data: { date } });
        setDayTypeState(b.dayType);
        setDayTypeSource(b.dayTypeSource);
      } else {
        await setDayTypeFn({ data: { user_id: userId, date, kind: null } });
        const d = await getDayTypeFn({ data: { user_id: userId, date } });
        setDayTypeState(d.kind);
        setDayTypeSource(d.source);
      }
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

  const runSearch = async (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) {
      setResults([]);
      return;
    }
    const local = LOCAL_FOODS.filter(
      (f) => localFoodMatches(f.name, term) || (f.aliases ?? []).some((a) => localFoodMatches(a, term)),
    ).map(({ aliases: _a, ...r }) => r);
    if (local.length > 0) setResults(local);
    setSearching(true);
    try {
      const [dbResults, remote] = await Promise.all([
        searchDbFn({ data: { query: term, limit: 15 } }).catch(() => [] as FoodResult[]),
        searchFn({ data: { query: term } }).catch(() => [] as FoodResult[]),
      ]);
      // Reihenfolge: BodyFuel-DB → lokal → OFF
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
  };

  // Live suggestions: debounced auto-search while typing
  useEffect(() => {
    if (!openMeal || picking) return;
    const term = query.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => runSearch(term), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, openMeal, picking]);

  // Load recent unique foods + favorites when the add dialog opens
  useEffect(() => {
    if (!openMeal || picking || !userId) return;
    setLoadingFavorites(true);
    reloadFavorites().finally(() => setLoadingFavorites(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMeal, picking, userId]);

  useEffect(() => {
    if (!openMeal || picking || !userId) return;
    let cancelled = false;
    (async () => {
      setLoadingRecent(true);
      const { data } = await supabase
        .from("food_entries")
        .select("name, brand, barcode, serving_g, kcal, protein_g, carbs_g, fat_g, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      const seen = new Set<string>();
      const out: RecentFood[] = [];
      for (const r of (data ?? []) as Array<{
        name: string; brand: string | null; barcode: string | null;
        serving_g: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number;
      }>) {
        const key = (r.barcode || r.name) + "|" + (r.brand ?? "");
        if (seen.has(key)) continue;
        seen.add(key);
        const sg = Number(r.serving_g) || 0;
        if (sg <= 0) continue;
        const f = 100 / sg;
        out.push({
          name: r.name,
          brand: r.brand,
          barcode: r.barcode,
          serving_g: null,
          serving_label: null,
          kcal_per_100g: Number(r.kcal) * f,
          protein_per_100g: Number(r.protein_g) * f,
          carbs_per_100g: Number(r.carbs_g) * f,
          fat_per_100g: Number(r.fat_g) * f,
          last_amount_g: sg,
        });
        if (out.length >= 15) break;
      }
      setRecentFoods(out);
      setLoadingRecent(false);
    })();
    return () => { cancelled = true; };
  }, [openMeal, picking, userId, allEntries.length]);

  // Load custom meals when dialog opens
  useEffect(() => {
    if (!openMeal || picking || !userId) return;
    let cancelled = false;
    setLoadingMeals(true);
    listCustomMealsFn({ data: {} })
      .then((rows) => {
        if (!cancelled) setCustomMeals(rows ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingMeals(false);
      });
    return () => { cancelled = true; };
  }, [openMeal, picking, userId, listCustomMealsFn, builderOpen]);

  const addCustomMeal = async (m: CustomMeal) => {
    if (!openMeal || !userId) return;
    const payload = {
      user_id: userId,
      entry_date: date,
      meal: openMeal,
      name: m.name,
      serving_g: 100,
      kcal: Math.round(m.kcal ?? 0),
      protein_g: m.protein_g ? +Number(m.protein_g).toFixed(1) : 0,
      carbs_g: m.carbs_g ? +Number(m.carbs_g).toFixed(1) : 0,
      fat_g: m.fat_g ? +Number(m.fat_g).toFixed(1) : 0,
      source: `custom:${m.id}`,
    };
    const { data: row, error } = await supabase
      .from("food_entries")
      .insert(payload)
      .select("id, meal, name, brand, serving_g, kcal, protein_g, carbs_g, fat_g, source")
      .single();
    if (error) return toast.error(error.message);
    setAllEntries((e) => [...e, row as FoodEntry]);
    setOpenMeal(null);
    clearFormDraft(draftKey);
    toast.success("Mahlzeit hinzugefügt");
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
      source: picking.source ?? (picking.barcode ? "barcode" : "manual"),
    };
    const { data, error } = await supabase
      .from("food_entries")
      .insert(payload)
      .select("id, meal, name, brand, serving_g, kcal, protein_g, carbs_g, fat_g, source")
      .single();
    if (error) return toast.error(error.message);
    setAllEntries((e) => [...e, data as FoodEntry]);
    setPicking(null);
    setQuery("");
    setResults([]);
    setOpenMeal(null);
    clearFormDraft(draftKey);
    toast.success("Eintrag hinzugefügt");
  };

  const removeEntry = async (id: string) => {
    const prev = allEntries;
    setAllEntries((e) => e.filter((x) => x.id !== id));
    const { error } = await supabase.from("food_entries").delete().eq("id", id);
    if (error) {
      setAllEntries(prev);
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
      {/* Date picker */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const d = new Date(date + "T12:00:00");
              d.setDate(d.getDate() - 1);
              setDate(d.toISOString().slice(0, 10));
            }}
          >
            ← Tag
          </Button>
          <Input
            type="date"
            className="h-8 w-[150px]"
            value={date}
            max={today()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={isToday}
            onClick={() => {
              const d = new Date(date + "T12:00:00");
              d.setDate(d.getDate() + 1);
              const next = d.toISOString().slice(0, 10);
              if (next <= today()) setDate(next);
            }}
          >
            Tag →
          </Button>
        </div>
        {!isToday && (
          <Button size="sm" variant="ghost" onClick={() => setDate(today())}>
            Heute
          </Button>
        )}
      </div>

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
              {isBulls
                ? bullsDayTypeLabel(dayType as BullsDayType)
                : dayType === "training"
                  ? "Trainingstag"
                  : "Restday"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isBulls
                ? `${baseTargets.kcal} kcal · P ${baseTargets.protein_g} · K ${baseTargets.carbs_g} · F ${baseTargets.fat_g}`
                : restTargets
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
            {isBulls
              ? dayType === "rest"
                ? "Auf Football Training ändern"
                : "Auf Restday ändern"
              : `Auf ${dayType === "training" ? "Restday" : "Trainingstag"} ändern`}
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
          <Ring label="kcal" value={totals.kcal} target={targets.kcal} color="var(--gold)" unit="" />
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

      {/* Eigene Mahlzeit erstellen */}
      <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-accent/30 to-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold">Eigene Mahlzeit erstellen</div>
            <div className="text-[11px] text-muted-foreground">
              Stell dir aus mehreren Lebensmitteln eine eigene Mahlzeit zusammen und tracke sie später mit einem Klick.
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setBuilderOpen(true)}
            className="shrink-0 bg-gradient-gold text-primary-foreground"
          >
            <ChefHat className="h-4 w-4" /> Erstellen
          </Button>
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
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setOpenMeal(m.key);
                    setQuery("");
                    setResults([]);
                    setPicking(null);
                    setSource("food");
                  }}
                  className="bg-gradient-gold text-primary-foreground"
                >
                  <Plus className="h-4 w-4" /> Hinzufügen
                </Button>
              </div>
            </div>
            {list.length > 0 && (
              <ul className="mt-3 divide-y divide-border">
                {list.map((e) => {
                  const isPlan = typeof e.source === "string" && e.source.startsWith("plan:");
                  const cleanName = isPlan
                    ? e.name.replace(/^\s*(Frühstück|Mittagessen|Mittag|Abendessen|Abend|Snack|Spätsnack|Late[- ]?Night|Pre[- ]?Workout|Post[- ]?Workout|Shake|Mahlzeit\s*\d+)\s*[—–\-:]\s*/i, "")
                    : e.name;
                  return (
                  <li key={e.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium break-words">{cleanName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {e.brand ? `${e.brand} · ` : ""}{isPlan ? "" : `${Number(e.serving_g)} g · `}{Math.round(Number(e.kcal))} kcal · P {Number(e.protein_g)} · K {Number(e.carbs_g)} · F {Number(e.fat_g)}
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
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      {/* Add-Dialog */}
      {openMeal && (
        <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-4">
          <div className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden border-border bg-card sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
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
              <div className="flex min-h-0 flex-1 flex-col p-4">
                {/* Source toggle: Lebensmittel / Mahlzeiten */}
                <div className="mb-3 inline-flex shrink-0 self-start rounded-md border border-border bg-background/40 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSource("food")}
                    className={`rounded px-3 py-1.5 ${source === "food" ? "bg-gold text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    Lebensmittel
                  </button>
                  <button
                    type="button"
                    onClick={() => setSource("meal")}
                    className={`rounded px-3 py-1.5 ${source === "meal" ? "bg-gold text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    Mahlzeiten {customMeals.length > 0 ? `(${customMeals.length})` : ""}
                  </button>
                </div>
                {source === "food" ? (
                <>
                <div className="flex shrink-0 gap-2">
                  <Input
                    autoFocus
                    placeholder="z.B. Ei, Skyr, Haferflocken…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  />
                  <Button variant="outline" onClick={() => setScannerOpen(true)} title="Barcode">
                    <Barcode className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPhotoOpen(true)}
                    title="Gericht fotografieren"
                    className="border-gold/50 text-gold hover:bg-gold/10"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                  {query.trim() === "" && (
                    <>
                      {favorites.length > 0 && (
                        <div className="mb-4">
                          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gold">
                            ★ Favoriten
                          </div>
                          <ul className="divide-y divide-border">
                            {favorites.map((r) => (
                              <li key={`fav-${r.fav_id}`} className="flex items-center">
                                <button
                                  onClick={() => {
                                    setPicking(r);
                                    setUnit(r.serving_g ? "piece" : "g");
                                    setAmountStr(
                                      r.last_amount_g != null
                                        ? String(Math.round(r.last_amount_g))
                                        : r.serving_g ? "1" : "100",
                                    );
                                  }}
                                  className="min-w-0 flex-1 px-2 py-3 text-left hover:bg-secondary"
                                >
                                  <div className="truncate text-sm font-medium">{r.name}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {r.brand ? `${r.brand} · ` : ""}
                                    {Math.round(r.kcal_per_100g)} kcal · P {r.protein_per_100g.toFixed(1)} · K {r.carbs_per_100g.toFixed(1)} · F {r.fat_per_100g.toFixed(1)} (/100g)
                                  </div>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleFavorite(r); }}
                                  className="shrink-0 p-3 text-gold hover:bg-secondary"
                                  aria-label="Favorit entfernen"
                                >
                                  <Star className="h-4 w-4 fill-current" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {recentFoods.length > 0 ? (
                        <div>
                          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Zuletzt getrackt
                          </div>
                          <ul className="divide-y divide-border">
                            {recentFoods.map((r, i) => {
                              const fav = isFavorite(r);
                              return (
                              <li key={`recent-${i}`} className="flex items-center">
                                <button
                                  onClick={() => {
                                    setPicking(r);
                                    setUnit("g");
                                    setAmountStr(String(Math.round(r.last_amount_g)));
                                  }}
                                  className="min-w-0 flex-1 px-2 py-3 text-left hover:bg-secondary"
                                >
                                  <div className="truncate text-sm font-medium">{r.name}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {r.brand ? `${r.brand} · ` : ""}
                                    {Math.round(r.kcal_per_100g)} kcal · P {r.protein_per_100g.toFixed(1)} · K {r.carbs_per_100g.toFixed(1)} · F {r.fat_per_100g.toFixed(1)} (/100g)
                                  </div>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleFavorite(r); }}
                                  className={`shrink-0 p-3 hover:bg-secondary ${fav ? "text-gold" : "text-muted-foreground"}`}
                                  aria-label={fav ? "Favorit entfernen" : "Als Favorit speichern"}
                                >
                                  <Star className={`h-4 w-4 ${fav ? "fill-current" : ""}`} />
                                </button>
                              </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : favorites.length === 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">
                          {loadingRecent || loadingFavorites ? "Lade…" : "Tippe los — Vorschläge erscheinen automatisch"}
                        </p>
                      ) : null}
                    </>
                  )}
                  {query.trim() !== "" && results.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        {searching ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Suche…</>
                        ) : (
                          "Keine Treffer in der Datenbank"
                        )}
                      </p>
                      {!searching && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={estimateWithAi}
                          disabled={aiEstimating}
                          className="gap-2 border-gold/40 text-gold hover:bg-gold/10"
                        >
                          {aiEstimating ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Schätzt…</>
                          ) : (
                            <><Sparkles className="h-3.5 w-3.5" /> Nährwerte schätzen</>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                  {query.trim() !== "" && results.length > 0 && !searching && (
                    <div className="flex justify-end pb-2">
                      <button
                        type="button"
                        onClick={estimateWithAi}
                        disabled={aiEstimating}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gold disabled:opacity-50"
                      >
                        {aiEstimating ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Schätzt…</>
                        ) : (
                          <><Sparkles className="h-3 w-3" /> Nichts passt? Schätzung</>
                        )}
                      </button>
                    </div>
                  )}

                  <ul className="divide-y divide-border">
                    {results.map((r, i) => {
                      const fav = isFavorite(r);
                      return (
                      <li key={i} className="flex items-center">
                        <button
                          onClick={() => {
                            setPicking(r);
                            setUnit(r.serving_g ? "piece" : "g");
                            setAmountStr(r.serving_g ? "1" : "100");
                          }}
                          className="min-w-0 flex-1 px-2 py-3 text-left hover:bg-secondary"
                        >
                          <div className="flex items-center gap-1">
                            <div className="truncate text-sm font-medium">{r.name}</div>
                            {isCoach && <SourceBadge source={r.source} verified={r.verified_by_coach} />}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.brand ? `${r.brand} · ` : ""}
                            {Math.round(r.kcal_per_100g)} kcal · P {r.protein_per_100g.toFixed(1)} · K {r.carbs_per_100g.toFixed(1)} · F {r.fat_per_100g.toFixed(1)} (/100g)
                            {r.serving_g ? ` · 1 Stück ≈ ${r.serving_g} g` : ""}
                          </div>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(r); }}
                          className={`shrink-0 p-3 hover:bg-secondary ${fav ? "text-gold" : "text-muted-foreground"}`}
                          aria-label={fav ? "Favorit entfernen" : "Als Favorit speichern"}
                        >
                          <Star className={`h-4 w-4 ${fav ? "fill-current" : ""}`} />
                        </button>
                      </li>
                      );
                    })}
                  </ul>

                </div>
                </>
                ) : (
                <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Deine Mahlzeiten
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setBuilderOpen(true)}
                      className="h-7 text-xs text-gold"
                    >
                      <ChefHat className="h-3.5 w-3.5" /> Neu
                    </Button>
                  </div>
                  {loadingMeals ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">Lade…</p>
                  ) : customMeals.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Noch keine eigenen Mahlzeiten. Tippe oben auf „Neu", um eine anzulegen.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {customMeals.map((m) => (
                        <li key={m.id}>
                          <button
                            onClick={() => addCustomMeal(m)}
                            className="w-full px-2 py-3 text-left hover:bg-secondary"
                          >
                            <div className="truncate text-sm font-medium">{m.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {m.kcal ? `${Math.round(m.kcal)} kcal` : "—"}
                              {m.protein_g ? ` · P ${Number(m.protein_g).toFixed(1)}` : ""}
                              {m.carbs_g ? ` · K ${Number(m.carbs_g).toFixed(1)}` : ""}
                              {m.fat_g ? ` · F ${Number(m.fat_g).toFixed(1)}` : ""}
                              {m.ingredients?.length ? ` · ${m.ingredients.length} Zutaten` : ""}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                )}
              </div>
            ) : (() => {
                const amt = parseFloat(amountStr.replace(",", ".")) || 0;
                const gramsCalc = unit === "piece" && picking.serving_g ? amt * picking.serving_g : amt;
                const factor = gramsCalc / 100;
                return (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <div className="text-sm font-semibold">{picking.name}</div>
                      {isCoach && <SourceBadge source={picking.source} verified={picking.verified_by_coach} />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {picking.brand ?? "—"}
                      {picking.serving_g ? ` · 1 Stück ≈ ${picking.serving_g} g` : ""}
                    </div>
                    {isCoach && picking.source === "ai_estimate" && (
                      <div className="mt-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-300">
                        ⚠ KI-Schätzung – Werte vor dem Speichern prüfen. Nicht aus geprüfter Datenbank.
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFavorite({ ...picking, last_amount_g: parseFloat(amountStr.replace(",", ".")) || null })}
                    className={`shrink-0 rounded-md border border-border p-2 ${isFavorite(picking) ? "text-gold" : "text-muted-foreground"} hover:bg-secondary`}
                    aria-label={isFavorite(picking) ? "Favorit entfernen" : "Als Favorit speichern"}
                  >
                    <Star className={`h-4 w-4 ${isFavorite(picking) ? "fill-current" : ""}`} />
                  </button>
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

      <MealBuilderDialog
        userId={userId}
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
      />

      <MealPhotoDialog
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        defaultSlot={(openMeal as "breakfast" | "lunch" | "dinner" | "snack") ?? "snack"}
        entryDate={date}
        onTracked={() => {
          // Re-fetch today's entries
          if (userId) {
            supabase
              .from("food_entries")
              .select("id, meal, name, brand, serving_g, kcal, protein_g, carbs_g, fat_g, source")
              .eq("user_id", userId)
              .eq("entry_date", date)
              .then(({ data }) => {
                if (data) setAllEntries(data as FoodEntry[]);
              });
          }
        }}
      />
    </div>
  );
}
