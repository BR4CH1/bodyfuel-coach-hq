import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  listMealLibrary,
  getCustomerPlanContext,
  saveBuilderPlan,
  saveBuilderPartnerPlan,
  loadNutritionPlanForBuilder,
  type LibraryMeal,
  type CustomerPlanContext,
  type BuilderDay,
  type BuilderMeal,
} from "@/lib/plan-builder.functions";
import { getPartnerLink } from "@/lib/partner.functions";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users } from "lucide-react";
import {
  ArrowLeft,
  Lock,
  Trash2,
  Copy,
  Minus,
  Plus,
  Shuffle,
  Sparkles,
  Link2,
  Link2Off,
  Undo2,
  Wand2,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Slot = "breakfast" | "lunch" | "dinner" | "snack";
const SLOTS: { key: Slot; label: string }[] = [
  { key: "breakfast", label: "Frühstück" },
  { key: "lunch", label: "Mittagessen" },
  { key: "dinner", label: "Abendessen" },
  { key: "snack", label: "Snack" },
];

// Partner coupling ops per slot (passed to DayCard/MealSlotRow only in partner mode)
export type PartnerSlotLink = {
  selfName: string;
  partnerName: string;
  isCoupled: boolean;
  onCouple: () => void;
  onUncouple: () => void;
  onSwapForBoth: (lib: LibraryMeal) => void;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}
function makeGroupId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `grp_${Math.random().toString(36).slice(2)}`;
}

function mealFromLibrary(lib: LibraryMeal, slot: Slot, factor = 1, group: string | null = null): BuilderMeal {
  return {
    slot,
    name: lib.name,
    description: lib.description,
    library_meal_id: lib.id,
    portion_factor: factor,
    linked_prep_group: group,
    ingredients: (lib.ingredients ?? []).map((i) => ({
      name: i.name,
      grams: Math.round(i.amount_g ?? 0),
    })),
  };
}

function mealMacros(m: BuilderMeal, library: LibraryMeal[]) {
  const lib = library.find((x) => x.id === m.library_meal_id);
  const f = m.portion_factor && m.portion_factor > 0 ? m.portion_factor : 1;
  if (!lib) return { kcal: 0, p: 0, c: 0, f: 0 };
  return {
    kcal: Number(lib.kcal) * f,
    p: Number(lib.protein_g) * f,
    c: Number(lib.carbs_g) * f,
    f: Number(lib.fat_g) * f,
  };
}

export type AutoFillMode = "empty_only" | "all_unlocked";

export function targetsFor(day: BuilderDay, ctx: CustomerPlanContext) {
  return day.type === "training"
    ? { kcal: ctx.targets.kcal_train, p: ctx.targets.protein_train, c: ctx.targets.carbs_train, f: ctx.targets.fat_train }
    : { kcal: ctx.targets.kcal_rest, p: ctx.targets.protein_rest, c: ctx.targets.carbs_rest, f: ctx.targets.fat_rest };
}

