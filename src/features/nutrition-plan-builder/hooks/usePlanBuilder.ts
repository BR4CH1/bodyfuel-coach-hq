import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getCustomerPlanContext,
  listMealLibrary,
  loadNutritionPlanForBuilder,
  saveBuilderPartnerPlan,
  saveBuilderPlan,
  type BuilderDay,
  type LibraryMeal,
} from "@/lib/plan-builder.functions";
import { generateMealImage, type MealImageStatus } from "@/lib/meal-images.functions";
import { getPartnerLink } from "@/lib/partner.functions";
import {
  addDays,
  autoFillWeekImpl,
  autoFillWeekPairImpl,
  buildBuilderDays,
  cloneBuilderDays,
  isoDate,
  rebalanceDay,
  remapMealsForCopy,
  targetsFor,
  type AutoFillMode,
  type MacroValues,
  type SharedSlotsMap,
} from "@/features/nutrition-plan-builder/lib/plan-builder.logic";
import {
  createNutritionResolver,
  normalizeTargets,
  optimizeDayToTargets,
  summarizeChanges,
  type OptimizationChange,
} from "@/features/nutrition-plan-builder/lib/macro-optimizer";
import type { TargetScope } from "@/features/nutrition-plan-builder/components/MacroTargetEditorDialog";
import { resolveIngredientNutrition } from "@/lib/ingredient-nutrition.functions";
import { clearFormDraft, useFormDraft } from "@/hooks/use-form-draft";


type UsePlanBuilderParams = {
  userId: string;
  planId?: string;
  returnOrgId?: string;
};

type UndoSnapshot = {
  client: BuilderDay[];
  partner: BuilderDay[] | null;
};

const DEFAULT_SHARED_SLOTS: SharedSlotsMap = {
  breakfast: false,
  lunch: false,
  dinner: true,
  snack: false,
};
const EMPTY_WEEKDAYS: number[] = [];

