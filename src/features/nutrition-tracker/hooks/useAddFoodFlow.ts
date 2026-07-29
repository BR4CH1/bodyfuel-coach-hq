import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { clearFormDraft, useFormDraft } from "@/hooks/use-form-draft";
import { supabase } from "@/integrations/supabase/client";
import { checkFoodEnergy } from "@/lib/food-energy";
import { piecePresetFor, piecesToGrams } from "@/lib/food-piece-sizes";

import { listCustomMeals, type CustomMeal } from "@/lib/custom-meals.functions";
import {
  customMealEntryName,
  formatPortionFactor,
  parsePortionFactor,
  scaleCustomMeal,
} from "../lib/custom-meal-portion.logic";

const LAST_PORTION_KEY = "bf.nutritionTracker.lastMealPortion";

import {
  estimateFoodFromText,
  lookupBarcode,
  searchFoodsDb,
  type FoodResult,
} from "@/lib/nutrition.functions";
import {
  amountInGrams,
  favoriteKey,
  nutritionFactorForAmount,
  parseFoodAmount,
} from "../lib/nutrition-tracker.logic";
import type {
  AddFoodSource,
  FavoriteCandidate,
  FavoriteFood,
  FoodEntry,
  FoodAmountMode,
  FoodPickOptions,
  FoodUnit,
  Meal,
  RecentFood,
} from "../types";

type UseAddFoodFlowOptions = {
  userId: string | undefined;
  date: string;
  entryCount: number;
  setEntries: Dispatch<SetStateAction<FoodEntry[]>>;
  reloadEntries: () => Promise<void>;
};