// Returns { day, missing: Slot[] } — never touches locked meals.
export function autoFillDayImpl(
  day: BuilderDay,
  ctx: CustomerPlanContext,
  library: LibraryMeal[],
  mode: AutoFillMode,
): { day: BuilderDay; missing: Slot[] } {
  let meals: BuilderMeal[] = day.meals.map((m) => ({ ...m }));
  // In "all_unlocked" mode: remove unlocked meals before filling
  if (mode === "all_unlocked") {
    meals = meals.filter((m) => m.is_locked);
  }
  const target = targetsFor(day, ctx);
  const slotOrder: Slot[] = ["breakfast", "lunch", "dinner", "snack"];
  const missing: Slot[] = [];

  const remaining = () => {
    const cur = meals.reduce(
      (acc, m) => {
        const mm = mealMacros(m, library);
        return { kcal: acc.kcal + mm.kcal, p: acc.p + mm.p, c: acc.c + mm.c, f: acc.f + mm.f };
      },
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
    return { kcal: target.kcal - cur.kcal, p: target.p - cur.p, c: target.c - cur.c, f: target.f - cur.f };
  };

  for (const slot of slotOrder) {
    const existing = meals.find((m) => m.slot === slot);
    if (existing) continue; // locked or (empty_only) user meal → keep

    const candidates = library
      .filter((m) => m.category === slot)
      .map((m) => ({ meal: m, ...scoreMeal(m, ctx, day.type, remaining()) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best) {
      missing.push(slot);
      continue;
    }

    if (day.prepCoupleLunchDinner && (slot === "lunch" || slot === "dinner")) {
      const partner = meals.find((m) => m.slot === (slot === "lunch" ? "dinner" : "lunch"));
      if (partner && partner.library_meal_id) {
        // Partner already set (probably locked) → mirror it into this slot
        const src = library.find((x) => x.id === partner.library_meal_id);
        if (src) {
          const groupId = partner.linked_prep_group ?? makeGroupId();
          meals = meals.map((m) => (m.slot === partner.slot ? { ...m, linked_prep_group: groupId } : m));
          const clone = mealFromLibrary(src, slot, 1, groupId);
          if (slot === "dinner") clone.description = (src.description ?? "") + " (Portion 2 aus Mealprep)";
          meals.push(clone);
        }
        continue;
      }
      const groupId = makeGroupId();
      const lunch = mealFromLibrary(best.meal, "lunch", 1, groupId);
      const dinner = mealFromLibrary(best.meal, "dinner", 1, groupId);
      dinner.description = (best.meal.description ?? "") + " (Portion 2 aus Mealprep)";
      meals = meals.filter((m) => m.slot !== "lunch" && m.slot !== "dinner" || m.is_locked);
      meals.push(lunch, dinner);
      continue;
    }
    meals.push(mealFromLibrary(best.meal, slot));
  }
  return { day: { ...day, meals }, missing };
}

// Auto-fill for two linked days (partner mode).
// Strategy per slot: prefer a shared meal (score > 0 for both, quantities scaled per person).
// Fallback: independent picks per person.
export type SharedSlotsMap = Record<Slot, boolean>;

export function autoFillDayPair(
  clientDay: BuilderDay,
  partnerDay: BuilderDay,
  clientCtx: CustomerPlanContext,
  partnerCtx: CustomerPlanContext,
  library: LibraryMeal[],
  mode: AutoFillMode,
  sharedSlots: SharedSlotsMap = { breakfast: true, lunch: true, dinner: true, snack: true },
): { client: BuilderDay; partner: BuilderDay; missing: number } {
  const filterKeep = (arr: BuilderMeal[]) => (mode === "all_unlocked" ? arr.filter((m) => m.is_locked) : arr.map((m) => ({ ...m })));
  let clientMeals: BuilderMeal[] = filterKeep(clientDay.meals);
  let partnerMeals: BuilderMeal[] = filterKeep(partnerDay.meals);

  const slotOrder: Slot[] = ["breakfast", "lunch", "dinner", "snack"];
  let missing = 0;

  const remainingFor = (meals: BuilderMeal[], day: BuilderDay, ctx: CustomerPlanContext) => {
    const t = targetsFor(day, ctx);
    const cur = meals.reduce(
      (acc, m) => {
        const mm = mealMacros(m, library);
        return { kcal: acc.kcal + mm.kcal, p: acc.p + mm.p, c: acc.c + mm.c, f: acc.f + mm.f };
      },
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
    return { kcal: t.kcal - cur.kcal, p: t.p - cur.p, c: t.c - cur.c, f: t.f - cur.f };
  };

  for (const slot of slotOrder) {
    const cExisting = clientMeals.find((m) => m.slot === slot);
    const pExisting = partnerMeals.find((m) => m.slot === slot);
    // Only fill where BOTH slots are empty (locked/existing on either side → skip shared logic)
    if (cExisting && pExisting) continue;

    if (sharedSlots[slot] && !cExisting && !pExisting) {
      const cRem = remainingFor(clientMeals, clientDay, clientCtx);
      const pRem = remainingFor(partnerMeals, partnerDay, partnerCtx);
      const scored = library
        .filter((m) => m.category === slot)
        .map((m) => {
          const sc = scoreMeal(m, clientCtx, clientDay.type, cRem);
          const sp = scoreMeal(m, partnerCtx, partnerDay.type, pRem);
          return { meal: m, combined: sc.score + sp.score, sc: sc.score, sp: sp.score };
        })
        .filter((x) => x.sc > 0 && x.sp > 0)
        .sort((a, b) => b.combined - a.combined);
      const best = scored[0];
      if (best) {
        const group = makeGroupId();
        // per-person kcal scaling
        const scale = (rem: { kcal: number }, kcal: number) => {
          if (!kcal) return 1;
          const target = Math.max(200, rem.kcal);
          const raw = target / kcal;
          return Math.max(0.25, Math.min(2, Math.round(raw * 4) / 4));
        };
        const clientFactor = scale(cRem, best.meal.kcal);
        const partnerFactor = scale(pRem, best.meal.kcal);
        const cMeal = mealFromLibrary(best.meal, slot, clientFactor, null);
        cMeal.linked_partner_group = group;
        const pMeal = mealFromLibrary(best.meal, slot, partnerFactor, null);
        pMeal.linked_partner_group = group;
        clientMeals.push(cMeal);
        partnerMeals.push(pMeal);
        continue;
      }
    }
    // Fallback: independent picks per side (only where side is empty)
    if (!cExisting) {
      const cRem = remainingFor(clientMeals, clientDay, clientCtx);
      const cCand = library
        .filter((m) => m.category === slot)
        .map((m) => ({ meal: m, ...scoreMeal(m, clientCtx, clientDay.type, cRem) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (cCand) clientMeals.push(mealFromLibrary(cCand.meal, slot));
      else missing++;
    }
    if (!pExisting) {
      const pRem = remainingFor(partnerMeals, partnerDay, partnerCtx);
      const pCand = library
        .filter((m) => m.category === slot)
        .map((m) => ({ meal: m, ...scoreMeal(m, partnerCtx, partnerDay.type, pRem) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (pCand) partnerMeals.push(mealFromLibrary(pCand.meal, slot));
      else missing++;
    }
  }

  return {
    client: { ...clientDay, meals: clientMeals },
    partner: { ...partnerDay, meals: partnerMeals },
    missing,
  };
}

// Re-scales unlocked meal portions so day kcal ≈ target kcal.
export function rebalanceDay(day: BuilderDay, ctx: CustomerPlanContext, library: LibraryMeal[]): BuilderDay {
  const t = targetsFor(day, ctx).kcal;
  const cur = day.meals.reduce((s, m) => s + mealMacros(m, library).kcal, 0);
  if (!t || !cur) return day;
  const scale = t / cur;
  if (scale > 0.92 && scale < 1.08) return day;
  return {
    ...day,
    meals: day.meals.map((m) => {
      if (m.is_locked) return m;
      const nf = Math.max(0.25, Math.min(4, Math.round(((m.portion_factor ?? 1) * scale) * 4) / 4));
      return { ...m, portion_factor: nf };
    }),
  };
}

// Deep-copy meals for day-copy: fresh linked_prep_group + linked_partner_group IDs (shared across a paired copy via caller-supplied maps).
function remapMealsForCopy(
  arr: BuilderMeal[],
  groupMap: Map<string, string>,
  prepMap: Map<string, string>,
): BuilderMeal[] {
  return arr.map((m) => {
    let lpg: string | null = null;
    if (m.linked_partner_group) {
      if (!groupMap.has(m.linked_partner_group)) groupMap.set(m.linked_partner_group, makeGroupId());
      lpg = groupMap.get(m.linked_partner_group)!;
    }
    let prep: string | null = null;
    if (m.linked_prep_group) {
      if (!prepMap.has(m.linked_prep_group)) prepMap.set(m.linked_prep_group, makeGroupId());
      prep = prepMap.get(m.linked_prep_group)!;
    }
    return {
      ...m,
      ingredients: m.ingredients.map((i) => ({ ...i })),
      linked_prep_group: prep,
      linked_partner_group: lpg,
    };
  });
}

// Scale a portion factor from one person to another based on their kcal targets. Snapped to 0.25.
function scaleFactorToTarget(fromFactor: number, fromTargetKcal: number, toTargetKcal: number): number {
  if (!fromTargetKcal || !toTargetKcal) return fromFactor;
  const raw = fromFactor * (toTargetKcal / fromTargetKcal);
  return Math.max(0.25, Math.min(4, Math.round(raw * 4) / 4));
}

export function PlanBuilderPage({ userId, planId }: { userId: string; planId?: string }) {
  const navigate = useNavigate();
  const listLib = useServerFn(listMealLibrary);
  const getCtx = useServerFn(getCustomerPlanContext);
  const save = useServerFn(saveBuilderPlan);
  const savePartner = useServerFn(saveBuilderPartnerPlan);
  const partnerLinkFn = useServerFn(getPartnerLink);
  const loadFn = useServerFn(loadNutritionPlanForBuilder);

  const libQ = useQuery({ queryKey: ["meal-library"], queryFn: () => listLib() });
  const ctxQ = useQuery({
    queryKey: ["plan-ctx", userId],
    queryFn: () => getCtx({ data: { customerId: userId } }),
  });
  const loadedQ = useQuery({
    queryKey: ["plan-builder-load", planId],
    queryFn: () => loadFn({ data: { planId: planId! } }),
    enabled: !!planId,
  });

  const [startDate, setStartDate] = useState(isoDate(new Date()));
  const [endDate, setEndDate] = useState(addDays(isoDate(new Date()), 6));
  const numDays = useMemo(() => {
    const s = new Date(startDate + "T00:00:00Z").getTime();
    const e = new Date(endDate + "T00:00:00Z").getTime();
    if (!isFinite(s) || !isFinite(e) || e < s) return 1;
    return Math.min(28, Math.max(1, Math.round((e - s) / 86400000) + 1));
  }, [startDate, endDate]);
  const [title, setTitle] = useState("Wochenplan");
  const [saving, setSaving] = useState(false);
  const [weekConfirmOpen, setWeekConfirmOpen] = useState(false);
  const [weekMode, setWeekMode] = useState<AutoFillMode>("empty_only");
  const [undoSnapshot, setUndoSnapshot] = useState<{ client: BuilderDay[]; partner: BuilderDay[] | null } | null>(null);
  const [loadedPlanApplied, setLoadedPlanApplied] = useState(false);


  // ---------- Partner ----------
  const partnerLinkQ = useQuery({
    queryKey: ["plan-builder-partner", userId],
    queryFn: () => partnerLinkFn({ data: { user_id: userId } }),
  });
  const partnerId = partnerLinkQ.data?.partner_id ?? null;
  const partnerName = partnerLinkQ.data?.partner_name ?? "Partner";
  const [partnerMode, setPartnerMode] = useState(false);
  const [sharedSlots, setSharedSlots] = useState<SharedSlotsMap>({
    breakfast: false,
    lunch: false,
    dinner: true,
    snack: false,
  });
  const partnerCtxQ = useQuery({
    queryKey: ["plan-ctx", partnerId],
    queryFn: () => getCtx({ data: { customerId: partnerId! } }),
    enabled: !!partnerId && partnerMode,
  });
  const partnerTrainingWeekdays = partnerCtxQ.data?.trainingWeekdays ?? [];

  const trainingWeekdays = ctxQ.data?.trainingWeekdays ?? [];
  const [days, setDays] = useState<BuilderDay[]>(() => []);
  const [partnerDays, setPartnerDays] = useState<BuilderDay[]>(() => []);

  useMemo(() => {
    const build = (prev: BuilderDay[], twd: number[]): BuilderDay[] => {
      const next: BuilderDay[] = [];
      const weekdayLabels = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
      for (let i = 0; i < numDays; i++) {
        const iso = addDays(startDate, i);
        const d = new Date(iso + "T00:00:00Z");
        const weekday = d.getUTCDay();
        const isTrain = twd.includes(weekday);
        const existing = prev[i];
        const dateLabel = `${weekdayLabels[weekday]} ${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        const autoType: "training" | "rest" = isTrain ? "training" : "rest";
        const type = existing?.typeOverride ? existing.type : autoType;
        next.push({
          name: `Tag ${i + 1} · ${dateLabel}`,
          type,
          typeOverride: existing?.typeOverride ?? false,
          meals: existing?.meals ?? [],
          prepCoupleLunchDinner: existing?.prepCoupleLunchDinner ?? false,
        });
      }
      return next;
    };
    setDays((prev) => build(prev, trainingWeekdays));
    if (partnerMode) setPartnerDays((prev) => build(prev, partnerTrainingWeekdays));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, numDays, trainingWeekdays.join(","), partnerTrainingWeekdays.join(","), partnerMode]);

  const setDay = (idx: number, upd: (d: BuilderDay) => BuilderDay) => {
    setDays((prev) => prev.map((d, i) => (i === idx ? upd(d) : d)));
  };
  const setPartnerDay = (idx: number, upd: (d: BuilderDay) => BuilderDay) => {
    setPartnerDays((prev) => prev.map((d, i) => (i === idx ? upd(d) : d)));
  };

  const handleSave = async (publish: boolean) => {
    try {
      setSaving(true);
      if (partnerMode && partnerId) {
        await savePartner({
          data: {
            customerId: userId,
            partnerId,
            title,
            startDate,
            clientDays: days,
            partnerDays,
            publish,
          },
        } as any);
      } else {
        await save({ data: { customerId: userId, title, startDate, days, publish } } as any);
      }
      toast.success(publish ? "Plan veröffentlicht" : "Plan als Entwurf gespeichert");
      navigate({ to: "/coach/customers/$userId", params: { userId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const copyClientDay = (idx: number) => {
    const ctx = ctxQ.data;
    const lib = libQ.data ?? [];
    if (!ctx) return;
    setDays((prev) => {
      if (idx + 1 >= prev.length) return prev;
      const src = prev[idx];
      const next = [...prev];
      const groupMap = new Map<string, string>();
      const prepMap = new Map<string, string>();
      const copiedMeals = remapMealsForCopy(src.meals, groupMap, prepMap).map((m) => ({
        ...m,
        linked_partner_group: null,
      }));
      next[idx + 1] = rebalanceDay(
        { ...next[idx + 1], prepCoupleLunchDinner: src.prepCoupleLunchDinner, meals: copiedMeals },
        ctx,
        lib,
      );
      return next;
    });
  };

  const copyPartnerDay = (idx: number) => {
    const ctx = partnerCtxQ.data;
    const lib = libQ.data ?? [];
    if (!ctx) return;
    setPartnerDays((prev) => {
      if (idx + 1 >= prev.length) return prev;
      const src = prev[idx];
      const next = [...prev];
      const groupMap = new Map<string, string>();
      const prepMap = new Map<string, string>();
      const copiedMeals = remapMealsForCopy(src.meals, groupMap, prepMap).map((m) => ({
        ...m,
        linked_partner_group: null,
      }));
      next[idx + 1] = rebalanceDay(
        { ...next[idx + 1], prepCoupleLunchDinner: src.prepCoupleLunchDinner, meals: copiedMeals },
        ctx,
        lib,
      );
      return next;
    });
  };

  const copyDayPair = (idx: number) => {
    const cCtx = ctxQ.data;
    const pCtx = partnerCtxQ.data;
    const lib = libQ.data ?? [];
    if (!cCtx || !pCtx) return;
    if (idx + 1 >= days.length) return;
    const groupMap = new Map<string, string>();
    const prepMapC = new Map<string, string>();
    const prepMapP = new Map<string, string>();
    const srcC = days[idx];
    const srcP = partnerDays[idx];
    const remappedC = remapMealsForCopy(srcC.meals, groupMap, prepMapC);
    const remappedP = remapMealsForCopy(srcP.meals, groupMap, prepMapP);
    setDays((prev) => {
      const next = [...prev];
      next[idx + 1] = rebalanceDay(
        { ...next[idx + 1], prepCoupleLunchDinner: srcC.prepCoupleLunchDinner, meals: remappedC },
        cCtx,
        lib,
      );
      return next;
    });
    setPartnerDays((prev) => {
      const next = [...prev];
      next[idx + 1] = rebalanceDay(
        { ...next[idx + 1], prepCoupleLunchDinner: srcP.prepCoupleLunchDinner, meals: remappedP },
        pCtx,
        lib,
      );
      return next;
    });
  };

  const [copyChoiceIdx, setCopyChoiceIdx] = useState<number | null>(null);

  const cloneDays = (arr: BuilderDay[]): BuilderDay[] =>
    arr.map((d) => ({
      ...d,
      meals: d.meals.map((m) => ({ ...m, ingredients: m.ingredients.map((i) => ({ ...i })) })),
    }));

  const runAutoFillWeek = (mode: AutoFillMode) => {
    const ctx = ctxQ.data;
    const lib = libQ.data ?? [];
    if (!ctx) return;
    setUndoSnapshot({
      client: cloneDays(days),
      partner: partnerMode ? cloneDays(partnerDays) : null,
    });
    let missingCount = 0;
    if (partnerMode && partnerCtxQ.data) {
      const pCtx = partnerCtxQ.data;
      const nextClient: BuilderDay[] = [];
      const nextPartner: BuilderDay[] = [];
      for (let i = 0; i < days.length; i++) {
        const pair = autoFillDayPair(days[i], partnerDays[i], ctx, pCtx, lib, mode, sharedSlots);
        missingCount += pair.missing;
        nextClient.push(pair.client);
        nextPartner.push(pair.partner);
      }
      setDays(nextClient);
      setPartnerDays(nextPartner);
    } else {
      setDays((prev) =>
        prev.map((d) => {
          const res = autoFillDayImpl(d, ctx, lib, mode);
          missingCount += res.missing.length;
          return res.day;
        }),
      );
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

  if (libQ.isLoading || ctxQ.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Lade …</div>;
  }
  if (libQ.error) return <div className="p-6 text-sm text-destructive">Bibliothek konnte nicht geladen werden.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-32">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/coach/customers/$userId", params: { userId } })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
        </Button>
        <h1 className="font-display text-lg font-bold">Plan manuell erstellen</h1>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => { setWeekMode("empty_only"); setWeekConfirmOpen(true); }}>
            <Wand2 className="mr-1 h-3 w-3" />
            Woche automatisch füllen
          </Button>
          {undoSnapshot && (
            <Button size="sm" variant="outline" onClick={undoWeekFill}>
              <Undo2 className="mr-1 h-3 w-3" />
              Rückgängig
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={weekConfirmOpen} onOpenChange={setWeekConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Woche automatisch füllen?</AlertDialogTitle>
            <AlertDialogDescription>
              Fixierte Mahlzeiten bleiben immer erhalten. Vor der Aktion wird ein Snapshot gespeichert
              — du kannst über „Rückgängig“ zurückkehren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RadioGroup value={weekMode} onValueChange={(v) => setWeekMode(v as AutoFillMode)} className="space-y-2 py-2">
            <label className="flex items-start gap-2 text-sm">
              <RadioGroupItem value="empty_only" className="mt-0.5" />
              <div>
                <div className="font-medium">Nur leere Slots füllen</div>
                <div className="text-xs text-muted-foreground">Bestehende Mahlzeiten bleiben unverändert.</div>
              </div>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <RadioGroupItem value="all_unlocked" className="mt-0.5" />
              <div>
                <div className="font-medium">Alle nicht fixierten Slots neu füllen</div>
                <div className="text-xs text-muted-foreground">Ersetzt nicht-fixierte Mahlzeiten durch neue Vorschläge.</div>
              </div>
            </label>
          </RadioGroup>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => runAutoFillWeek(weekMode)}>Ausführen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Zeitraum</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Startdatum</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>Enddatum</Label>
            <Input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {ctxQ.data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Kundenprofil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">
                Trainingstag: {ctxQ.data.targets.kcal_train} kcal · {ctxQ.data.targets.protein_train}P/
                {ctxQ.data.targets.carbs_train}C/{ctxQ.data.targets.fat_train}F
              </Badge>
              <Badge variant="outline">
                Restday: {ctxQ.data.targets.kcal_rest} kcal · {ctxQ.data.targets.protein_rest}P/
                {ctxQ.data.targets.carbs_rest}C/{ctxQ.data.targets.fat_rest}F
              </Badge>
            </div>
            <div>
              Trainingstage laut Profil:{" "}
              <b>
                {ctxQ.data.trainingWeekdays.length === 0
                  ? "keine hinterlegt"
                  : ctxQ.data.trainingWeekdays
                      .slice()
                      .sort()
                      .map((w) => ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][w])
                      .join(", ")}
              </b>
            </div>
            {ctxQ.data.dietStyle && (
              <div>
                Ernährungsform: <b>{ctxQ.data.dietStyle}</b>
              </div>
            )}
            {ctxQ.data.allergies.length > 0 && <div>Allergien: {ctxQ.data.allergies.join(", ")}</div>}
            {ctxQ.data.noGoFoods.length > 0 && <div>No-Gos: {ctxQ.data.noGoFoods.join(", ")}</div>}
            {ctxQ.data.favoriteFoods.length > 0 && (
              <div className="text-emerald-500">Lieblingsfoods: {ctxQ.data.favoriteFoods.join(", ")}</div>
            )}
          </CardContent>
        </Card>
      )}

      {partnerId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-emerald-500" />
              Partnerplan
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3 text-xs">
            <div>
              Gemeinsamer Plan mit <b>{partnerName}</b>. Zwei verknüpfte Pläne mit eigenen Zielen und Portionen pro Person.
            </div>
            <Switch checked={partnerMode} onCheckedChange={setPartnerMode} />
          </CardContent>
        </Card>
      )}

      {partnerMode && partnerCtxQ.data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Partnerprofil · {partnerName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">
                Trainingstag: {partnerCtxQ.data.targets.kcal_train} kcal · {partnerCtxQ.data.targets.protein_train}P/
                {partnerCtxQ.data.targets.carbs_train}C/{partnerCtxQ.data.targets.fat_train}F
              </Badge>
              <Badge variant="outline">
                Restday: {partnerCtxQ.data.targets.kcal_rest} kcal · {partnerCtxQ.data.targets.protein_rest}P/
                {partnerCtxQ.data.targets.carbs_rest}C/{partnerCtxQ.data.targets.fat_rest}F
              </Badge>
            </div>
            <div>
              Trainingstage:{" "}
              <b>
                {partnerCtxQ.data.trainingWeekdays.length === 0
                  ? "keine hinterlegt"
                  : partnerCtxQ.data.trainingWeekdays
                      .slice()
                      .sort()
                      .map((w) => ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][w])
                      .join(", ")}
              </b>
            </div>
            {partnerCtxQ.data.allergies.length > 0 && <div>Allergien: {partnerCtxQ.data.allergies.join(", ")}</div>}
            {partnerCtxQ.data.noGoFoods.length > 0 && <div>No-Gos: {partnerCtxQ.data.noGoFoods.join(", ")}</div>}
          </CardContent>
        </Card>
      )}

      {partnerMode && partnerCtxQ.data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Gemeinsame Mahlzeiten mit {partnerName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="text-muted-foreground">
              Nur ausgewählte Slots werden beim Auto-Fill als Paar geplant (gleiches Rezept, individuelle Portionen).
              Nicht angehakte Slots werden pro Person unabhängig geplant.
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(SLOTS as ReadonlyArray<{ key: Slot; label: string }>).map((s) => (
                <label key={s.key} className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={sharedSlots[s.key]}
                    onChange={(e) => setSharedSlots((prev) => ({ ...prev, [s.key]: e.target.checked }))}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {days.map((day, di) =>
        partnerMode && partnerCtxQ.data && partnerDays[di] ? (
          <PartnerDayBlock
            key={di}
            clientDay={day}
            partnerDay={partnerDays[di]}
            clientCtx={ctxQ.data!}
            partnerCtx={partnerCtxQ.data}
            clientName="Kunde"
            partnerName={partnerName}
            library={libQ.data ?? []}
            sharedSlots={sharedSlots}
            onClientChange={(u) => setDay(di, u)}
            onPartnerChange={(u) => setPartnerDay(di, u)}
            onCopy={() => setCopyChoiceIdx(di)}
          />
        ) : (
          <DayCard
            key={di}
            day={day}
            library={libQ.data ?? []}
            ctx={ctxQ.data!}
            onChange={(u) => setDay(di, u)}
            onCopy={() => copyClientDay(di)}
          />
        ),
      )}

      <AlertDialog open={copyChoiceIdx !== null} onOpenChange={(o) => !o && setCopyChoiceIdx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tag auf nächsten Tag kopieren</AlertDialogTitle>
            <AlertDialogDescription>
              Der Trainingstag-/Restday-Status des Zieltages bleibt erhalten. Portionen werden nach dem
              Kopieren auf das jeweilige Tagesziel neu skaliert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-2">
            <Button
              variant="outline"
              onClick={() => {
                if (copyChoiceIdx !== null) copyClientDay(copyChoiceIdx);
                setCopyChoiceIdx(null);
              }}
            >
              Nur Kunde kopieren
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (copyChoiceIdx !== null) copyPartnerDay(copyChoiceIdx);
                setCopyChoiceIdx(null);
              }}
            >
              Nur {partnerName} kopieren
            </Button>
            <Button
              onClick={() => {
                if (copyChoiceIdx !== null) copyDayPair(copyChoiceIdx);
                setCopyChoiceIdx(null);
              }}
            >
              Beide kopieren (Kopplung bleibt erhalten)
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background/95 p-3 backdrop-blur">
        <Button variant="outline" className="flex-1" disabled={saving} onClick={() => handleSave(false)}>
          Als Entwurf speichern
        </Button>
        <Button className="flex-1" disabled={saving} onClick={() => handleSave(true)}>
          Veröffentlichen
        </Button>
      </div>
    </div>
  );
}

// ---------- Day card ----------
function DayCard({
  day,
  library,
  ctx,
  onChange,
  onCopy,
  hideHeaderActions,
  partnerLinkForSlot,
}: {
  day: BuilderDay;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  onChange: (u: (d: BuilderDay) => BuilderDay) => void;
  onCopy: () => void;
  hideHeaderActions?: boolean;
  partnerLinkForSlot?: (slot: Slot) => PartnerSlotLink | undefined;
}) {
  const target =
    day.type === "training"
      ? { kcal: ctx.targets.kcal_train, p: ctx.targets.protein_train, c: ctx.targets.carbs_train, f: ctx.targets.fat_train }
      : { kcal: ctx.targets.kcal_rest, p: ctx.targets.protein_rest, c: ctx.targets.carbs_rest, f: ctx.targets.fat_rest };

  const totals = day.meals.reduce(
    (acc, m) => {
      const mm = mealMacros(m, library);
      acc.kcal += mm.kcal;
      acc.p += mm.p;
      acc.c += mm.c;
      acc.f += mm.f;
      return acc;
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  const color = (diff: number, tgt: number) => {
    const pct = tgt ? Math.abs(diff) / tgt : 0;
    if (pct <= 0.05) return "text-emerald-500";
    if (pct <= 0.1) return "text-amber-500";
    return "text-destructive";
  };

  // ---- Meal helpers ----
  const setMealAtSlot = (slot: Slot, next: BuilderMeal | null) => {
    onChange((d) => {
      let meals = d.meals.filter((x) => x.slot !== slot);
      if (next) meals.push(next);
      return { ...d, meals };
    });
  };

  const updateMealAtSlot = (slot: Slot, upd: (m: BuilderMeal) => BuilderMeal) => {
    onChange((d) => {
      const target = d.meals.find((x) => x.slot === slot);
      if (!target) return d;
      const updated = upd(target);
      // Kopplung: wenn lunch/dinner in gleicher Gruppe → auch Partner spiegeln (Meal + Faktor)
      if (target.linked_prep_group) {
        const partnerSlot: Slot | null =
          target.slot === "lunch" ? "dinner" : target.slot === "dinner" ? "lunch" : null;
        if (partnerSlot) {
          return {
            ...d,
            meals: d.meals.map((m) => {
              if (m.slot === slot) return updated;
              if (m.slot === partnerSlot && m.linked_prep_group === target.linked_prep_group) {
                return {
                  ...m,
                  name: updated.name,
                  description: updated.description,
                  library_meal_id: updated.library_meal_id,
                  ingredients: updated.ingredients.map((i) => ({ ...i })),
                  // Portionsfaktor pro Slot getrennt (Portion 1 vs Portion 2)
                };
              }
              return m;
            }),
          };
        }
      }
      return { ...d, meals: d.meals.map((m) => (m.slot === slot ? updated : m)) };
    });
  };

  const removeMealAtSlot = (slot: Slot) => {
    onChange((d) => {
      const target = d.meals.find((x) => x.slot === slot);
      if (!target) return d;
      // Kopplung auflösen bei Entfernen
      const group = target.linked_prep_group;
      let meals = d.meals.filter((x) => x.slot !== slot);
      if (group) {
        meals = meals.map((m) =>
          m.linked_prep_group === group ? { ...m, linked_prep_group: null } : m,
        );
      }
      return { ...d, meals };
    });
  };

  const pickMeal = (slot: Slot, lib: LibraryMeal) => {
    onChange((d) => {
      // Kopplung aktiv & Slot ist lunch oder dinner → beide setzen
      if (d.prepCoupleLunchDinner && (slot === "lunch" || slot === "dinner")) {
        const groupId = makeGroupId();
        const lunch = mealFromLibrary(lib, "lunch", 1, groupId);
        const dinner = mealFromLibrary(lib, "dinner", 1, groupId);
        // Portion 2 markieren (nur visuell im Namen-Suffix)
        dinner.description = (lib.description ?? "") + " (Portion 2 aus Mealprep)";
        const meals = d.meals.filter((x) => x.slot !== "lunch" && x.slot !== "dinner");
        meals.push(lunch, dinner);
        return { ...d, meals };
      }
      const meals = d.meals.filter((x) => x.slot !== slot);
      meals.push(mealFromLibrary(lib, slot));
      return { ...d, meals };
    });
  };

  const toggleCouple = (on: boolean) => {
    onChange((d) => {
      if (on) {
        // Wenn lunch existiert, dinner spiegeln; sonst gemeinsame Gruppe vergeben
        const lunch = d.meals.find((m) => m.slot === "lunch");
        const dinner = d.meals.find((m) => m.slot === "dinner");
        const groupId = makeGroupId();
        let meals = [...d.meals];
        if (lunch && !dinner) {
          const src = library.find((x) => x.id === lunch.library_meal_id);
          if (src) {
            const clone = mealFromLibrary(src, "dinner", 1, groupId);
            clone.description = (src.description ?? "") + " (Portion 2 aus Mealprep)";
            meals = meals.map((m) => (m.slot === "lunch" ? { ...m, linked_prep_group: groupId } : m));
            meals.push(clone);
          }
        } else if (dinner && !lunch) {
          const src = library.find((x) => x.id === dinner.library_meal_id);
          if (src) {
            const clone = mealFromLibrary(src, "lunch", 1, groupId);
            meals = meals.map((m) =>
              m.slot === "dinner" ? { ...m, linked_prep_group: groupId } : m,
            );
            meals.push(clone);
          }
        } else if (lunch && dinner) {
          // Beide vorhanden → dinner an lunch angleichen, in gleiche Gruppe
          const src = library.find((x) => x.id === lunch.library_meal_id);
          meals = meals.map((m) => {
            if (m.slot === "lunch") return { ...m, linked_prep_group: groupId };
            if (m.slot === "dinner" && src)
              return {
                ...m,
                name: src.name,
                description: (src.description ?? "") + " (Portion 2 aus Mealprep)",
                library_meal_id: src.id,
                ingredients: (src.ingredients ?? []).map((i) => ({
                  name: i.name,
                  grams: Math.round(i.amount_g ?? 0),
                })),
                linked_prep_group: groupId,
              };
            return m;
          });
        }
        return { ...d, prepCoupleLunchDinner: true, meals };
      } else {
        // Kopplung lösen: Gruppen entfernen, Mahlzeiten bleiben
        return {
          ...d,
          prepCoupleLunchDinner: false,
          meals: d.meals.map((m) =>
            m.slot === "lunch" || m.slot === "dinner" ? { ...m, linked_prep_group: null } : m,
          ),
        };
      }
    });
  };

  const autoFillDay = () => {
    onChange((d) => {
      const res = autoFillDayImpl(d, ctx, library, "empty_only");
      if (res.missing.length > 0) {
        toast.warning(
          `Für ${res.missing.length} Slot(s) wurde keine passende Mahlzeit gefunden. Bitte Mahlzeitendatenbank erweitern oder Filter prüfen.`,
        );
      }
      return res.day;
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          {!hideHeaderActions && <CardTitle className="text-sm">{day.name}</CardTitle>}
          <Badge
            variant={day.type === "training" ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() =>
              onChange((d) => ({
                ...d,
                type: d.type === "training" ? "rest" : "training",
                typeOverride: true,
              }))
            }
          >
            {day.type === "training" ? "Trainingstag" : "Restday"}
          </Badge>
        </div>
        {!hideHeaderActions && (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="secondary" onClick={autoFillDay}>
              <Sparkles className="mr-1 h-3 w-3" />
              Tag automatisch füllen
            </Button>
            <Button size="sm" variant="ghost" onClick={onCopy}>
              <Copy className="mr-1 h-3 w-3" />
              auf nächsten Tag
            </Button>
          </div>
        )}
        {hideHeaderActions && (
          <Button size="sm" variant="ghost" onClick={autoFillDay}>
            <Sparkles className="mr-1 h-3 w-3" />
            Tag füllen
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Balance */}
        <div className="grid grid-cols-4 gap-2 rounded-lg bg-muted p-2 text-[11px]">
          {(
            [
              ["kcal", totals.kcal, target.kcal, "kcal"],
              ["P", totals.p, target.p, "g"],
              ["C", totals.c, target.c, "g"],
              ["F", totals.f, target.f, "g"],
            ] as const
          ).map(([k, v, t, u]) => {
            const diff = Math.round(v - t);
            return (
              <div key={k} className="text-center">
                <div className="text-muted-foreground">{k}</div>
                <div className="font-mono">
                  {Math.round(v)}/{t}
                  {u}
                </div>
                <div className={`font-mono ${color(diff, t)}`}>
                  {diff > 0 ? "+" : ""}
                  {diff}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mealprep coupling */}
        <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-2 text-xs">
          <div className="flex items-center gap-2">
            {day.prepCoupleLunchDinner ? (
              <Link2 className="h-3 w-3 text-emerald-500" />
            ) : (
              <Link2Off className="h-3 w-3 text-muted-foreground" />
            )}
            <span>Mittagessen &amp; Abendessen koppeln (Mealprep)</span>
          </div>
          <Switch
            checked={!!day.prepCoupleLunchDinner}
            onCheckedChange={(v) => toggleCouple(v)}
          />
        </div>

        {/* Meals per slot */}
        {SLOTS.map((slot) => {
          const meal = day.meals.find((m) => m.slot === slot.key);
          const remaining = {
            kcal: target.kcal - totals.kcal,
            p: target.p - totals.p,
            c: target.c - totals.c,
            f: target.f - totals.f,
          };
          return (
            <MealSlotRow
              key={slot.key}
              slot={slot.key}
              label={slot.label}
              meal={meal}
              library={library}
              ctx={ctx}
              dayType={day.type}
              remaining={remaining}
              onPick={(lib) => pickMeal(slot.key, lib)}
              onSwap={(lib) => {
                if (!meal) return;
                updateMealAtSlot(slot.key, (m) => ({
                  ...m,
                  name: lib.name,
                  description: lib.description,
                  library_meal_id: lib.id,
                  ingredients: (lib.ingredients ?? []).map((i) => ({
                    name: i.name,
                    grams: Math.round(i.amount_g ?? 0),
                  })),
                }));
              }}
              onFactor={(f) => updateMealAtSlot(slot.key, (m) => ({ ...m, portion_factor: f }))}
              onLockToggle={() =>
                updateMealAtSlot(slot.key, (m) => ({ ...m, is_locked: !m.is_locked }))
              }
              onRemove={() => removeMealAtSlot(slot.key)}
              partnerLink={partnerLinkForSlot?.(slot.key)}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------- Meal slot row ----------
function MealSlotRow({
  slot,
  label,
  meal,
  library,
  ctx,
  dayType,
  remaining,
  onPick,
  onSwap,
  onFactor,
  onLockToggle,
  onRemove,
  partnerLink,
}: {
  slot: Slot;
  label: string;
  meal: BuilderMeal | undefined;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  dayType: "training" | "rest";
  remaining: { kcal: number; p: number; c: number; f: number };
  onPick: (lib: LibraryMeal) => void;
  onSwap: (lib: LibraryMeal) => void;
  onFactor: (f: number) => void;
  onLockToggle: () => void;
  onRemove: () => void;
  partnerLink?: PartnerSlotLink;
}) {
  const mm = meal ? mealMacros(meal, library) : { kcal: 0, p: 0, c: 0, f: 0 };
  const factor = meal?.portion_factor ?? 1;

  const setFactor = (next: number) => {
    const clamped = Math.max(0.25, Math.min(4, Math.round(next * 4) / 4));
    onFactor(clamped);
  };

  const coupled = !!partnerLink?.isCoupled;

  return (
    <div className="rounded-lg border border-border p-2">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1 text-xs font-medium">
          {label}
          {meal?.linked_prep_group && (
            <Badge variant="outline" className="gap-1 px-1 py-0 text-[9px]">
              <Link2 className="h-2.5 w-2.5" />
              Prep
            </Badge>
          )}
          {coupled && (
            <Badge className="gap-1 bg-emerald-500/15 px-1 py-0 text-[9px] text-emerald-600 hover:bg-emerald-500/20">
              <Link2 className="h-2.5 w-2.5" />
              Gemeinsam
            </Badge>
          )}
        </div>
        {meal && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onLockToggle}>
              <Lock className={`h-3 w-3 ${meal.is_locked ? "text-amber-500" : ""}`} />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onRemove}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {meal ? (
        <div className="space-y-2 text-xs">
          <div>
            <div className="font-medium">{meal.name}</div>
            <div className="text-muted-foreground">
              {Math.round(mm.kcal)} kcal · {Math.round(mm.p)}P / {Math.round(mm.c)}C / {Math.round(mm.f)}F
            </div>
          </div>

          {/* Portionierung */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Menge</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setFactor(factor - 0.25)}>
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="number"
              step="0.25"
              min={0.25}
              max={4}
              value={factor}
              onChange={(e) => setFactor(Number(e.target.value) || 1)}
              className="h-7 w-16 text-center text-xs"
            />
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setFactor(factor + 0.25)}>
              <Plus className="h-3 w-3" />
            </Button>
            <span className="text-muted-foreground">× Portion</span>
          </div>

          {/* Aktionen */}
          <div className="flex flex-wrap gap-1">
            {coupled ? (
              <>
                <MealPickerDialog
                  trigger={
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <Shuffle className="mr-1 h-3 w-3" />
                      Für beide tauschen
                    </Button>
                  }
                  title={`${label} für beide tauschen`}
                  slot={slot}
                  library={library}
                  ctx={ctx}
                  dayType={dayType}
                  remaining={remaining}
                  onPick={(lib) => partnerLink!.onSwapForBoth(lib)}
                />
                <MealPickerDialog
                  trigger={
                    <Button size="sm" variant="ghost" className="h-7 text-xs">
                      Nur für {partnerLink!.selfName} tauschen
                    </Button>
                  }
                  title={`${label} nur für ${partnerLink!.selfName} tauschen`}
                  slot={slot}
                  library={library}
                  ctx={ctx}
                  dayType={dayType}
                  remaining={remaining}
                  onPick={(lib) => {
                    partnerLink!.onUncouple();
                    onSwap(lib);
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={partnerLink!.onUncouple}
                >
                  <Link2Off className="mr-1 h-3 w-3" />
                  Kopplung lösen
                </Button>
              </>
            ) : (
              <>
                <MealPickerDialog
                  trigger={
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <Shuffle className="mr-1 h-3 w-3" />
                      Tauschen
                    </Button>
                  }
                  title={`${label} tauschen`}
                  slot={slot}
                  library={library}
                  ctx={ctx}
                  dayType={dayType}
                  remaining={remaining}
                  onPick={onSwap}
                />
                <MealPickerDialog
                  trigger={
                    <Button size="sm" variant="ghost" className="h-7 text-xs">
                      Alternative anzeigen
                    </Button>
                  }
                  title={`Alternativen für ${label}`}
                  slot={slot}
                  library={library}
                  ctx={ctx}
                  dayType={dayType}
                  remaining={remaining}
                  onPick={onSwap}
                  excludeId={meal.library_meal_id ?? null}
                />
                {partnerLink && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    onClick={partnerLink.onCouple}
                  >
                    <Link2 className="mr-1 h-3 w-3" />
                    Mit {partnerLink.partnerName} koppeln
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <MealPickerDialog
            trigger={
              <Button size="sm" variant="outline" className="w-full">
                Mahlzeit auswählen
              </Button>
            }
            title={`Mahlzeit für ${label}`}
            slot={slot}
            library={library}
            ctx={ctx}
            dayType={dayType}
            remaining={remaining}
            onPick={onPick}
          />
          {partnerLink && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs"
              onClick={partnerLink.onCouple}
            >
              <Link2 className="mr-1 h-3 w-3" />
              Von {partnerLink.partnerName} übernehmen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Score + picker ----------
function scoreMeal(
  m: LibraryMeal,
  ctx: CustomerPlanContext,
  dayType: "training" | "rest",
  remaining: { kcal: number; p: number; c: number; f: number },
): { score: number; label: string; reasons: string[] } {
  const reasons: string[] = [];
  let score = 50;

  if (dayType === "training" && !m.suitable_training) score -= 25;
  if (dayType === "rest" && !m.suitable_rest) score -= 25;

  if (remaining.kcal > 0) {
    const kcalRatio = m.kcal / Math.max(200, remaining.kcal);
    if (kcalRatio >= 0.2 && kcalRatio <= 0.5) {
      score += 15;
      reasons.push("Kalorien passen");
    } else if (kcalRatio > 0.7) {
      score -= 15;
      reasons.push("Sehr kalorienreich");
    }
  }
  if (remaining.p > 0 && m.protein_g / Math.max(15, remaining.p) >= 0.25) {
    score += 10;
    reasons.push("Gute Proteinmenge");
  }

  const hay = [
    m.name,
    m.description ?? "",
    ...(m.tags ?? []),
    m.main_protein ?? "",
    m.main_carb ?? "",
    ...(m.ingredients ?? []).map((i) => i.name),
  ]
    .join(" ")
    .toLowerCase();

  for (const allergen of [...ctx.allergies, ...ctx.intolerances]) {
    if (allergen && (m.no_go_ingredients.includes(allergen) || hay.includes(allergen))) {
      score -= 200;
      reasons.push(`Allergie/Intoleranz: ${allergen}`);
    }
  }
  for (const no of ctx.noGoFoods) {
    if (no && hay.includes(no)) {
      score -= 100;
      reasons.push(`No-Go: ${no}`);
    }
  }
  for (const fav of ctx.favoriteFoods) {
    if (fav && hay.includes(fav)) {
      score += 20;
      reasons.push(`Lieblingsfood: ${fav}`);
    }
  }

  if (ctx.dietStyle) {
    const ds = ctx.dietStyle.toLowerCase();
    if (ds.includes("vegan") && !m.tags.includes("vegan")) {
      score -= 100;
      reasons.push("Nicht vegan");
    }
    if (ds.includes("veget") && !m.tags.includes("vegetarian") && !m.tags.includes("vegan")) {
      if (/hähnchen|pute|rind|lachs|fisch|thunfisch/.test(hay)) {
        score -= 100;
        reasons.push("Nicht vegetarisch");
      }
    }
  }

  if (ctx.mealPrepStyle && ctx.mealPrepStyle.toLowerCase().includes("prep") && !m.mealprep_ok) {
    score -= 10;
    reasons.push("Nicht mealprep-tauglich");
  }
  if (ctx.budgetBand === "low" && m.budget === "high") {
    score -= 15;
    reasons.push("Über Budget");
  }

  let label = "möglich";
  if (score >= 80) label = "sehr passend";
  else if (score >= 60) label = "passend";
  else if (score >= 30) label = "möglich";
  else label = "eher unpassend";

  return { score, label, reasons };
}

function MealPickerDialog({
  trigger,
  title,
  slot,
  library,
  ctx,
  dayType,
  remaining,
  onPick,
  excludeId,
}: {
  trigger: React.ReactNode;
  title: string;
  slot: Slot;
  library: LibraryMeal[];
  ctx: CustomerPlanContext;
  dayType: "training" | "rest";
  remaining: { kcal: number; p: number; c: number; f: number };
  onPick: (m: LibraryMeal) => void;
  excludeId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const scored = useMemo(() => {
    return library
      .filter((m) => m.category === slot && (!excludeId || m.id !== excludeId))
      .map((m) => ({ meal: m, ...scoreMeal(m, ctx, dayType, remaining) }))
      .sort((a, b) => b.score - a.score);
  }, [library, ctx, slot, dayType, remaining, excludeId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {scored.length === 0 && <p className="text-sm text-muted-foreground">Keine Vorschläge.</p>}
          {scored.map(({ meal, label, score, reasons }) => (
            <button
              key={meal.id}
              type="button"
              className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted"
              onClick={() => {
                onPick(meal);
                setOpen(false);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{meal.name}</div>
                <Badge
                  variant={score >= 80 ? "default" : score >= 60 ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  {label}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {Math.round(meal.kcal)} kcal · {meal.protein_g}P / {meal.carbs_g}C / {meal.fat_g}F
              </div>
              {reasons.length > 0 && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {reasons.slice(0, 3).join(" · ")}
                </div>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Partner day block: two DayCards + shared pair-autofill ----------
function PartnerDayBlock({
  clientDay,
  partnerDay,
  clientCtx,
  partnerCtx,
  clientName,
  partnerName,
  library,
  sharedSlots,
  onClientChange,
  onPartnerChange,
  onCopy,
}: {
  clientDay: BuilderDay;
  partnerDay: BuilderDay;
  clientCtx: CustomerPlanContext;
  partnerCtx: CustomerPlanContext;
  clientName: string;
  partnerName: string;
  library: LibraryMeal[];
  sharedSlots: SharedSlotsMap;
  onClientChange: (u: (d: BuilderDay) => BuilderDay) => void;
  onPartnerChange: (u: (d: BuilderDay) => BuilderDay) => void;
  onCopy: () => void;
}) {
  // Sync coupled meals (same linked_partner_group) → recipe from client mirrors to partner.
  // Portion factor stays per person. Runs after render.
  useEffect(() => {
    for (const cm of clientDay.meals) {
      if (!cm.linked_partner_group) continue;
      const pm = partnerDay.meals.find((x) => x.linked_partner_group === cm.linked_partner_group);
      if (!pm) continue;
      const differentRecipe =
        pm.library_meal_id !== cm.library_meal_id ||
        pm.name !== cm.name ||
        pm.ingredients.length !== cm.ingredients.length ||
        pm.ingredients.some((ing, i) => ing.name !== cm.ingredients[i]?.name);
      if (differentRecipe) {
        onPartnerChange((d) => ({
          ...d,
          meals: d.meals.map((m) =>
            m.linked_partner_group === cm.linked_partner_group
              ? {
                  ...m,
                  slot: cm.slot,
                  name: cm.name,
                  description: cm.description ?? null,
                  library_meal_id: cm.library_meal_id ?? null,
                  ingredients: cm.ingredients.map((i) => ({ ...i })),
                }
              : m,
          ),
        }));
      }
    }
  }, [clientDay.meals]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoFillPair = () => {
    const res = autoFillDayPair(clientDay, partnerDay, clientCtx, partnerCtx, library, "empty_only", sharedSlots);
    onClientChange(() => res.client);
    onPartnerChange(() => res.partner);
    if (res.missing > 0) {
      toast.warning(
        `Für ${res.missing} Slot(s) wurde keine passende Mahlzeit gefunden. Bitte Mahlzeitendatenbank erweitern oder Filter prüfen.`,
      );
    }
  };

  const cTargetKcal = targetsFor(clientDay, clientCtx).kcal;
  const pTargetKcal = targetsFor(partnerDay, partnerCtx).kcal;

  // Couple a slot: mirror recipe to the other side, scale portion to their target.
  // "from" = which side is the master (has the meal to mirror).
  const coupleSlot = (slot: Slot, from: "client" | "partner") => {
    const cM = clientDay.meals.find((m) => m.slot === slot);
    const pM = partnerDay.meals.find((m) => m.slot === slot);
    const group = makeGroupId();
    if (from === "client") {
      if (!cM) return;
      const scaledFactor = scaleFactorToTarget(cM.portion_factor ?? 1, cTargetKcal, pTargetKcal);
      onClientChange((d) => ({
        ...d,
        meals: d.meals.map((m) => (m.slot === slot ? { ...m, linked_partner_group: group } : m)),
      }));
      if (pM) {
        // Both exist — link group, rescale partner factor, sync recipe via useEffect.
        onPartnerChange((d) => ({
          ...d,
          meals: d.meals.map((m) =>
            m.slot === slot ? { ...m, linked_partner_group: group, portion_factor: scaledFactor } : m,
          ),
        }));
      } else {
        // Clone recipe to partner slot with scaled portion.
        const clone: BuilderMeal = {
          ...cM,
          ingredients: cM.ingredients.map((i) => ({ ...i })),
          linked_prep_group: null,
          linked_partner_group: group,
          portion_factor: scaledFactor,
          is_locked: false,
        };
        onPartnerChange((d) => ({ ...d, meals: [...d.meals.filter((m) => m.slot !== slot), clone] }));
      }
    } else {
      if (!pM) return;
      const scaledFactor = scaleFactorToTarget(pM.portion_factor ?? 1, pTargetKcal, cTargetKcal);
      onPartnerChange((d) => ({
        ...d,
        meals: d.meals.map((m) => (m.slot === slot ? { ...m, linked_partner_group: group } : m)),
      }));
      if (cM) {
        onClientChange((d) => ({
          ...d,
          meals: d.meals.map((m) =>
            m.slot === slot ? { ...m, linked_partner_group: group, portion_factor: scaledFactor } : m,
          ),
        }));
      } else {
        const clone: BuilderMeal = {
          ...pM,
          ingredients: pM.ingredients.map((i) => ({ ...i })),
          linked_prep_group: null,
          linked_partner_group: group,
          portion_factor: scaledFactor,
          is_locked: false,
        };
        onClientChange((d) => ({ ...d, meals: [...d.meals.filter((m) => m.slot !== slot), clone] }));
      }
    }
  };

  const uncoupleSlot = (slot: Slot) => {
    onClientChange((d) => ({
      ...d,
      meals: d.meals.map((m) => (m.slot === slot ? { ...m, linked_partner_group: null } : m)),
    }));
    onPartnerChange((d) => ({
      ...d,
      meals: d.meals.map((m) => (m.slot === slot ? { ...m, linked_partner_group: null } : m)),
    }));
  };

  // Swap for both: update recipe on both sides, keep group, rescale "other" factor to target.
  const swapCoupled = (slot: Slot, lib: LibraryMeal, from: "client" | "partner") => {
    const ing = (lib.ingredients ?? []).map((i) => ({ name: i.name, grams: Math.round(i.amount_g ?? 0) }));
    const patch = {
      name: lib.name,
      description: lib.description,
      library_meal_id: lib.id,
      ingredients: ing,
    };
    const cM = clientDay.meals.find((m) => m.slot === slot);
    const pM = partnerDay.meals.find((m) => m.slot === slot);
    const baseFactor =
      from === "client" ? cM?.portion_factor ?? 1 : pM?.portion_factor ?? 1;
    const otherFactor =
      from === "client"
        ? scaleFactorToTarget(baseFactor, cTargetKcal, pTargetKcal)
        : scaleFactorToTarget(baseFactor, pTargetKcal, cTargetKcal);
    onClientChange((d) => ({
      ...d,
      meals: d.meals.map((m) =>
        m.slot === slot
          ? {
              ...m,
              ...patch,
              ingredients: patch.ingredients.map((i) => ({ ...i })),
              portion_factor: from === "client" ? m.portion_factor ?? 1 : otherFactor,
            }
          : m,
      ),
    }));
    onPartnerChange((d) => ({
      ...d,
      meals: d.meals.map((m) =>
        m.slot === slot
          ? {
              ...m,
              ...patch,
              ingredients: patch.ingredients.map((i) => ({ ...i })),
              portion_factor: from === "partner" ? m.portion_factor ?? 1 : otherFactor,
            }
          : m,
      ),
    }));
  };

  const isCoupled = (slot: Slot) => {
    const cM = clientDay.meals.find((m) => m.slot === slot);
    const pM = partnerDay.meals.find((m) => m.slot === slot);
    return !!(cM?.linked_partner_group && pM?.linked_partner_group === cM.linked_partner_group);
  };

  const linkForClient = (slot: Slot): PartnerSlotLink => ({
    selfName: clientName,
    partnerName,
    isCoupled: isCoupled(slot),
    onCouple: () => coupleSlot(slot, "client"),
    onUncouple: () => uncoupleSlot(slot),
    onSwapForBoth: (lib) => swapCoupled(slot, lib, "client"),
  });
  const linkForPartner = (slot: Slot): PartnerSlotLink => ({
    selfName: partnerName,
    partnerName: clientName,
    isCoupled: isCoupled(slot),
    onCouple: () => coupleSlot(slot, "partner"),
    onUncouple: () => uncoupleSlot(slot),
    onSwapForBoth: (lib) => swapCoupled(slot, lib, "partner"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">{clientDay.name}</CardTitle>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Users className="h-3 w-3" /> Partnerplan
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={autoFillPair}>
            <Sparkles className="mr-1 h-3 w-3" />
            Tag füllen (Paar)
          </Button>
          <Button size="sm" variant="ghost" onClick={onCopy}>
            <Copy className="mr-1 h-3 w-3" />
            auf nächsten Tag
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="client">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="client">{clientName}</TabsTrigger>
            <TabsTrigger value="partner">{partnerName}</TabsTrigger>
          </TabsList>
          <TabsContent value="client" className="mt-3">
            <DayCard
              day={clientDay}
              library={library}
              ctx={clientCtx}
              onChange={onClientChange}
              onCopy={onCopy}
              hideHeaderActions
              partnerLinkForSlot={linkForClient}
            />
          </TabsContent>
          <TabsContent value="partner" className="mt-3">
            <DayCard
              day={partnerDay}
              library={library}
              ctx={partnerCtx}
              onChange={onPartnerChange}
              onCopy={onCopy}
              hideHeaderActions
              partnerLinkForSlot={linkForPartner}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
