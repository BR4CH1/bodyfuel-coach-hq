import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Dumbbell,
  GripVertical,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { normalizeExerciseMedia } from "@/lib/exercise-media";
import { ExerciseMediaThumb } from "@/components/bodyfuel/ExerciseMediaThumb";
import { ExerciseMediaEditorDialog } from "@/components/bodyfuel/ExerciseMediaEditorDialog";
import {
  listExerciseLibrary,
  getCustomerTrainingContext,
  saveBuilderTrainingPlan,
  saveBuilderPartnerTrainingPlan,
  loadTrainingPlanForBuilder,
  type BuilderTrainingDay,
  type BuilderTrainingExercise,
  type LibraryExercise,
  type StrengthBaseline,
} from "@/lib/training-plan-builder.functions";
import {
  saveAsTrainingTemplate,
  type TrainingTemplateDetail,
} from "@/lib/training-templates.functions";
import { autoFillTrainingPlan, emptyPlan } from "@/lib/training-autofill";
import {
  TrainingTemplateLibraryDialog,
  SaveAsTemplateDialog,
} from "@/components/bodyfuel/TrainingTemplateDialogs";

const WD_LABEL = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WD_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mo..So
const EXERCISE_DRAG_TYPE = "application/x-bodyfuel-training-exercise";

type DragExercisePayload = {
  week: number;
  weekday: number;
  index: number;
};

function builderDayKey(week: number, weekday: number): string {
  return `${week}:${weekday}`;
}

