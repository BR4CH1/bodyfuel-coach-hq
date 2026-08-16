import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { getDayType, setDayType, type DayType } from "@/lib/nutrition.functions";
import { getNutritionTrackerTargets } from "@/lib/nutrition-tracker-targets.functions";
import {
  getBullsDailyNutritionTargets,
  setBullsDayType,
  type BullsDayType,
} from "@/lib/performance-nutrition/bulls-nutrition.functions";
import { DEFAULT_TARGETS } from "../constants";
import { calculateNutritionTotals, todayIso } from "../lib/nutrition-tracker.logic";
import type { FoodEntry, NutritionTargets } from "../types";
import { useAddFoodFlow } from "./useAddFoodFlow";

type NutritionTrackerVariant = "personal" | "bulls";

export function useNutritionTracker(variant: NutritionTrackerVariant) {
  const { supabaseUser, isCoach } = useSession();
  const userId = supabaseUser?.id;
  const isBulls = variant === "bulls";

  const [date, setDate] = useState(() => todayIso());
  const [baseNutritionTargets, setBaseNutritionTargets] =
    useState<NutritionTargets>(DEFAULT_TARGETS);
  const [restNutritionTargets, setRestNutritionTargets] = useState<NutritionTargets | null>(null);
  const [dayType, setDayTypeState] = useState<DayType | BullsDayType>("training");
  const [dayTypeSource, setDayTypeSource] = useState<"manual" | "auto">("auto");
  const [savingDayType, setSavingDayType] = useState(false);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [loading, setLoading] = useState(true);

  const getNutritionTargetsFn = useServerFn(getNutritionTrackerTargets);
  const getDayTypeFn = useServerFn(getDayType);
  const setDayTypeFn = useServerFn(setDayType);
  const getBullsNutritionTargetsFn = useServerFn(getBullsDailyNutritionTargets);
  const setBullsDayTypeFn = useServerFn(setBullsDayType);

  const targets =
    dayType === "rest" && restNutritionTargets ? restNutritionTargets : baseNutritionTargets;
  const totals = useMemo(() => calculateNutritionTotals(entries), [entries]);

  const reloadEntries = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("food_entries")
      .select(
        "id, food_id, meal, name, brand, serving_amount, amount_unit, serving_g, kcal, protein_g, carbs_g, fat_g, source",
      )
      .eq("user_id", userId)
      .eq("entry_date", date)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setEntries((data as FoodEntry[]) ?? []);
  }, [date, userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const [entriesResult, waterResult] = await Promise.all([
          supabase
            .from("food_entries")
            .select(
              "id, food_id, meal, name, brand, serving_amount, amount_unit, serving_g, kcal, protein_g, carbs_g, fat_g, source",
            )
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
          const bulls = await getBullsNutritionTargetsFn({ data: { date } });
          if (cancelled) return;
          setBaseNutritionTargets(
            bulls.targets
              ? {
                  kcal: bulls.targets.kcal,
                  protein_g: bulls.targets.protein_g,
                  carbs_g: bulls.targets.carbs_g,
                  fat_g: bulls.targets.fat_g,
                  water_glasses: DEFAULT_TARGETS.water_glasses,
                }
              : DEFAULT_TARGETS,
          );
          setRestNutritionTargets(null);
          setDayTypeState(bulls.dayType);
          setDayTypeSource(bulls.dayTypeSource);
        } else {
          const [nutritionTargets, resolvedDayType] = await Promise.all([
            getNutritionTargetsFn({ data: { user_id: userId, date } }),
            getDayTypeFn({ data: { user_id: userId, date } }),
          ]);
          if (cancelled) return;

          if (nutritionTargets) {
            setBaseNutritionTargets({
              kcal: nutritionTargets.kcal,
              protein_g: nutritionTargets.protein_g,
              carbs_g: nutritionTargets.carbs_g,
              fat_g: nutritionTargets.fat_g,
              water_glasses: nutritionTargets.water_glasses,
            });
            setRestNutritionTargets(
              nutritionTargets.kcal_rest != null
                ? {
                    kcal: nutritionTargets.kcal_rest,
                    protein_g: nutritionTargets.protein_g_rest ?? nutritionTargets.protein_g,
                    carbs_g: nutritionTargets.carbs_g_rest ?? nutritionTargets.carbs_g,
                    fat_g: nutritionTargets.fat_g_rest ?? nutritionTargets.fat_g,
                    water_glasses: nutritionTargets.water_glasses,
                  }
                : null,
            );
          }
          setDayTypeState(resolvedDayType.kind);
          setDayTypeSource(resolvedDayType.source);
        }

        if (cancelled) return;
        if (entriesResult.error) toast.error(entriesResult.error.message);
        if (waterResult.error) toast.error(waterResult.error.message);
        setEntries(((entriesResult.data as FoodEntry[]) ?? []).map((entry) => ({ ...entry })));
        setWaterGlasses(waterResult.data?.glasses ?? 0);
      } catch (error) {
        if (!cancelled) toast.error((error as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date, getBullsNutritionTargetsFn, getDayTypeFn, getNutritionTargetsFn, isBulls, userId]);

  const refreshBullsTargets = useCallback(async () => {
    const bulls = await getBullsNutritionTargetsFn({ data: { date } });
    if (bulls.targets) {
      setBaseNutritionTargets({
        kcal: bulls.targets.kcal,
        protein_g: bulls.targets.protein_g,
        carbs_g: bulls.targets.carbs_g,
        fat_g: bulls.targets.fat_g,
        water_glasses: DEFAULT_TARGETS.water_glasses,
      });
    }
    setDayTypeState(bulls.dayType);
    setDayTypeSource(bulls.dayTypeSource);
  }, [date, getBullsNutritionTargetsFn]);

  const toggleDayType = useCallback(async () => {
    if (!userId) return;
    setSavingDayType(true);
    setDayTypeSource("manual");
    try {
      if (isBulls) {
        const next: BullsDayType = dayType === "rest" ? "football_training" : "rest";
        setDayTypeState(next);
        await setBullsDayTypeFn({ data: { date, kind: next } });
        await refreshBullsTargets();
      } else {
        const next: DayType = dayType === "training" ? "rest" : "training";
        setDayTypeState(next);
        await setDayTypeFn({ data: { user_id: userId, date, kind: next } });
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingDayType(false);
    }
  }, [date, dayType, isBulls, refreshBullsTargets, setBullsDayTypeFn, setDayTypeFn, userId]);

  const resetDayType = useCallback(async () => {
    if (!userId) return;
    setSavingDayType(true);
    try {
      if (isBulls) {
        await setBullsDayTypeFn({ data: { date, kind: null } });
        await refreshBullsTargets();
      } else {
        await setDayTypeFn({ data: { user_id: userId, date, kind: null } });
        const resolved = await getDayTypeFn({ data: { user_id: userId, date } });
        setDayTypeState(resolved.kind);
        setDayTypeSource(resolved.source);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingDayType(false);
    }
  }, [date, getDayTypeFn, isBulls, refreshBullsTargets, setBullsDayTypeFn, setDayTypeFn, userId]);

  useEffect(() => {
    if (loading || !userId) return;

    void (async () => {
      const { data: row } = await supabase
        .from("daily_checks")
        .select("id, tasks")
        .eq("user_id", userId)
        .eq("check_date", date)
        .maybeSingle();
      const tasks = (row?.tasks as Record<string, boolean>) ?? {};
      const updated = {
        ...tasks,
        protein: totals.protein_g >= targets.protein_g,
        water: waterGlasses >= targets.water_glasses,
      };
      const pointsByTask: Record<string, number> = {
        protein: 3,
        water: 2,
        fruitsVeg: 2,
        steps: 2,
        training: 3,
        sleep: 2,
        recovery: 1,
      };
      const points = Object.entries(updated).reduce(
        (sum, [task, complete]) => sum + (complete ? (pointsByTask[task] ?? 0) : 0),
        0,
      );
      await supabase
        .from("daily_checks")
        .upsert(
          { user_id: userId, check_date: date, tasks: updated, points },
          { onConflict: "user_id,check_date" },
        );
    })();
  }, [
    date,
    loading,
    targets.protein_g,
    targets.water_glasses,
    totals.protein_g,
    userId,
    waterGlasses,
  ]);

  const removeEntry = useCallback(
    async (id: string) => {
      const previous = entries;
      setEntries((current) => current.filter((entry) => entry.id !== id));
      const { error } = await supabase.from("food_entries").delete().eq("id", id);
      if (error) {
        setEntries(previous);
        toast.error(error.message);
      }
    },
    [entries],
  );

  const updateWater = useCallback(
    async (next: number) => {
      if (!userId) return;
      const value = Math.max(0, Math.min(40, next));
      const previous = waterGlasses;
      setWaterGlasses(value);
      const { error } = await supabase
        .from("water_logs")
        .upsert(
          { user_id: userId, entry_date: date, glasses: value },
          { onConflict: "user_id,entry_date" },
        );
      if (error) {
        setWaterGlasses(previous);
        toast.error(error.message);
      }
    },
    [date, userId, waterGlasses],
  );

  const addFood = useAddFoodFlow({
    userId,
    date,
    entryCount: entries.length,
    setEntries,
    reloadEntries,
  });

  return {
    userId,
    isCoach,
    isBulls,
    date,
    setDate,
    isToday: date === todayIso(),
    baseNutritionTargets,
    restNutritionTargets,
    dayType,
    dayTypeSource,
    savingDayType,
    targets,
    entries,
    totals,
    waterGlasses,
    loading,
    toggleDayType,
    resetDayType,
    removeEntry,
    updateWater,
    addFood,
  };
}
