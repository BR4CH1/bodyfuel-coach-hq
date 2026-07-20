import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getCustomerPlanContext,
  listMealLibrary,
  loadNutritionPlanForBuilder,
  saveBuilderPartnerPlan,
  saveBuilderPlan,
  type BuilderDay,
} from "@/lib/plan-builder.functions";
import { getPartnerLink } from "@/lib/partner.functions";
import {
  addDays,
  autoFillDayImpl,
  autoFillDayPair,
  buildBuilderDays,
  cloneBuilderDays,
  isoDate,
  rebalanceDay,
  remapMealsForCopy,
  type AutoFillMode,
  type SharedSlotsMap,
} from "@/features/nutrition-plan-builder/lib/plan-builder.logic";

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
  const listLibrary = useServerFn(listMealLibrary);
  const getContext = useServerFn(getCustomerPlanContext);
  const savePlan = useServerFn(saveBuilderPlan);
  const savePartnerPlan = useServerFn(saveBuilderPartnerPlan);
  const getPartner = useServerFn(getPartnerLink);
  const loadPlan = useServerFn(loadNutritionPlanForBuilder);

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

  const partnerId = partnerLinkQuery.data?.partner_id ?? null;
  const partnerName = partnerLinkQuery.data?.partner_name ?? "Partner";

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
    if (!planId || !loadedPlanQuery.data || loadedPlanApplied) return;
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
      const nextClient: BuilderDay[] = [];
      const nextPartner: BuilderDay[] = [];
      for (let index = 0; index < days.length; index += 1) {
        const pair = autoFillDayPair(
          days[index],
          partnerDays[index],
          context,
          partnerContextQuery.data,
          library,
          mode,
          sharedSlots,
        );
        missingCount += pair.missing;
        nextClient.push(pair.client);
        nextPartner.push(pair.partner);
      }
      setDays(nextClient);
      setPartnerDays(nextPartner);
    } else {
      const nextDays = days.map((day) => {
        const result = autoFillDayImpl(day, context, library, mode);
        missingCount += result.missing.length;
        return result.day;
      });
      setDays(nextDays);
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
  };
}