function readExerciseDragPayload(event: DragEvent): DragExercisePayload | null {
  try {
    const raw = event.dataTransfer.getData(EXERCISE_DRAG_TYPE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DragExercisePayload>;
    if (
      !Number.isInteger(parsed.week) ||
      !Number.isInteger(parsed.weekday) ||
      !Number.isInteger(parsed.index)
    ) {
      return null;
    }
    return parsed as DragExercisePayload;
  } catch {
    return null;
  }
}

function isoToday(): string {
  const d = new Date();
  // next Monday
  const day = d.getDay();
  const diff = (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function weightFromBaseline(lib: LibraryExercise, b: StrengthBaseline): string | null {
  const n = (lib.name || "").toLowerCase();
  const pat = (lib.movement_pattern || "").toLowerCase();
  const m = (lib.primary_muscle || "").toLowerCase();
  let kg: number | null = null;
  if (/bank(druck|drücken)|bench|brustpresse|chest press/.test(n)) kg = b.bench_press_kg;
  else if (/schulterdr(ück|uck)|shoulder press|overhead|military/.test(n)) kg = b.shoulder_press_kg;
  else if (/kniebeug|squat/.test(n)) kg = b.squat_kg;
  else if (/kreuzheb|deadlift|romanian/.test(n)) kg = b.deadlift_kg;
  else if (/latzug|lat pulldown|pulldown/.test(n)) kg = b.lat_pulldown_kg;
  else if (/ruder|row/.test(n)) kg = b.row_kg;
  else if (/beinpresse|leg press/.test(n)) kg = b.leg_press_kg;
  else if (/beinbeuger|leg curl/.test(n)) kg = b.leg_curl_kg;
  else {
    if (pat === "horizontal_push" || m === "chest") kg = b.bench_press_kg;
    else if (pat === "vertical_push" || m === "shoulders") kg = b.shoulder_press_kg;
    else if (pat === "squat" || m === "quads") kg = b.squat_kg;
    else if (pat === "hinge" || m === "hamstrings") kg = b.deadlift_kg;
    else if (pat === "vertical_pull" || m === "lats") kg = b.lat_pulldown_kg;
    else if (pat === "horizontal_pull" || m === "back") kg = b.row_kg;
  }
  return kg && kg > 0 ? String(kg) : null;
}

export function TrainingPlanBuilderPage({
  userId,
  planId,
  returnOrgId,
}: {
  userId: string;
  planId?: string;
  returnOrgId?: string;
}) {
  const navigate = useNavigate();

  const ctxFn = useServerFn(getCustomerTrainingContext);
  const libFn = useServerFn(listExerciseLibrary);
  const saveFn = useServerFn(saveBuilderTrainingPlan);
  const savePartnerFn = useServerFn(saveBuilderPartnerTrainingPlan);
  const loadFn = useServerFn(loadTrainingPlanForBuilder);

  const ctxQ = useQuery({
    queryKey: ["training-builder-ctx", userId],
    queryFn: () => ctxFn({ data: { customerId: userId } }),
  });
  const libQ = useQuery({ queryKey: ["training-builder-lib"], queryFn: () => libFn() });
  const partnerCtxQ = useQuery({
    queryKey: ["training-builder-ctx", ctxQ.data?.partnerId],
    queryFn: () => ctxFn({ data: { customerId: ctxQ.data!.partnerId! } }),
    enabled: !!ctxQ.data?.partnerId,
  });
  const loadedQ = useQuery({
    queryKey: ["training-builder-load", planId],
    queryFn: () => loadFn({ data: { planId: planId! } }),
    enabled: !!planId,
  });

  const [title, setTitle] = useState("Trainingsplan");
  const [startDate, setStartDate] = useState(isoToday());
  const [weeksCount, setWeeksCount] = useState(4);
  const [partnerMode, setPartnerMode] = useState(false);
  const [activeSide, setActiveSide] = useState<"client" | "partner">("client");
  const [activeWeek, setActiveWeek] = useState(1);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const [clientDays, setClientDays] = useState<BuilderTrainingDay[] | null>(null);
  const [partnerDays, setPartnerDays] = useState<BuilderTrainingDay[] | null>(null);
  const [loadedPlanApplied, setLoadedPlanApplied] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const libraryPanelRef = useRef<HTMLDivElement | null>(null);

  const saveTplFn = useServerFn(saveAsTrainingTemplate);
  const saveTplM = useMutation({
    mutationFn: (v: {
      name: string;
      description: string | null;
      tags: string[];
      note: string | null;
    }) => {
      if (!clientDays) throw new Error("Keine Tage");
      return saveTplFn({
        data: {
          templateId: templateId ?? undefined,
          name: v.name,
          description: v.description,
          tags: v.tags,
          weeksCount,
          days: clientDays,
          note: v.note,
        },
      });
    },
    onSuccess: (res) => {
      setTemplateId(res.template_id);
      setSaveTplOpen(false);
      toast.success(`Vorlage gespeichert (v${res.version})`);
    },
    onError: (error) => toast.error(error.message || "Speichern fehlgeschlagen"),
  });

  function applyTemplate(tpl: TrainingTemplateDetail) {
    setTitle(tpl.name);
    setWeeksCount(tpl.weeks_count);
    setClientDays(tpl.days);
    setTemplateId(tpl.id);
    setActiveWeek(1);
    toast.success(`Vorlage "${tpl.name}" geladen`);
  }

  const ctx = ctxQ.data;
  const partnerCtx = partnerCtxQ.data;
  const library = libQ.data ?? [];

  // Initialize
  const clientWeekdays = ctx?.trainingWeekdays?.length ? ctx.trainingWeekdays : [1, 3, 5];
  const partnerWeekdays = partnerCtx?.trainingWeekdays?.length
    ? partnerCtx.trainingWeekdays
    : clientWeekdays;

  const days = activeSide === "client" ? clientDays : partnerDays;
  const setDays = activeSide === "client" ? setClientDays : setPartnerDays;

  // Preload from existing plan when planId is present
  useEffect(() => {
    if (planId && loadedQ.data && !loadedPlanApplied) {
      setTitle(loadedQ.data.title);
      setStartDate(loadedQ.data.startDate);
      setWeeksCount(loadedQ.data.weeksCount);
      setClientDays(loadedQ.data.days);
      setLoadedPlanApplied(true);
    }
  }, [planId, loadedQ.data, loadedPlanApplied]);

  useEffect(() => {
    if (planId && !loadedPlanApplied) return; // wait for load
    if (!clientDays && ctx) setClientDays(emptyPlan(weeksCount, clientWeekdays));
    if (partnerMode && !partnerDays && partnerCtx)
      setPartnerDays(emptyPlan(weeksCount, partnerWeekdays));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, partnerCtx, partnerMode, weeksCount, planId, loadedPlanApplied]);

  const currentWeekDays = useMemo(
    () =>
      (days ?? [])
        .filter((d) => d.week_number === activeWeek)
        .sort((a, b) => WD_ORDER.indexOf(a.weekday) - WD_ORDER.indexOf(b.weekday)),
    [days, activeWeek],
  );

  useEffect(() => {
    const selectedStillVisible = currentWeekDays.some(
      (day) =>
        builderDayKey(day.week_number, day.weekday) === selectedDayKey && day.type === "training",
    );
    if (selectedStillVisible) return;
    const firstTrainingDay = currentWeekDays.find((day) => day.type === "training");
    setSelectedDayKey(
      firstTrainingDay
        ? builderDayKey(firstTrainingDay.week_number, firstTrainingDay.weekday)
        : null,
    );
  }, [currentWeekDays, selectedDayKey]);

  const activeBaseline = (activeSide === "client" ? ctx : partnerCtx)?.baseline ?? null;

  function mutateDays(fn: (prev: BuilderTrainingDay[]) => BuilderTrainingDay[]) {
    if (activeSide === "client") setClientDays((prev) => (prev ? fn(prev) : prev));
    else setPartnerDays((prev) => (prev ? fn(prev) : prev));
  }

  function updateDay(week: number, weekday: number, patch: Partial<BuilderTrainingDay>) {
    mutateDays((prev) =>
      prev.map((d) => (d.week_number === week && d.weekday === weekday ? { ...d, ...patch } : d)),
    );
  }

  function updateExercise(
    week: number,
    weekday: number,
    idx: number,
    patch: Partial<BuilderTrainingExercise>,
  ) {
    mutateDays((prev) =>
      prev.map((d) => {
        if (d.week_number !== week || d.weekday !== weekday) return d;
        const exs = [...d.exercises];
        exs[idx] = { ...exs[idx], ...patch };
        return { ...d, exercises: exs };
      }),
    );
  }

  function addExercise(week: number, weekday: number, lib?: LibraryExercise) {
    const suggestedKg = lib && activeBaseline ? weightFromBaseline(lib, activeBaseline) : null;
    const newEx: BuilderTrainingExercise = lib
      ? {
          library_exercise_id: lib.id,
          name: lib.name,
          category: lib.category,
          target_sets: lib.default_sets,
          target_reps: lib.default_reps,
          target_weights: suggestedKg,
          target_rir: 2,
          rest_seconds: lib.default_rest_seconds,
          notes: lib.notes,
          is_locked: false,
          smart_lock: "none",
        }
      : {
          library_exercise_id: null,
          name: "",
          category: null,
          target_sets: 3,
          target_reps: "8",
          target_weights: null,
          target_rir: 2,
          rest_seconds: 90,
          notes: null,
          is_locked: false,
          smart_lock: "none",
        };
    mutateDays((prev) =>
      prev.map((d) =>
        d.week_number === week && d.weekday === weekday
          ? { ...d, exercises: [...d.exercises, newEx] }
          : d,
      ),
    );
    if (lib && suggestedKg) {
      toast.success(`${lib.name}: ${suggestedKg} kg aus Strength-Test`);
    }
  }

  function removeExercise(week: number, weekday: number, idx: number) {
    mutateDays((prev) =>
      prev.map((d) => {
        if (d.week_number !== week || d.weekday !== weekday) return d;
        return { ...d, exercises: d.exercises.filter((_, i) => i !== idx) };
      }),
    );
  }

  function moveExercise(
    source: DragExercisePayload,
    target: { week: number; weekday: number; index: number },
  ) {
    mutateDays((prev) => {
      const sourceDay = prev.find(
        (day) => day.week_number === source.week && day.weekday === source.weekday,
      );
      const targetDay = prev.find(
        (day) => day.week_number === target.week && day.weekday === target.weekday,
      );
      const movingExercise = sourceDay?.exercises[source.index];
      if (!sourceDay || !targetDay || !movingExercise || targetDay.type !== "training") return prev;

      if (source.week === target.week && source.weekday === target.weekday) {
        const reordered = [...sourceDay.exercises];
        reordered.splice(source.index, 1);
        const adjustedTarget = source.index < target.index ? target.index - 1 : target.index;
        reordered.splice(
          Math.max(0, Math.min(adjustedTarget, reordered.length)),
          0,
          movingExercise,
        );
        return prev.map((day) => (day === sourceDay ? { ...day, exercises: reordered } : day));
      }

      return prev.map((day) => {
        if (day === sourceDay) {
          return {
            ...day,
            exercises: day.exercises.filter((_, index) => index !== source.index),
          };
        }
        if (day === targetDay) {
          const targetExercises = [...day.exercises];
          targetExercises.splice(
            Math.max(0, Math.min(target.index, targetExercises.length)),
            0,
            movingExercise,
          );
          return { ...day, exercises: targetExercises };
        }
        return day;
      });
    });
    setSelectedDayKey(builderDayKey(target.week, target.weekday));
  }

  function openLibraryForDay(week: number, weekday: number) {
    setSelectedDayKey(builderDayKey(week, weekday));
    requestAnimationFrame(() => {
      libraryPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function addExerciseToSelected(lib: LibraryExercise) {
    if (!selectedDayKey) {
      toast.error("Wähle zuerst einen Trainingstag aus.");
      return;
    }
    const [weekRaw, weekdayRaw] = selectedDayKey.split(":");
    const week = Number(weekRaw);
    const weekday = Number(weekdayRaw);
    if (!Number.isInteger(week) || !Number.isInteger(weekday)) {
      toast.error("Trainingstag konnte nicht ermittelt werden.");
      return;
    }
    addExercise(week, weekday, lib);
    toast.success(`${lib.name} hinzugefügt`);
  }

  function removeDay(week: number, weekday: number) {
    mutateDays((prev) => prev.filter((d) => !(d.week_number === week && d.weekday === weekday)));
    toast.success("Tag gelöscht");
  }

  function addDay(week: number, weekday: number) {
    mutateDays((prev) => {
      if (prev.some((d) => d.week_number === week && d.weekday === weekday)) {
        toast.error("Tag existiert bereits");
        return prev;
      }
      return [
        ...prev,
        {
          week_number: week,
          weekday,
          name: WD_LONG[weekday],
          type: "training",
          exercises: [],
        } as BuilderTrainingDay,
      ];
    });
  }

  function copyWeek(from: number, to: number) {
    if (from === to) return;
    mutateDays((prev) => {
      const src = prev.filter((d) => d.week_number === from);
      if (!src.length) {
        toast.error(`Woche ${from} ist leer`);
        return prev;
      }
      const cloned: BuilderTrainingDay[] = src.map((d) => ({
        ...d,
        week_number: to,
        exercises: d.exercises.map((ex) => ({ ...ex })),
      }));
      toast.success(`Woche ${from} → Woche ${to} kopiert`);
      return [...prev.filter((d) => d.week_number !== to), ...cloned];
    });
  }

  function runAutoFillWeek() {
    if (!ctx || !days) return;
    const wds = days
      .filter((d) => d.week_number === activeWeek && d.type === "training")
      .map((d) => d.weekday);
    const filled = autoFillTrainingPlan(
      activeSide === "client" ? ctx : partnerCtx!,
      library,
      weeksCount,
      wds.length ? wds : clientWeekdays,
      days,
    );
    // Replace only the active week
    setDays(
      days.map((d) =>
        d.week_number === activeWeek
          ? filled.find((f) => f.week_number === activeWeek && f.weekday === d.weekday)!
          : d,
      ),
    );
    toast.success(`Woche ${activeWeek} automatisch befüllt`);
  }

  function runAutoFillAll() {
    if (!ctx || !days) return;
    const wds = ctx.trainingWeekdays.length ? ctx.trainingWeekdays : clientWeekdays;
    const filled = autoFillTrainingPlan(
      activeSide === "client" ? ctx : partnerCtx!,
      library,
      weeksCount,
      wds,
      days,
    );
    setDays(filled);
    toast.success(`Alle ${weeksCount} Wochen automatisch befüllt`);
  }

  const saveMut = useMutation({
    mutationFn: async (shouldPublish: boolean) => {
      if (!clientDays) throw new Error("Keine Tage");
      if (partnerMode && ctx?.partnerId && partnerDays) {
        return savePartnerFn({
          data: {
            customerId: userId,
            partnerId: ctx.partnerId,
            title,
            startDate,
            weeksCount,
            clientDays,
            partnerDays,
            publish: shouldPublish,
          },
        });
      }
      return saveFn({
        data: {
          customerId: userId,
          title,
          startDate,
          weeksCount,
          days: clientDays,
          publish: shouldPublish,
        },
      });
    },
    onSuccess: (res, shouldPublish) => {
      toast.success(shouldPublish ? "Plan wurde dem Kunden zugewiesen" : "Entwurf gespeichert");
      const pid = "plan_id" in res ? res.plan_id : res.client_plan_id;
      if (returnOrgId) {
        navigate({
          to: "/coach/teams/$orgId/athletes/$userId",
          params: { orgId: returnOrgId, userId },
        });
      } else if (pid) navigate({ to: "/coach/plan-preview/$planId", params: { planId: pid } });
    },
    onError: (error) => toast.error(error.message || "Fehler beim Speichern"),
  });

  if (ctxQ.isLoading || libQ.isLoading) {
    return (
      <div className="training-v2-shell rounded-3xl border border-border bg-background p-10 text-center text-sm text-muted-foreground">
        Training Builder wird geladen…
      </div>
    );
  }
  if (ctxQ.error) {
    return (
      <div className="training-v2-shell rounded-3xl border border-destructive/30 bg-background p-6 text-sm text-destructive">
        Builder konnte nicht geladen werden: {ctxQ.error.message}
      </div>
    );
  }

  const selectedDay = currentWeekDays.find(
    (day) => builderDayKey(day.week_number, day.weekday) === selectedDayKey,
  );
  const totalWeekExercises = currentWeekDays.reduce(
    (sum, day) => sum + (day.type === "training" ? day.exercises.length : 0),
    0,
  );

  return (
    <ExerciseMediaLibraryContext.Provider value={library}>
    <div className="training-v2-shell -mx-4 -my-6 min-h-[calc(100vh-4rem)] bg-background px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-10 lg:-my-10 lg:px-8 lg:py-8">

      <div className="mx-auto max-w-[1380px] space-y-5">
        <div className="flex items-center justify-between gap-3">
          {returnOrgId ? (
            <Link
              to="/coach/teams/$orgId/athletes/$userId"
              params={{ orgId: returnOrgId, userId }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" /> Zum Kunden
            </Link>
          ) : (
            <Link
              to="/coach/customers/$userId"
              params={{ userId }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" /> Zum Kunden
            </Link>
          )}
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Training V2
          </span>
        </div>

        <section className="rounded-3xl border border-border bg-card p-4 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.45)] sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Coach Workspace
              </p>
              <h1 className="mt-1 font-sans text-3xl font-black tracking-tight sm:text-4xl">
                Training Builder
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Plan erstellen, zuweisen und direkt im Kundentracking verfügbar machen.
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row xl:min-w-[530px]">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-black text-primary">
                  {(ctx?.displayName ?? "K")
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Kunde
                  </div>
                  <div className="truncate text-sm font-bold">{ctx?.displayName ?? "Kunde"}</div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => saveMut.mutate(false)}
                  disabled={saveMut.isPending}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> Entwurf
                </button>
                <button
                  type="button"
                  onClick={() => saveMut.mutate(true)}
                  disabled={saveMut.isPending}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground shadow-[0_12px_28px_-14px_rgba(16,185,90,0.9)] transition hover:brightness-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saveMut.isPending ? "Speichert…" : "Plan zuweisen"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Dumbbell className="h-5 w-5 shrink-0 text-primary" />
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  aria-label="Name des Trainingsplans"
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-xl font-black tracking-tight text-foreground outline-none placeholder:text-foreground/70 sm:text-2xl"
                  placeholder="Name des Trainingsplans"
                />
                <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold transition hover:border-primary/40 hover:text-primary"
                >
                  <BookOpen className="h-4 w-4" /> Vorlage laden
                </button>
                <button
                  type="button"
                  onClick={() => setSaveTplOpen(true)}
                  disabled={!clientDays}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {templateId ? "Vorlage aktualisieren" : "Als Vorlage speichern"}
                </button>
                {templateId && (
                  <span className="rounded-full bg-primary/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Vorlage verknüpft
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <TrainingTemplateLibraryDialog
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          onSelect={applyTemplate}
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.3fr]">
          <label className="rounded-2xl border border-border bg-card p-4">
            <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 text-primary" /> Startdatum
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
          </label>

          <label className="rounded-2xl border border-border bg-card p-4">
            <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5 text-primary" /> Laufzeit
            </span>
            <select
              value={weeksCount}
              onChange={(event) => {
                const nextWeeks = Number(event.target.value);
                setWeeksCount(nextWeeks);
                setClientDays(null);
                setPartnerDays(null);
                setActiveWeek(1);
              }}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            >
              {[1, 2, 3, 4, 5, 6, 8, 12].map((count) => (
                <option key={count} value={count}>
                  {count} Woche{count > 1 ? "n" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Kundenprofil
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ctx?.mainGoal && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                      {ctx.mainGoal}
                    </span>
                  )}
                  {ctx?.bodyweightKg && (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold">
                      {ctx.bodyweightKg} kg
                    </span>
                  )}
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold">
                    {totalWeekExercises} Übungen in Woche {activeWeek}
                  </span>
                </div>
              </div>
              {ctx?.hasPartner && (
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={partnerMode}
                    onChange={(event) => {
                      setPartnerMode(event.target.checked);
                      if (event.target.checked && !partnerDays && partnerCtx) {
                        setPartnerDays(emptyPlan(weeksCount, partnerWeekdays));
                      }
                    }}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  <Users className="h-4 w-4 text-primary" /> Partnerplan
                </label>
              )}
            </div>
          </div>
        </section>

        {partnerMode && (
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setActiveSide("client")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                activeSide === "client"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {ctx?.displayName ?? "Kunde"}
            </button>
            <button
              type="button"
              onClick={() => setActiveSide("partner")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                activeSide === "partner"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {ctx?.partnerName ?? "Partner"}
            </button>
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 no-scrollbar">
              {Array.from({ length: weeksCount }).map((_, index) => {
                const week = index + 1;
                return (
                  <button
                    key={week}
                    type="button"
                    onClick={() => setActiveWeek(week)}
                    className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      activeWeek === week
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    Woche {week}
                    {week === 4 && weeksCount >= 4 ? " · Deload" : ""}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={runAutoFillWeek}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/15"
              >
                <Sparkles className="h-4 w-4" /> Woche vorschlagen
              </button>
              <button
                type="button"
                onClick={runAutoFillAll}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/15"
              >
                <Sparkles className="h-4 w-4" /> Alle Wochen
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 lg:flex-row lg:items-center">
            {weeksCount > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <Copy className="h-3.5 w-3.5" /> Kopieren nach
                </span>
                {Array.from({ length: weeksCount }).map((_, index) => {
                  const targetWeek = index + 1;
                  if (targetWeek === activeWeek) return null;
                  return (
                    <button
                      key={targetWeek}
                      type="button"
                      onClick={() => copyWeek(activeWeek, targetWeek)}
                      className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[10px] font-bold transition hover:border-primary/40 hover:text-primary"
                    >
                      W{targetWeek}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 lg:ml-auto">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Tag hinzufügen
              </span>
              {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
                const exists = (days ?? []).some(
                  (day) => day.week_number === activeWeek && day.weekday === weekday,
                );
                if (exists) return null;
                return (
                  <button
                    key={weekday}
                    type="button"
                    onClick={() => addDay(activeWeek, weekday)}
                    className="rounded-lg border border-dashed border-primary/35 bg-primary/5 px-2.5 py-1.5 text-[10px] font-black uppercase text-primary transition hover:bg-primary/10"
                  >
                    + {WD_LABEL[weekday]}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-2">
          {currentWeekDays.map((day) => (
            <DayCard
              key={`${day.week_number}-${day.weekday}`}
              day={day}
              selected={builderDayKey(day.week_number, day.weekday) === selectedDayKey}
              onSelect={() => setSelectedDayKey(builderDayKey(day.week_number, day.weekday))}
              onUpdateDay={(patch) => updateDay(day.week_number, day.weekday, patch)}
              onUpdateEx={(index, patch) =>
                updateExercise(day.week_number, day.weekday, index, patch)
              }
              onAddFreeText={() => addExercise(day.week_number, day.weekday)}
              onOpenLibrary={() => openLibraryForDay(day.week_number, day.weekday)}
              onMoveEx={(source, targetIndex) =>
                moveExercise(source, {
                  week: day.week_number,
                  weekday: day.weekday,
                  index: targetIndex,
                })
              }
              onRemoveEx={(index) => removeExercise(day.week_number, day.weekday, index)}
              onRemoveDay={() => removeDay(day.week_number, day.weekday)}
            />
          ))}
          {currentWeekDays.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-bold">Woche {activeWeek} ist noch leer.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Füge oben mindestens einen Trainingstag hinzu.
              </p>
            </div>
          )}
        </section>

        <div ref={libraryPanelRef}>
          <ExerciseLibraryPanel
            library={library}
            selectedDayLabel={
              selectedDay
                ? `${WD_LONG[selectedDay.weekday]} · ${selectedDay.name || "Training"}`
                : null
            }
            onPick={addExerciseToSelected}
          />
        </div>

        <div className="sticky bottom-3 z-20 flex flex-col gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-[0_22px_60px_-24px_rgba(15,23,42,0.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden sm:block">
            <div className="text-xs font-black">{title || "Trainingsplan"}</div>
            <div className="text-[10px] text-muted-foreground">
              {weeksCount} Woche{weeksCount > 1 ? "n" : ""} · Start{" "}
              {new Date(`${startDate}T00:00:00`).toLocaleDateString("de-DE")}
            </div>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={() => saveMut.mutate(false)}
              disabled={saveMut.isPending}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-xs font-bold transition hover:border-primary/40 disabled:opacity-50 sm:flex-none"
            >
              Entwurf speichern
            </button>
            <button
              type="button"
              onClick={() => saveMut.mutate(true)}
              disabled={saveMut.isPending}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-black text-primary-foreground transition hover:brightness-95 disabled:opacity-50 sm:flex-none"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saveMut.isPending ? "Speichert…" : "Plan zuweisen"}
            </button>
          </div>
        </div>

        <SaveAsTemplateDialog
          open={saveTplOpen}
          onOpenChange={setSaveTplOpen}
          defaultName={title}
          saving={saveTplM.isPending}
          onConfirm={(values) => saveTplM.mutate(values)}
        />
      </div>
    </div>
  );
}

function DayCard({
  day,
  selected,
  onSelect,
  onUpdateDay,
  onUpdateEx,
  onAddFreeText,
  onOpenLibrary,
  onMoveEx,
  onRemoveEx,
  onRemoveDay,
}: {
  day: BuilderTrainingDay;
  selected: boolean;
  onSelect: () => void;
  onUpdateDay: (patch: Partial<BuilderTrainingDay>) => void;
  onUpdateEx: (idx: number, patch: Partial<BuilderTrainingExercise>) => void;
  onAddFreeText: () => void;
  onOpenLibrary: () => void;
  onMoveEx: (source: DragExercisePayload, targetIndex: number) => void;
  onRemoveEx: (idx: number) => void;
  onRemoveDay: () => void;
}) {
  return (
    <article
      onClick={onSelect}
      onFocusCapture={onSelect}
      onDragOver={(event) => {
        if (day.type === "training") event.preventDefault();
      }}
      onDrop={(event) => {
        if (day.type !== "training") return;
        event.preventDefault();
        const source = readExerciseDragPayload(event);
        if (source) onMoveEx(source, day.exercises.length);
      }}
      className={`overflow-hidden rounded-2xl border bg-card shadow-[0_18px_45px_-36px_rgba(15,23,42,0.55)] transition ${
        selected ? "border-primary ring-2 ring-primary/10" : "border-border hover:border-primary/35"
      }`}
    >
      <header className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
              {WD_LONG[day.weekday]}
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">
              {day.exercises.length} Übung{day.exercises.length === 1 ? "" : "en"}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={day.name}
              onChange={(event) => onUpdateDay({ name: event.target.value })}
              placeholder="z. B. Oberkörper"
              aria-label={`Name für ${WD_LONG[day.weekday]}`}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-base font-black text-foreground outline-none placeholder:text-foreground/75"
            />
            <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onUpdateDay({ type: "training" })}
            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${
              day.type === "training"
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            Training
          </button>
          <button
            type="button"
            onClick={() => onUpdateDay({ type: "rest", exercises: [] })}
            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${
              day.type === "rest"
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            Ruhetag
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Tag "${day.name || WD_LONG[day.weekday]}" wirklich löschen?`))
                onRemoveDay();
            }}
            title="Tag löschen"
            className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {day.type === "training" && (
        <div className="p-3 sm:p-4">
          {day.exercises.length > 0 && (
            <div className="mb-2 hidden grid-cols-[1.25rem_minmax(9rem,1.5fr)_repeat(5,minmax(3rem,.55fr))_4.5rem] gap-2 px-2 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground lg:grid">
              <span />
              <span>Übung</span>
              <span>Sätze</span>
              <span>Wdh.</span>
              <span>kg</span>
              <span>RIR</span>
              <span>Pause</span>
              <span />
            </div>
          )}

          <div className="space-y-2">
            {day.exercises.map((exercise, index) => (
              <ExerciseRow
                key={`${exercise.library_exercise_id ?? exercise.name}-${index}`}
                ex={exercise}
                dragPayload={{ week: day.week_number, weekday: day.weekday, index }}
                onDropBefore={(source) => onMoveEx(source, index)}
                onChange={(patch) => onUpdateEx(index, patch)}
                onRemove={() => onRemoveEx(index)}
              />
            ))}
          </div>

          {day.exercises.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-background/60 p-6 text-center">
              <Dumbbell className="mx-auto h-6 w-6 text-muted-foreground/45" />
              <p className="mt-2 text-xs font-bold">Noch keine Übungen</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Wähle Übungen aus der Bibliothek oder erstelle einen Freitext-Eintrag.
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenLibrary}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-xs font-black text-primary transition hover:bg-primary/15"
            >
              <Plus className="h-4 w-4" /> Übung hinzufügen
            </button>
            <button
              type="button"
              onClick={onAddFreeText}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold transition hover:border-primary/35"
            >
              <Pencil className="h-3.5 w-3.5" /> Freitext
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function ExerciseRow({
  ex,
  dragPayload,
  onDropBefore,
  onChange,
  onRemove,
}: {
  ex: BuilderTrainingExercise;
  dragPayload: DragExercisePayload;
  onDropBefore: (source: DragExercisePayload) => void;
  onChange: (patch: Partial<BuilderTrainingExercise>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(EXERCISE_DRAG_TYPE, JSON.stringify(dragPayload));
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const source = readExerciseDragPayload(event);
        if (source) onDropBefore(source);
      }}
      className="group rounded-xl border border-border bg-background p-2 transition hover:border-primary/30 hover:shadow-sm"
    >
      <div className="grid items-center gap-2 lg:grid-cols-[1.25rem_minmax(9rem,1.5fr)_repeat(5,minmax(3rem,.55fr))_4.5rem]">
        <button
          type="button"
          className="hidden cursor-grab touch-none text-muted-foreground/55 active:cursor-grabbing lg:block"
          aria-label={`${ex.name || "Übung"} verschieben`}
          title="Ziehen zum Verschieben"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/55 lg:hidden" />
          <input
            value={ex.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Übungsname"
            aria-label="Übungsname"
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-2 text-sm font-bold text-foreground outline-none transition placeholder:text-foreground/70 hover:border-border focus:border-primary focus:bg-card"
          />
        </div>

        <NumField
          label="Sätze"
          value={ex.target_sets}
          min={1}
          max={20}
          onChange={(value) => onChange({ target_sets: value })}
        />
        <TextField
          label="Wdh."
          value={ex.target_reps}
          onChange={(value) => onChange({ target_reps: value })}
        />
        <TextField
          label="kg"
          value={ex.target_weights}
          onChange={(value) => onChange({ target_weights: value })}
        />
        <NumField
          label="RIR"
          value={ex.target_rir}
          min={0}
          max={10}
          onChange={(value) => onChange({ target_rir: value })}
        />
        <NumField
          label="Pause"
          value={ex.rest_seconds}
          min={0}
          max={600}
          step={5}
          onChange={(value) => onChange({ rest_seconds: value })}
        />

        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => onChange({ is_locked: !ex.is_locked })}
            title={ex.is_locked ? "Übung entsperren" : "Übung sperren"}
            className={`rounded-lg p-2 transition ${
              ex.is_locked ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {ex.is_locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            aria-label={`${ex.name || "Übung"} entfernen`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <details className="mt-1 border-t border-border/70 pt-1">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-muted-foreground transition hover:text-primary">
          <SlidersHorizontal className="h-3 w-3" /> Details & Smart-Steuerung
        </summary>
        <div className="grid gap-2 p-2 sm:grid-cols-[minmax(10rem,.8fr)_1fr]">
          <label className="block">
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Smart-Lock
            </span>
            <select
              value={(ex.smart_lock ?? "none") as string}
              onChange={(event) =>
                onChange({
                  smart_lock: event.target.value as BuilderTrainingExercise["smart_lock"],
                })
              }
              className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs outline-none focus:border-primary"
            >
              <option value="none">Fuely darf anpassen</option>
              <option value="locked">Komplett gesperrt</option>
              <option value="weight_only">Nur Gewicht</option>
              <option value="reps_only">Nur Wiederholungen</option>
              <option value="volume_only">Nur Volumen</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Coach-Notiz
            </span>
            <input
              value={ex.notes ?? ""}
              onChange={(event) => onChange({ notes: event.target.value || null })}
              placeholder="Technik, Tempo oder Alternative …"
              className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs outline-none focus:border-primary"
            />
          </label>
        </div>
      </details>
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground lg:sr-only">
        {label}
      </span>
      <input
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        aria-label={label}
        className="w-full rounded-lg border border-border bg-card px-2 py-2 text-center text-xs font-bold text-foreground outline-none transition placeholder:text-foreground/70 focus:border-primary"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground lg:sr-only">
        {label}
      </span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={label}
        className="w-full rounded-lg border border-border bg-card px-2 py-2 text-center text-xs font-bold text-foreground outline-none transition placeholder:text-foreground/70 focus:border-primary"
      />
    </label>
  );
}

const MUSCLE_GROUPS: { key: string; label: string; muscles: string[] }[] = [
  { key: "chest", label: "Brust", muscles: ["chest", "upper_chest"] },
  { key: "back", label: "Rücken", muscles: ["back", "lats", "traps", "lower_back", "rear_delts"] },
  { key: "shoulders", label: "Schultern", muscles: ["shoulders", "side_delts", "front_delts"] },
  { key: "arms", label: "Arme", muscles: ["biceps", "triceps", "forearms"] },
  {
    key: "legs",
    label: "Beine",
    muscles: ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors", "hips"],
  },
  { key: "core", label: "Bauch", muscles: ["core", "obliques"] },
  { key: "cardio", label: "Cardio", muscles: ["cardio"] },
  { key: "stretch", label: "Dehnung", muscles: [] }, // by category
];

function groupOf(l: LibraryExercise): string {
  if (l.category === "stretch") return "stretch";
  const pm = (l.primary_muscle || "").toLowerCase();
  for (const g of MUSCLE_GROUPS) {
    if (g.muscles.includes(pm)) return g.key;
  }
  return "other";
}

function ExerciseLibraryPanel({
  library,
  selectedDayLabel,
  onPick,
}: {
  library: LibraryExercise[];
  selectedDayLabel: string | null;
  onPick: (exercise: LibraryExercise) => void;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [mediaFor, setMediaFor] = useState<LibraryExercise | null>(null);


  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = library;
    if (term) {
      list = list.filter(
        (exercise) =>
          exercise.name.toLowerCase().includes(term) ||
          exercise.primary_muscle.toLowerCase().includes(term) ||
          exercise.movement_pattern.toLowerCase().includes(term) ||
          (exercise.equipment ?? []).some((item) => item.toLowerCase().includes(term)),
      );
    } else if (group !== "all") {
      list = list.filter((exercise) => groupOf(exercise) === group);
    }
    return list
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .slice(0, 24);
  }, [library, q, group]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-[0_18px_45px_-38px_rgba(15,23,42,0.5)] sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Bibliothek
          </p>
          <h2 className="mt-1 font-sans text-xl font-black tracking-tight">Übungsbibliothek</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedDayLabel
              ? `Neue Übungen werden zu „${selectedDayLabel}“ hinzugefügt.`
              : "Wähle oben zuerst einen Trainingstag aus."}
          </p>
        </div>

        <label className="relative block w-full xl:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Übung, Muskel oder Equipment suchen …"
            className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[{ key: "all", label: "Alle" }, ...MUSCLE_GROUPS].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setGroup(item.key);
              if (q) setQ("");
            }}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-black transition ${
              group === item.key && !q
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/35"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-background p-8 text-center">
          <Search className="mx-auto h-6 w-6 text-muted-foreground/45" />
          <p className="mt-2 text-xs font-bold">Keine passende Übung gefunden.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((exercise) => {
            const media = normalizeExerciseMedia(exercise);
            return (
              <div
                key={exercise.id}
                className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background p-2.5 text-card-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setMediaFor(exercise)}
                  aria-label={`Medien für ${exercise.name} ansehen oder pflegen`}
                  className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ExerciseMediaThumb
                    media={media}
                    name={exercise.name}
                    muscle={exercise.primary_muscle}
                    size={56}
                  />
                </button>
                <button
                  type="button"
                  disabled={!selectedDayLabel}
                  onClick={() => onPick(exercise)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left transition disabled:cursor-not-allowed disabled:text-muted-foreground"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-foreground">
                      {exercise.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] font-semibold text-muted-foreground">
                      {exercise.primary_muscle} · {exercise.default_sets} × {exercise.default_reps}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                </button>
              </div>
            );
          })}
        </div>

      )}

      {library.length > filtered.length && (
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          {filtered.length} von {library.length} Übungen angezeigt · Nutze die Suche für weitere
          Ergebnisse.
        </p>
      )}

      <ExerciseMediaEditorDialog exercise={mediaFor} onClose={() => setMediaFor(null)} />
    </section>

  );
}