export function usePlanBuilder({ userId, planId, returnOrgId }: UsePlanBuilderParams) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listLibrary = useServerFn(listMealLibrary);
  const getContext = useServerFn(getCustomerPlanContext);
  const savePlan = useServerFn(saveBuilderPlan);
  const savePartnerPlan = useServerFn(saveBuilderPartnerPlan);
  const getPartner = useServerFn(getPartnerLink);
  const loadPlan = useServerFn(loadNutritionPlanForBuilder);
  const generateLibraryImage = useServerFn(generateMealImage);
  const resolveNutrition = useServerFn(resolveIngredientNutrition);
  const requestedLibraryImages = useRef(new Set<string>());
  const restoredDraft = useRef(false);

  const libraryQuery = useQuery({
    queryKey: ["meal-library"],
    queryFn: () => listLibrary(),
  });
  const contextQuery = useQuery({
    queryKey: ["plan-ctx", userId],
    queryFn: () => getContext({ data: { customerId: userId } }),
  });
  const loadedPlanQuery = useQuery({
    queryKey: ["plan-builder-load", planId],
    queryFn: () => loadPlan({ data: { planId: planId! } }),
    enabled: Boolean(planId),
  });
  const partnerLinkQuery = useQuery({
    queryKey: ["plan-builder-partner", userId],
    queryFn: () => getPartner({ data: { user_id: userId } }),
  });

  const today = useMemo(() => isoDate(new Date()), []);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 6));
  const [title, setTitle] = useState("Wochenplan");
  const [saving, setSaving] = useState(false);
  const [weekConfirmOpen, setWeekConfirmOpen] = useState(false);
  const [weekMode, setWeekMode] = useState<AutoFillMode>("empty_only");
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const [loadedPlanApplied, setLoadedPlanApplied] = useState(false);
  const [partnerMode, setPartnerMode] = useState(false);
  const [sharedSlots, setSharedSlots] = useState<SharedSlotsMap>(DEFAULT_SHARED_SLOTS);
  const [days, setDays] = useState<BuilderDay[]>([]);
  const [partnerDays, setPartnerDays] = useState<BuilderDay[]>([]);
  const [copyChoiceIdx, setCopyChoiceIdx] = useState<number | null>(null);
  const draftKey = useMemo(
    () => `bf.planBuilder.draft.${userId}.${planId ?? "new"}`,
    [userId, planId],
  );

  const partnerId = partnerLinkQuery.data?.partner_id ?? null;
  const partnerName = partnerLinkQuery.data?.partner_name ?? "Partner";

  useFormDraft(
    draftKey,
    { title, startDate, endDate, partnerMode, sharedSlots, days, partnerDays },
    (draft) => {
      restoredDraft.current = true;
      if (typeof draft.title === "string") setTitle(draft.title);
      if (typeof draft.startDate === "string") setStartDate(draft.startDate);
      if (typeof draft.endDate === "string") setEndDate(draft.endDate);
      if (typeof draft.partnerMode === "boolean") setPartnerMode(draft.partnerMode);
      if (draft.sharedSlots) setSharedSlots(draft.sharedSlots);
      if (Array.isArray(draft.days)) setDays(draft.days);
      if (Array.isArray(draft.partnerDays)) setPartnerDays(draft.partnerDays);
    },
  );

  useEffect(() => {
    setPartnerMode(Boolean(partnerId));
  }, [partnerId]);

  const partnerContextQuery = useQuery({
    queryKey: ["plan-ctx", partnerId],
    queryFn: () => getContext({ data: { customerId: partnerId! } }),
    enabled: Boolean(partnerId && partnerMode),
  });

  const numDays = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00Z`).getTime();
    const end = new Date(`${endDate}T00:00:00Z`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
    return Math.min(28, Math.max(1, Math.round((end - start) / 86_400_000) + 1));
  }, [startDate, endDate]);

  const trainingWeekdays = contextQuery.data?.trainingWeekdays ?? EMPTY_WEEKDAYS;
  const partnerTrainingWeekdays = partnerContextQuery.data?.trainingWeekdays ?? EMPTY_WEEKDAYS;

  useEffect(() => {
    setDays((previous) => buildBuilderDays(previous, startDate, numDays, trainingWeekdays));
    if (partnerMode) {
      setPartnerDays((previous) =>
        buildBuilderDays(previous, startDate, numDays, partnerTrainingWeekdays),
      );
    }
  }, [startDate, numDays, trainingWeekdays, partnerTrainingWeekdays, partnerMode]);

  useEffect(() => {
    if (!planId || !loadedPlanQuery.data || loadedPlanApplied || restoredDraft.current) return;
    setTitle(loadedPlanQuery.data.title);
    setStartDate(loadedPlanQuery.data.startDate);
    setEndDate(loadedPlanQuery.data.endDate);
    setDays(loadedPlanQuery.data.days);
    setLoadedPlanApplied(true);
  }, [planId, loadedPlanQuery.data, loadedPlanApplied]);

  const goBack = () => {
    if (returnOrgId) {
      navigate({
        to: "/coach/teams/$orgId/athletes/$userId",
        params: { orgId: returnOrgId, userId },
      });
      return;
    }
    navigate({ to: "/coach/customers/$userId", params: { userId } });
  };

  const setDay = (index: number, update: (day: BuilderDay) => BuilderDay) => {
    setDays((previous) =>
      previous.map((day, currentIndex) => (currentIndex === index ? update(day) : day)),
    );
  };

  const setPartnerDay = (index: number, update: (day: BuilderDay) => BuilderDay) => {
    setPartnerDays((previous) =>
      previous.map((day, currentIndex) => (currentIndex === index ? update(day) : day)),
    );
  };

  const ensureLibraryMealImage = useCallback(
    (mealId: string) => {
      if (requestedLibraryImages.current.has(mealId)) return;
      const currentLibrary = queryClient.getQueryData<LibraryMeal[]>(["meal-library"]) ?? [];
      const currentMeal = currentLibrary.find((meal) => meal.id === mealId);
      if (!currentMeal || currentMeal.image_url) return;

      requestedLibraryImages.current.add(mealId);
      queryClient.setQueryData<LibraryMeal[]>(["meal-library"], (previous = []) =>
        previous.map((meal) =>
          meal.id === mealId ? { ...meal, image_status: "generating" } : meal,
        ),
      );

      void generateLibraryImage({
        data: { target: "library_meal", meal_id: mealId, force: false },
      })
        .then((result) => {
          const status: MealImageStatus =
            result.status === "generated" ||
            result.status === "cached" ||
            result.status === "preserved"
              ? "ready"
              : result.status === "fallback"
                ? "fallback"
                : "failed";
          queryClient.setQueryData<LibraryMeal[]>(["meal-library"], (previous = []) =>
            previous.map((meal) =>
              meal.id === mealId
                ? { ...meal, image_url: result.image_url ?? null, image_status: status }
                : meal,
            ),
          );
        })
        .catch(() => {
          queryClient.setQueryData<LibraryMeal[]>(["meal-library"], (previous = []) =>
            previous.map((meal) =>
              meal.id === mealId ? { ...meal, image_status: "failed" } : meal,
            ),
          );
        });
    },
    [generateLibraryImage, queryClient],
  );

  const handleSave = async (publish: boolean) => {
    try {
      setSaving(true);
      if (partnerMode && partnerId) {
        await savePartnerPlan({
          data: {
            customerId: userId,
            partnerId,
            title,
            startDate,
            clientDays: days,
            partnerDays,
            publish,
          },
        });
      } else {
        await savePlan({
          data: { customerId: userId, title, startDate, days, publish },
        });
      }
      toast.success(publish ? "Plan veröffentlicht" : "Plan als Entwurf gespeichert");
      clearFormDraft(draftKey);
      goBack();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const copyClientDay = (index: number) => {
    const context = contextQuery.data;
    const library = libraryQuery.data ?? [];
    if (!context) return;

    setDays((previous) => {
      if (index + 1 >= previous.length) return previous;
      const source = previous[index];
      const next = [...previous];
      const partnerGroupMap = new Map<string, string>();
      const prepGroupMap = new Map<string, string>();
      const copiedMeals = remapMealsForCopy(source.meals, partnerGroupMap, prepGroupMap).map(
        (meal) => ({ ...meal, linked_partner_group: null }),
      );

      next[index + 1] = rebalanceDay(
        {
          ...next[index + 1],
          prepCoupleLunchDinner: source.prepCoupleLunchDinner,
          meals: copiedMeals,
        },
        context,
        library,
      );
      return next;
    });
  };

  const copyPartnerDay = (index: number) => {
    const context = partnerContextQuery.data;
    const library = libraryQuery.data ?? [];
    if (!context) return;

    setPartnerDays((previous) => {
      if (index + 1 >= previous.length) return previous;
      const source = previous[index];
      const next = [...previous];
      const partnerGroupMap = new Map<string, string>();
      const prepGroupMap = new Map<string, string>();
      const copiedMeals = remapMealsForCopy(source.meals, partnerGroupMap, prepGroupMap).map(
        (meal) => ({ ...meal, linked_partner_group: null }),
      );

      next[index + 1] = rebalanceDay(
        {
          ...next[index + 1],
          prepCoupleLunchDinner: source.prepCoupleLunchDinner,
          meals: copiedMeals,
        },
        context,
        library,
      );
      return next;
    });
  };

  const copyDayPair = (index: number) => {
    const clientContext = contextQuery.data;
    const partnerContext = partnerContextQuery.data;
    const library = libraryQuery.data ?? [];
    if (!clientContext || !partnerContext || index + 1 >= days.length) return;

    const partnerGroupMap = new Map<string, string>();
    const clientPrepGroupMap = new Map<string, string>();
    const partnerPrepGroupMap = new Map<string, string>();
    const sourceClient = days[index];
    const sourcePartner = partnerDays[index];
    if (!sourceClient || !sourcePartner) return;

    const remappedClient = remapMealsForCopy(
      sourceClient.meals,
      partnerGroupMap,
      clientPrepGroupMap,
    );
    const remappedPartner = remapMealsForCopy(
      sourcePartner.meals,
      partnerGroupMap,
      partnerPrepGroupMap,
    );

    setDays((previous) => {
      const next = [...previous];
      next[index + 1] = rebalanceDay(
        {
          ...next[index + 1],
          prepCoupleLunchDinner: sourceClient.prepCoupleLunchDinner,
          meals: remappedClient,
        },
        clientContext,
        library,
      );
      return next;
    });
    setPartnerDays((previous) => {
      const next = [...previous];
      next[index + 1] = rebalanceDay(
        {
          ...next[index + 1],
          prepCoupleLunchDinner: sourcePartner.prepCoupleLunchDinner,
          meals: remappedPartner,
        },
        partnerContext,
        library,
      );
      return next;
    });
  };

  const runAutoFillWeek = (mode: AutoFillMode) => {
    const context = contextQuery.data;
    const library = libraryQuery.data ?? [];
    if (!context) return;

    setUndoSnapshot({
      client: cloneBuilderDays(days),
      partner: partnerMode ? cloneBuilderDays(partnerDays) : null,
    });

    let missingCount = 0;
    if (partnerMode && partnerContextQuery.data) {
      const result = autoFillWeekPairImpl(
        days,
        partnerDays,
        context,
        partnerContextQuery.data,
        library,
        mode,
        sharedSlots,
      );
      missingCount += result.missing;
      setDays(result.clientDays);
      setPartnerDays(result.partnerDays);
    } else {
      const result = autoFillWeekImpl(days, context, library, mode);
      missingCount += result.missing;
      setDays(result.days);
    }

    if (missingCount > 0) {
      toast.warning(
        `${missingCount} Slots ohne passenden Vorschlag. Für diese Slots wurde keine passende Mahlzeit gefunden. Bitte Mahlzeitendatenbank erweitern oder Filter prüfen.`,
      );
    } else {
      toast.success("Woche automatisch gefüllt");
    }
  };

  const undoWeekFill = () => {
    if (!undoSnapshot) return;
    setDays(undoSnapshot.client);
    if (undoSnapshot.partner) setPartnerDays(undoSnapshot.partner);
    setUndoSnapshot(null);
    toast.success("Rückgängig gemacht");
  };

  // ---- Makro-Ziel-Editor -------------------------------------------------
  const dayMatchesScope = (day: BuilderDay, index: number, scope: TargetScope, dayIndex: number) =>
    scope === "all" ||
    (scope === "day" && index === dayIndex) ||
    (scope === "training" && day.type === "training") ||
    (scope === "rest" && day.type === "rest");

  const applyTargetsTo = async (
    side: "client" | "partner",
    dayIndex: number,
    rawTargets: MacroValues,
    scope: TargetScope,
    adjustMeals: boolean,
  ) => {
    const context = side === "client" ? contextQuery.data : partnerContextQuery.data;
    const sourceDays = side === "client" ? days : partnerDays;
    const setSide = side === "client" ? setDays : setPartnerDays;
    if (!context) return;

    const targets = normalizeTargets(rawTargets);
    setUndoSnapshot({
      client: cloneBuilderDays(days),
      partner: partnerMode ? cloneBuilderDays(partnerDays) : null,
    });

    if (!adjustMeals) {
      setSide((previous) =>
        previous.map((day, index) =>
          dayMatchesScope(day, index, scope, dayIndex) ? { ...day, customTargets: targets } : day,
        ),
      );
      toast.success("Tagesziele übernommen");
      return;
    }

    setTargetsBusy(true);
    try {
      const affected = sourceDays.filter((day, index) =>
        dayMatchesScope(day, index, scope, dayIndex),
      );
      const names = Array.from(
        new Set(
          affected.flatMap((day) =>
            day.meals.flatMap((meal) =>
              (meal.ingredients ?? []).map((ingredient) => ingredient.name).filter(Boolean),
            ),
          ),
        ),
      );
      let resolved: Record<string, { kcal: number; protein_g: number; carbs_g: number; fat_g: number }> =
        {};
      if (names.length) {
        try {
          resolved = await resolveNutrition({ data: { names } });
        } catch {
          // Fallback-Tabelle übernimmt, wenn die Datenbank nicht erreichbar ist.
        }
      }
      const resolve = createNutritionResolver(resolved);
      const library = libraryQuery.data ?? [];
      const changes: OptimizationChange[] = [];
      let missedTolerance = 0;

      const nextDays = sourceDays.map((day, index) => {
        if (!dayMatchesScope(day, index, scope, dayIndex)) return day;
        const result = optimizeDayToTargets({
          day: { ...day, customTargets: targets },
          target: targets,
          ctx: context,
          library,
          resolve,
        });
        changes.push(...result.changes);
        if (!result.withinTolerance) missedTolerance += 1;
        return result.day;
      });

      setSide(nextDays);

      const summary = summarizeChanges(changes);
      if (summary.length === 0) {
        toast.info("Ziele übernommen — keine Anpassung der Gerichte nötig.");
      } else {
        toast.success(
          `Ziele übernommen: ${summary.slice(0, 4).join(", ")}${summary.length > 4 ? ` und ${summary.length - 4} weitere` : ""}`,
        );
      }
      if (missedTolerance > 0) {
        toast.warning(
          `${missedTolerance} Tag(e) konnten nicht vollständig ins Ziel gebracht werden. Bitte Gerichte oder Ziele prüfen.`,
        );
      }
    } finally {
      setTargetsBusy(false);
    }
  };

  const resetTargetsFor = (side: "client" | "partner", dayIndex: number, scope: TargetScope) => {
    const setSide = side === "client" ? setDays : setPartnerDays;
    setSide((previous) =>
      previous.map((day, index) =>
        dayMatchesScope(day, index, scope, dayIndex) ? { ...day, customTargets: null } : day,
      ),
    );
    toast.success("Profilziele wieder aktiv");
  };



  return {
    title,
    setTitle,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    saving,
    weekConfirmOpen,
    setWeekConfirmOpen,
    weekMode,
    setWeekMode,
    undoSnapshot,
    partnerId,
    partnerName,
    partnerMode,
    setPartnerMode,
    sharedSlots,
    setSharedSlots,
    days,
    partnerDays,
    copyChoiceIdx,
    setCopyChoiceIdx,
    library: libraryQuery.data ?? [],
    customerContext: contextQuery.data,
    partnerContext: partnerContextQuery.data,
    isLoading: libraryQuery.isLoading || contextQuery.isLoading,
    libraryError: libraryQuery.error,
    goBack,
    setDay,
    setPartnerDay,
    handleSave,
    copyClientDay,
    copyPartnerDay,
    copyDayPair,
    runAutoFillWeek,
    undoWeekFill,
    ensureLibraryMealImage,
  };
}