export function useAddFoodFlow({
  userId,
  date,
  entryCount,
  setEntries,
  reloadEntries,
}: UseAddFoodFlowOptions) {
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoodResult[]>([]);
  const [picking, setPicking] = useState<FoodResult | null>(null);
  const [unit, setUnit] = useState<FoodUnit>("g");
  const [amountStr, setAmountStr] = useState("100");
  const [amountMode, setAmountMode] = useState<FoodAmountMode>("unit");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [source, setSource] = useState<AddFoodSource>("food");
  const [customMeals, setCustomMeals] = useState<CustomMeal[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [pickingMeal, setPickingMeal] = useState<CustomMeal | null>(null);
  const [portionStr, setPortionStr] = useState("1");
  const [savingMeal, setSavingMeal] = useState(false);
  const [estimatingAi, setEstimatingAi] = useState(false);


  const listCustomMealsFn = useServerFn(listCustomMeals);
  const searchDbFn = useServerFn(searchFoodsDb);
  const lookupFn = useServerFn(lookupBarcode);
  const estimateFn = useServerFn(estimateFoodFromText);

  const draftKey = userId ? `bf.nutritionTracker.add.${userId}.${date}.v1` : null;
  useFormDraft(draftKey, { openMeal, query, picking, unit, amountStr, source }, (draft) => {
    if (draft.openMeal === null || typeof draft.openMeal === "string") {
      setOpenMeal(draft.openMeal as Meal | null);
    }
    if (typeof draft.query === "string") setQuery(draft.query);
    if (draft.picking && typeof draft.picking === "object") {
      setPicking(draft.picking as FoodResult);
    }
    if (draft.unit === "g" || draft.unit === "ml") setUnit(draft.unit);
    if (typeof draft.amountStr === "string") setAmountStr(draft.amountStr);
    if (draft.source === "food" || draft.source === "meal") setSource(draft.source);
  });

  const favIndex = useMemo(() => {
    const index = new Map<string, string>();
    favorites.forEach((favorite) => index.set(favoriteKey(favorite), favorite.fav_id));
    return index;
  }, [favorites]);

  const isFavorite = useCallback(
    (food: { barcode?: string | null; name: string; brand?: string | null }) =>
      favIndex.has(favoriteKey(food)),
    [favIndex],
  );

  const reloadFavorites = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("food_favorites")
      .select(
        "id, food_id, name, brand, barcode, serving_g, serving_label, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, reference_unit, density_g_per_ml, last_amount, source",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as Array<{
      id: string;
      food_id: string | null;
      name: string;
      brand: string | null;
      barcode: string | null;
      serving_g: number | null;
      serving_label: string | null;
      kcal_per_100g: number;
      protein_per_100g: number;
      carbs_per_100g: number;
      fat_per_100g: number;
      reference_unit: FoodUnit;
      density_g_per_ml: number | null;
      last_amount: number | null;
      source: string | null;
    }>;

    setFavorites(
      rows.map((row) => {
        const energy = checkFoodEnergy({
          kcal_per_100g: Number(row.kcal_per_100g),
          protein_per_100g: Number(row.protein_per_100g),
          carbs_per_100g: Number(row.carbs_per_100g),
          fat_per_100g: Number(row.fat_per_100g),
        });
        return {
          fav_id: row.id,
          id: row.food_id,
          name: row.name,
          brand: row.brand == null ? null : String(row.brand),
          barcode: row.barcode,
          serving_g: row.serving_g,
          serving_label: row.serving_label,
          kcal_per_100g: energy.kcal_per_100g,
          protein_per_100g: Number(row.protein_per_100g),
          carbs_per_100g: Number(row.carbs_per_100g),
          fat_per_100g: Number(row.fat_per_100g),
          unit: row.reference_unit === "ml" ? "ml" : ("g" as FoodUnit),
          density_g_per_ml: row.density_g_per_ml == null ? null : Number(row.density_g_per_ml),
          last_amount: row.last_amount != null ? Number(row.last_amount) : null,
          source: (row.source as FoodResult["source"]) ?? null,
          energy_flagged: energy.flagged,
          energy_note: energy.reason,
        };
      }),
    );

  }, [userId]);

  const toggleFavorite = useCallback(
    async (food: FavoriteCandidate) => {
      if (!userId) return;
      const existingId = favIndex.get(favoriteKey(food));
      if (existingId) {
        const previous = favorites;
        setFavorites((items) => items.filter((item) => item.fav_id !== existingId));
        const { error } = await supabase.from("food_favorites").delete().eq("id", existingId);
        if (error) {
          setFavorites(previous);
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
          food_id: food.id ?? null,
          name: food.name,
          brand: food.brand,
          barcode: food.barcode,
          serving_g: food.serving_g,
          serving_label: food.serving_label ?? null,
          kcal_per_100g: food.kcal_per_100g,
          protein_per_100g: food.protein_per_100g,
          carbs_per_100g: food.carbs_per_100g,
          fat_per_100g: food.fat_per_100g,
          reference_unit: food.unit,
          density_g_per_ml: food.density_g_per_ml,
          last_amount: food.last_amount ?? null,
          source: food.source ?? null,
        })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }

      setFavorites((items) => [
        {
          fav_id: (data as { id: string }).id,
          id: food.id ?? null,
          name: food.name,
          brand: food.brand,
          barcode: food.barcode,
          serving_g: food.serving_g,
          serving_label: food.serving_label ?? null,
          kcal_per_100g: food.kcal_per_100g,
          protein_per_100g: food.protein_per_100g,
          carbs_per_100g: food.carbs_per_100g,
          fat_per_100g: food.fat_per_100g,
          unit: food.unit,
          density_g_per_ml: food.density_g_per_ml,
          last_amount: food.last_amount ?? null,
          source: food.source ?? null,
        },
        ...items,
      ]);
      toast.success("Als Favorit gespeichert");
    },
    [favIndex, favorites, userId],
  );

  const pickFood = useCallback((food: FoodResult, options?: FoodPickOptions) => {
    setPicking(food);
    setUnit(options?.unit ?? food.unit);
    const preset = piecePresetFor(food);
    if (preset && !options?.amount) {
      setAmountMode("piece");
      setAmountStr("1");
      return;
    }
    setAmountMode("unit");
    setAmountStr(options?.amount ?? "100");
  }, []);

  const changeAmountMode = useCallback(
    (mode: FoodAmountMode) => {
      setAmountMode(mode);
      const preset = picking ? piecePresetFor(picking) : null;
      if (!preset) return;
      const current = parseFoodAmount(amountStr);
      if (mode === "piece") {
        const pieces = current > 0 ? current / preset.grams : 1;
        setAmountStr(String(Math.round(pieces * 10) / 10));
      } else {
        setAmountStr(String(Math.round(piecesToGrams(current, preset))));
      }
    },
    [amountStr, picking],
  );

  const runSearch = useCallback(
    async (overrideQuery?: string) => {
      const term = (overrideQuery ?? query).trim();
      if (!term) {
        setResults([]);
        return;
      }

      setSearching(true);
      try {
        const databaseResults = await searchDbFn({ data: { query: term, limit: 50 } });
        setResults(databaseResults);
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setSearching(false);
      }
    },
    [query, searchDbFn],
  );

  useEffect(() => {
    if (!openMeal || picking) return;
    const term = query.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => runSearch(term), 300);
    return () => clearTimeout(timer);
  }, [openMeal, picking, query, runSearch]);

  useEffect(() => {
    if (!openMeal || picking || !userId) return;
    setLoadingFavorites(true);
    reloadFavorites().finally(() => setLoadingFavorites(false));
  }, [openMeal, picking, reloadFavorites, userId]);

  useEffect(() => {
    if (!openMeal || picking || !userId) return;
    let cancelled = false;

    void (async () => {
      setLoadingRecent(true);
      const { data } = await supabase
        .from("food_entries")
        .select(
          "food_id, name, brand, barcode, serving_g, serving_amount, amount_unit, kcal, protein_g, carbs_g, fat_g, source, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;

      const seen = new Set<string>();
      const recent: RecentFood[] = [];
      for (const row of (data ?? []) as Array<{
        food_id: string | null;
        name: string;
        brand: string | null;
        barcode: string | null;
        serving_g: number;
        serving_amount: number;
        amount_unit: FoodUnit;
        kcal: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        source: string | null;
      }>) {
        const key = `${row.barcode || row.name}|${row.brand ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const servingAmount = Number(row.serving_amount) || Number(row.serving_g) || 0;
        if (servingAmount <= 0) continue;
        const factor = 100 / servingAmount;
        // Der gespeicherte Tracking-Eintrag bleibt unverändert; nur der daraus
        // abgeleitete Wiederverwendungs-Vorschlag wird plausibilisiert.
        const energy = checkFoodEnergy({
          kcal_per_100g: Number(row.kcal) * factor,
          protein_per_100g: Number(row.protein_g) * factor,
          carbs_per_100g: Number(row.carbs_g) * factor,
          fat_per_100g: Number(row.fat_g) * factor,
        });
        recent.push({
          id: row.food_id,
          name: row.name,
          brand: row.brand == null ? null : String(row.brand),
          barcode: row.barcode,
          serving_g: null,
          serving_label: null,
          unit: row.amount_unit === "ml" ? "ml" : "g",
          density_g_per_ml:
            row.amount_unit === "ml" && Number(row.serving_g) > 0
              ? Number(row.serving_g) / servingAmount
              : null,
          kcal_per_100g: energy.kcal_per_100g,
          protein_per_100g: Number(row.protein_g) * factor,
          carbs_per_100g: Number(row.carbs_g) * factor,
          fat_per_100g: Number(row.fat_g) * factor,
          last_amount: servingAmount,
          source: (row.source as FoodResult["source"]) ?? null,
          energy_flagged: energy.flagged,
          energy_note: energy.reason,
        });

        if (recent.length >= 15) break;
      }
      setRecentFoods(recent);
      setLoadingRecent(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [entryCount, openMeal, picking, userId]);

  useEffect(() => {
    if (!openMeal || picking || !userId) return;
    let cancelled = false;
    setLoadingMeals(true);
    listCustomMealsFn({ data: {} })
      .then((rows) => {
        if (!cancelled) setCustomMeals(rows ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingMeals(false);
      });
    return () => {
      cancelled = true;
    };
  }, [builderOpen, listCustomMealsFn, openMeal, picking, userId]);

  const openAddDialog = useCallback((meal: Meal) => {
    setOpenMeal(meal);
    setQuery("");
    setResults([]);
    setPicking(null);
    setSource("food");
  }, []);

  const closeAddDialog = useCallback(() => {
    setOpenMeal(null);
    setPicking(null);
    setPickingMeal(null);
  }, []);

  const pickCustomMeal = useCallback((meal: CustomMeal) => {
    setPickingMeal(meal);
    let suggested = "1";
    try {
      const stored = window.localStorage.getItem(LAST_PORTION_KEY);
      if (stored && parsePortionFactor(stored) > 0) suggested = stored;
    } catch {
      /* ignore storage errors */
    }
    setPortionStr(suggested);
  }, []);

  const addCustomMeal = useCallback(async () => {
    const meal = pickingMeal;
    if (!meal || !openMeal || !userId) return;
    const factor = parsePortionFactor(portionStr);
    if (factor <= 0) {
      toast.error("Bitte eine gültige Portionsmenge eingeben");
      return;
    }
    const scaled = scaleCustomMeal(meal, factor);
    setSavingMeal(true);
    const payload = {
      user_id: userId,
      entry_date: date,
      meal: openMeal,
      name: customMealEntryName(meal, factor),
      food_id: null,
      serving_amount: scaled.serving_g > 0 ? scaled.serving_g : Math.round(factor * 100),
      amount_unit: "g",
      serving_g: scaled.serving_g > 0 ? scaled.serving_g : Math.round(factor * 100),
      kcal: scaled.kcal,
      protein_g: scaled.protein_g,
      carbs_g: scaled.carbs_g,
      fat_g: scaled.fat_g,
      source: `custom:${meal.id}`,
    };
    const { data: row, error } = await supabase
      .from("food_entries")
      .insert(payload)
      .select(
        "id, food_id, meal, name, brand, serving_amount, amount_unit, serving_g, kcal, protein_g, carbs_g, fat_g, source",
      )
      .single();
    setSavingMeal(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    try {
      window.localStorage.setItem(LAST_PORTION_KEY, formatPortionFactor(factor));
    } catch {
      /* ignore storage errors */
    }
    setEntries((entries) => [...entries, row as FoodEntry]);
    setPickingMeal(null);
    setOpenMeal(null);
    clearFormDraft(draftKey);
    toast.success("Mahlzeit hinzugefügt");
  }, [date, draftKey, openMeal, pickingMeal, portionStr, setEntries, userId]);


  const handleBarcode = useCallback(
    async (code: string) => {
      setScannerOpen(false);
      try {
        const food = await lookupFn({ data: { barcode: code } });
        pickFood(food);
      } catch (error) {
        toast.error((error as Error).message);
      }
    },
    [lookupFn, pickFood],
  );

  const estimateAi = useCallback(
    async (overrideQuery?: string) => {
      const term = (overrideQuery ?? query).trim();
      if (!term) {
        toast.error("Bitte Lebensmittel eingeben");
        return;
      }
      setEstimatingAi(true);
      try {
        const food = await estimateFn({ data: { query: term } });
        pickFood(food);
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setEstimatingAi(false);
      }
    },
    [estimateFn, pickFood, query],
  );

  const addPicked = useCallback(async () => {
    if (!picking || !openMeal || !userId) return;
    const amount = parseFoodAmount(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Bitte gültige Menge eingeben");
      return;
    }

    if (unit !== picking.unit) {
      toast.error(`Dieses Lebensmittel wird ausschließlich in ${picking.unit} geführt.`);
      return;
    }
    const preset = piecePresetFor(picking);
    const pieceMode = amountMode === "piece" && preset !== null;
    const displayAmount = pieceMode && preset ? piecesToGrams(amount, preset) : amount;
    const grams = amountInGrams(picking, unit, displayAmount);
    const factor = nutritionFactorForAmount(displayAmount);
    const payload = {
      user_id: userId,
      entry_date: date,
      meal: openMeal,
      food_id: picking.id ?? null,
      name: picking.name,
      brand: picking.brand,
      barcode: picking.barcode,
      serving_amount: +displayAmount.toFixed(1),
      amount_unit: unit,
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
      .select(
        "id, food_id, meal, name, brand, serving_amount, amount_unit, serving_g, kcal, protein_g, carbs_g, fat_g, source",
      )
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }

    setEntries((entries) => [...entries, data as FoodEntry]);
    setPicking(null);
    setQuery("");
    setResults([]);
    setOpenMeal(null);
    clearFormDraft(draftKey);
    toast.success("Eintrag hinzugefügt");
  }, [amountMode, amountStr, date, draftKey, openMeal, picking, setEntries, unit, userId]);

  return {
    openMeal,
    query,
    searching,
    results,
    picking,
    unit,
    amountStr,
    amountMode,
    setAmountMode: changeAmountMode,
    scannerOpen,
    photoOpen,
    builderOpen,
    recentFoods,
    loadingRecent,
    favorites,
    loadingFavorites,
    source,
    customMeals,
    loadingMeals,
    pickingMeal,
    portionStr,
    savingMeal,
    setPortionStr,
    pickCustomMeal,
    backToMeals: () => setPickingMeal(null),

    estimatingAi,
    estimateAi,
    setQuery,
    setSource,
    setUnit,
    setAmountStr,
    openAddDialog,
    closeAddDialog,
    pickFood,
    backToSearch: () => setPicking(null),
    runSearch,
    toggleFavorite,
    isFavorite,
    addCustomMeal,
    addPicked,
    openScanner: () => setScannerOpen(true),
    closeScanner: () => setScannerOpen(false),
    handleBarcode,
    openPhoto: () => setPhotoOpen(true),
    closePhoto: () => setPhotoOpen(false),
    openBuilder: () => setBuilderOpen(true),
    closeBuilder: () => setBuilderOpen(false),
    onPhotoTracked: reloadEntries,
  };
}
