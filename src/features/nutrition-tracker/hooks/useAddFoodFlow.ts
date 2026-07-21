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
import { LOCAL_FOODS } from "@/lib/bodyfuel/localFoods";
import { listCustomMeals, type CustomMeal } from "@/lib/custom-meals.functions";
import {
  estimateFoodFromText,
  lookupBarcode,
  searchFoods,
  searchFoodsDb,
  type FoodResult,
} from "@/lib/nutrition.functions";
import {
  amountInGrams,
  compactFoodSearchTerm,
  favoriteKey,
  localFoodMatches,
  parseFoodAmount,
} from "../lib/nutrition-tracker.logic";
import type {
  AddFoodSource,
  FavoriteCandidate,
  FavoriteFood,
  FoodEntry,
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
  const [aiEstimating, setAiEstimating] = useState(false);

  const listCustomMealsFn = useServerFn(listCustomMeals);
  const searchFn = useServerFn(searchFoods);
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
    if (draft.unit === "g" || draft.unit === "piece") setUnit(draft.unit);
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
        "id, name, brand, barcode, serving_g, serving_label, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, last_amount_g, image_url",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as Array<{
      id: string;
      name: string;
      brand: string | null;
      barcode: string | null;
      serving_g: number | null;
      serving_label: string | null;
      kcal_per_100g: number;
      protein_per_100g: number;
      carbs_per_100g: number;
      fat_per_100g: number;
      last_amount_g: number | null;
      image_url: string | null;
    }>;

    setFavorites(
      rows.map((row) => ({
        fav_id: row.id,
        name: row.name,
        brand: row.brand,
        barcode: row.barcode,
        serving_g: row.serving_g,
        serving_label: row.serving_label,
        kcal_per_100g: Number(row.kcal_per_100g),
        protein_per_100g: Number(row.protein_per_100g),
        carbs_per_100g: Number(row.carbs_per_100g),
        fat_per_100g: Number(row.fat_per_100g),
        last_amount_g: row.last_amount_g != null ? Number(row.last_amount_g) : null,
        image_url: row.image_url,
      })),
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
          image_url: food.image_url ?? null,
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
          image_url: food.image_url ?? null,
        },
        ...items,
      ]);
      toast.success("Als Favorit gespeichert");
    },
    [favIndex, favorites, userId],
  );

  const pickFood = useCallback((food: FoodResult, options?: FoodPickOptions) => {
    setPicking(food);
    setUnit(options?.unit ?? (food.serving_g ? "piece" : "g"));
    setAmountStr(options?.amount ?? (food.serving_g ? "1" : "100"));
  }, []);

  const runSearch = useCallback(
    async (overrideQuery?: string) => {
      const term = (overrideQuery ?? query).trim();
      if (!term) {
        setResults([]);
        return;
      }

      const local = LOCAL_FOODS.filter(
        (food) =>
          localFoodMatches(food.name, term) ||
          (food.aliases ?? []).some((alias) => localFoodMatches(alias, term)),
      ).map(({ aliases: _aliases, ...food }) => food);
      if (local.length > 0) setResults(local);

      setSearching(true);
      try {
        const [databaseResults, remoteResults] = await Promise.all([
          searchDbFn({ data: { query: term, limit: 15 } }).catch(() => [] as FoodResult[]),
          searchFn({ data: { query: term } }).catch(() => [] as FoodResult[]),
        ]);

        const seen = new Set<string>();
        const merged: FoodResult[] = [];
        for (const food of [...databaseResults, ...local, ...remoteResults]) {
          const key = `${food.barcode || compactFoodSearchTerm(food.name)}|${String(
            food.brand ?? "",
          ).toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(food);
        }
        setResults(merged);
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setSearching(false);
      }
    },
    [query, searchDbFn, searchFn],
  );

  const estimateWithAi = useCallback(async () => {
    const term = query.trim();
    if (!term) return;
    setAiEstimating(true);
    try {
      const result = await estimateFn({ data: { query: term } });
      setResults((items) => [result, ...items]);
      pickFood(result);
      toast.success("Schätzung erstellt – Werte prüfen & speichern.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setAiEstimating(false);
    }
  }, [estimateFn, pickFood, query]);

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
          "name, brand, barcode, serving_g, kcal, protein_g, carbs_g, fat_g, image_url, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;

      const seen = new Set<string>();
      const recent: RecentFood[] = [];
      for (const row of (data ?? []) as Array<{
        name: string;
        brand: string | null;
        barcode: string | null;
        serving_g: number;
        kcal: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        image_url: string | null;
      }>) {
        const key = `${row.barcode || row.name}|${row.brand ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const servingGrams = Number(row.serving_g) || 0;
        if (servingGrams <= 0) continue;
        const factor = 100 / servingGrams;
        recent.push({
          name: row.name,
          brand: row.brand,
          barcode: row.barcode,
          serving_g: null,
          serving_label: null,
          kcal_per_100g: Number(row.kcal) * factor,
          protein_per_100g: Number(row.protein_g) * factor,
          carbs_per_100g: Number(row.carbs_g) * factor,
          fat_per_100g: Number(row.fat_g) * factor,
          last_amount_g: servingGrams,
          image_url: row.image_url,
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
  }, []);

  const addCustomMeal = useCallback(
    async (meal: CustomMeal) => {
      if (!openMeal || !userId) return;
      const payload = {
        user_id: userId,
        entry_date: date,
        meal: openMeal,
        name: meal.name,
        serving_g: 100,
        kcal: Math.round(meal.kcal ?? 0),
        protein_g: meal.protein_g ? +Number(meal.protein_g).toFixed(1) : 0,
        carbs_g: meal.carbs_g ? +Number(meal.carbs_g).toFixed(1) : 0,
        fat_g: meal.fat_g ? +Number(meal.fat_g).toFixed(1) : 0,
        source: `custom:${meal.id}`,
        image_url: meal.image_url,
      };
      const { data: row, error } = await supabase
        .from("food_entries")
        .insert(payload)
        .select("id, meal, name, brand, serving_g, kcal, protein_g, carbs_g, fat_g, source, image_url")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      setEntries((entries) => [...entries, row as FoodEntry]);
      setOpenMeal(null);
      clearFormDraft(draftKey);
      toast.success("Mahlzeit hinzugefügt");
    },
    [date, draftKey, openMeal, setEntries, userId],
  );

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

  const addPicked = useCallback(async () => {
    if (!picking || !openMeal || !userId) return;
    const amount = parseFoodAmount(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Bitte gültige Menge eingeben");
      return;
    }

    const grams = amountInGrams(picking, unit, amount);
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
      image_url: picking.image_url ?? null,
    };
    const { data, error } = await supabase
      .from("food_entries")
      .insert(payload)
      .select("id, meal, name, brand, serving_g, kcal, protein_g, carbs_g, fat_g, source, image_url")
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
  }, [amountStr, date, draftKey, openMeal, picking, setEntries, unit, userId]);

  return {
    openMeal,
    query,
    searching,
    results,
    picking,
    unit,
    amountStr,
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
    aiEstimating,
    setQuery,
    setSource,
    setUnit,
    setAmountStr,
    openAddDialog,
    closeAddDialog,
    pickFood,
    backToSearch: () => setPicking(null),
    runSearch,
    estimateWithAi,
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
