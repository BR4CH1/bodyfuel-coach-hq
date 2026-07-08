import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Plus, Lock, LockOpen, Sparkles, Trash2, Users, Pencil, BookOpen, Save } from "lucide-react";
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
import { saveAsTrainingTemplate, type TrainingTemplateDetail } from "@/lib/training-templates.functions";
import { autoFillTrainingPlan, emptyPlan } from "@/lib/training-autofill";
import {
  TrainingTemplateLibraryDialog,
  SaveAsTemplateDialog,
} from "@/components/bodyfuel/TrainingTemplateDialogs";


const WD_LABEL = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WD_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mo..So

function isoToday(): string {
  const d = new Date();
  // next Monday
  const day = d.getDay();
  const diff = (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
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
  const [publish, setPublish] = useState(false);
  const [partnerMode, setPartnerMode] = useState(false);
  const [activeSide, setActiveSide] = useState<"client" | "partner">("client");
  const [activeWeek, setActiveWeek] = useState(1);

  const [clientDays, setClientDays] = useState<BuilderTrainingDay[] | null>(null);
  const [partnerDays, setPartnerDays] = useState<BuilderTrainingDay[] | null>(null);
  const [loadedPlanApplied, setLoadedPlanApplied] = useState(false);

  const ctx = ctxQ.data;
  const partnerCtx = partnerCtxQ.data;
  const library = libQ.data ?? [];

  // Initialize
  const clientWeekdays = ctx?.trainingWeekdays?.length ? ctx.trainingWeekdays : [1, 3, 5];
  const partnerWeekdays = partnerCtx?.trainingWeekdays?.length ? partnerCtx.trainingWeekdays : clientWeekdays;

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
    if (partnerMode && !partnerDays && partnerCtx) setPartnerDays(emptyPlan(weeksCount, partnerWeekdays));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, partnerCtx, partnerMode, weeksCount, planId, loadedPlanApplied]);


  const currentWeekDays = useMemo(
    () => (days ?? []).filter((d) => d.week_number === activeWeek).sort((a, b) => WD_ORDER.indexOf(a.weekday) - WD_ORDER.indexOf(b.weekday)),
    [days, activeWeek],
  );

  const activeBaseline = (activeSide === "client" ? ctx : partnerCtx)?.baseline ?? null;

  function mutateDays(fn: (prev: BuilderTrainingDay[]) => BuilderTrainingDay[]) {
    if (activeSide === "client") setClientDays((prev) => (prev ? fn(prev) : prev));
    else setPartnerDays((prev) => (prev ? fn(prev) : prev));
  }

  function updateDay(week: number, weekday: number, patch: Partial<BuilderTrainingDay>) {
    mutateDays((prev) => prev.map((d) => (d.week_number === week && d.weekday === weekday ? { ...d, ...patch } : d)));
  }

  function updateExercise(week: number, weekday: number, idx: number, patch: Partial<BuilderTrainingExercise>) {
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
        };
    mutateDays((prev) =>
      prev.map((d) =>
        d.week_number === week && d.weekday === weekday ? { ...d, exercises: [...d.exercises, newEx] } : d,
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
    const wds = (days.filter((d) => d.week_number === activeWeek && d.type === "training").map((d) => d.weekday));
    const filled = autoFillTrainingPlan(
      activeSide === "client" ? ctx : partnerCtx!,
      library,
      weeksCount,
      wds.length ? wds : clientWeekdays,
      days,
    );
    // Replace only the active week
    setDays(days.map((d) => (d.week_number === activeWeek ? filled.find((f) => f.week_number === activeWeek && f.weekday === d.weekday)! : d)));
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
    mutationFn: async () => {
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
            publish,
          },
        });
      }
      return saveFn({ data: { customerId: userId, title, startDate, weeksCount, days: clientDays, publish } });
    },
    onSuccess: (res: any) => {
      toast.success(publish ? "Plan aktiviert" : "Entwurf gespeichert");
      const pid = res.plan_id ?? res.client_plan_id;
      if (returnOrgId) {
        navigate({
          to: "/coach/teams/$orgId/athletes/$userId",
          params: { orgId: returnOrgId, userId },
        });
      } else if (pid) navigate({ to: "/coach/plan-preview/$planId", params: { planId: pid } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Speichern"),
  });

  if (ctxQ.isLoading || libQ.isLoading) return <div className="p-6 text-sm text-muted-foreground">Lade…</div>;
  if (ctxQ.error) return <div className="p-6 text-sm text-destructive">Fehler: {(ctxQ.error as any).message}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {returnOrgId ? (
          <Link
            to="/coach/teams/$orgId/athletes/$userId"
            params={{ orgId: returnOrgId, userId }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" /> Zurück
          </Link>
        ) : (
          <Link to="/coach/customers/$userId" params={{ userId }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-3 w-3" /> Zurück
          </Link>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Coach</p>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Trainingsplan manuell erstellen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Für {ctx?.displayName ?? "Kunde"}
          {ctx?.hasPartner && (
            <> · Partner: <span className="font-medium">{ctx.partnerName ?? "Partner"}</span></>
          )}
        </p>
      </div>

      {/* Header controls */}
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Titel</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Start (Montag)</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Wochen</label>
          <select
            value={weeksCount}
            onChange={(e) => {
              const n = Number(e.target.value);
              setWeeksCount(n);
              setClientDays(null);
              setPartnerDays(null);
              setActiveWeek(1);
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>{n} Woche{n > 1 ? "n" : ""}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            <span>Direkt aktivieren</span>
          </label>
          {ctx?.hasPartner && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={partnerMode}
                onChange={(e) => {
                  setPartnerMode(e.target.checked);
                  if (e.target.checked && !partnerDays && partnerCtx) setPartnerDays(emptyPlan(weeksCount, partnerWeekdays));
                }}
              />
              <Users className="h-3.5 w-3.5" />
              <span>Partnerplan</span>
            </label>
          )}
        </div>
      </div>

      {/* Side tabs (partner mode) */}
      {partnerMode && (
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSide("client")}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${activeSide === "client" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            {ctx?.displayName ?? "Kunde"}
          </button>
          <button
            onClick={() => setActiveSide("partner")}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${activeSide === "partner" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            {ctx?.partnerName ?? "Partner"}
          </button>
        </div>
      )}

      {/* Week tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: weeksCount }).map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveWeek(i + 1)}
            className={`rounded-full border px-3 py-1 text-xs ${activeWeek === i + 1 ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            Woche {i + 1}
            {i === 3 && weeksCount >= 4 ? " (Deload)" : ""}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            onClick={runAutoFillWeek}
            className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20"
          >
            <Sparkles className="h-3.5 w-3.5" /> Woche vorschlagen
          </button>
          <button
            onClick={runAutoFillAll}
            className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20"
          >
            <Sparkles className="h-3.5 w-3.5" /> Alle Wochen
          </button>
        </div>
      </div>

      {/* Week actions */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Woche {activeWeek}</span>
        {weeksCount > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">kopieren nach:</span>
            {Array.from({ length: weeksCount }).map((_, i) => {
              const w = i + 1;
              if (w === activeWeek) return null;
              return (
                <button
                  key={w}
                  onClick={() => copyWeek(activeWeek, w)}
                  className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  W{w}
                </button>
              );
            })}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Tag hinzufügen:</span>
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
            const exists = (days ?? []).some((d) => d.week_number === activeWeek && d.weekday === wd);
            if (exists) return null;
            return (
              <button
                key={wd}
                onClick={() => addDay(activeWeek, wd)}
                className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase hover:bg-muted"
              >
                {WD_LABEL[wd]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Days */}
      <div className="space-y-3">
        {currentWeekDays.map((d) => (
          <DayCard
            key={`${d.week_number}-${d.weekday}`}
            day={d}
            library={library}
            onUpdateDay={(patch) => updateDay(d.week_number, d.weekday, patch)}
            onUpdateEx={(idx, patch) => updateExercise(d.week_number, d.weekday, idx, patch)}
            onAddEx={(lib) => addExercise(d.week_number, d.weekday, lib)}
            onRemoveEx={(idx) => removeExercise(d.week_number, d.weekday, idx)}
            onRemoveDay={() => removeDay(d.week_number, d.weekday)}
          />
        ))}
        {currentWeekDays.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Keine Tage in Woche {activeWeek}. Füge oben Tage hinzu.
          </div>
        )}
      </div>

      {/* Save */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 p-4 backdrop-blur">
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="w-full rounded-lg bg-gradient-gold py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saveMut.isPending ? "Speichere…" : publish ? "Für Kunden aktivieren" : "Als Entwurf speichern"}
        </button>
      </div>
    </div>
  );
}

function DayCard({
  day,
  library,
  onUpdateDay,
  onUpdateEx,
  onAddEx,
  onRemoveEx,
  onRemoveDay,
}: {
  day: BuilderTrainingDay;
  library: LibraryExercise[];
  onUpdateDay: (patch: Partial<BuilderTrainingDay>) => void;
  onUpdateEx: (idx: number, patch: Partial<BuilderTrainingExercise>) => void;
  onAddEx: (lib?: LibraryExercise) => void;
  onRemoveEx: (idx: number) => void;
  onRemoveDay: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">{WD_LABEL[day.weekday]}</span>
            <span className="text-xs text-muted-foreground">{WD_LONG[day.weekday]}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={day.name}
              onChange={(e) => onUpdateDay({ name: e.target.value })}
              placeholder="Tag-Name (z.B. Push Day)"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm font-semibold outline-none focus:border-primary"
            />
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onUpdateDay({ type: "training" })}
            className={`rounded-md border px-2 py-1 text-[10px] ${day.type === "training" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            Training
          </button>
          <button
            onClick={() => onUpdateDay({ type: "rest", exercises: [] })}
            className={`rounded-md border px-2 py-1 text-[10px] ${day.type === "rest" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            Ruhetag
          </button>
          <button
            onClick={() => {
              if (confirm(`Tag "${day.name || WD_LONG[day.weekday]}" wirklich löschen?`)) onRemoveDay();
            }}
            title="Tag löschen"
            className="rounded-md border border-border px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {day.type === "training" && (
        <>
          <div className="mt-3 space-y-2">
            {day.exercises.map((ex, i) => (
              <ExerciseRow key={i} ex={ex} onChange={(patch) => onUpdateEx(i, patch)} onRemove={() => onRemoveEx(i)} />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              <Plus className="h-3 w-3" /> Übung
            </button>
            <button
              onClick={() => onAddEx()}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              <Plus className="h-3 w-3" /> Freitext
            </button>
          </div>
          {pickerOpen && (
            <ExercisePicker
              library={library}
              onPick={(lib) => {
                onAddEx(lib);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

function ExerciseRow({
  ex,
  onChange,
  onRemove,
}: {
  ex: BuilderTrainingExercise;
  onChange: (patch: Partial<BuilderTrainingExercise>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2">
      <div className="flex items-center gap-2">
        <input
          value={ex.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Übungsname"
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <button
          onClick={() => onChange({ is_locked: !ex.is_locked })}
          title={ex.is_locked ? "Entsperren" : "Sperren"}
          className={`rounded-md p-1.5 ${ex.is_locked ? "text-gold" : "text-muted-foreground"}`}
        >
          {ex.is_locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
        </button>
        <button onClick={onRemove} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1">
        <NumField label="Sätze" value={ex.target_sets} onChange={(v) => onChange({ target_sets: v })} />
        <TextField label="Wdh" value={ex.target_reps} onChange={(v) => onChange({ target_reps: v })} />
        <TextField label="kg" value={ex.target_weights} onChange={(v) => onChange({ target_weights: v })} />
        <NumField label="RIR" value={ex.target_rir} onChange={(v) => onChange({ target_rir: v })} />
        <NumField label="Pause" value={ex.rest_seconds} onChange={(v) => onChange({ rest_seconds: v })} />
      </div>
      <input
        value={ex.notes ?? ""}
        onChange={(e) => onChange({ notes: e.target.value || null })}
        placeholder="Notiz (optional)"
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
      />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full rounded-md border border-border bg-background px-1.5 py-1 text-xs"
      />
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label className="block">
      <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-md border border-border bg-background px-1.5 py-1 text-xs"
      />
    </label>
  );
}

const MUSCLE_GROUPS: { key: string; label: string; muscles: string[] }[] = [
  { key: "chest", label: "Brust", muscles: ["chest", "upper_chest"] },
  { key: "back", label: "Rücken", muscles: ["back", "lats", "traps", "lower_back", "rear_delts"] },
  { key: "shoulders", label: "Schultern", muscles: ["shoulders", "side_delts", "front_delts"] },
  { key: "arms", label: "Arme", muscles: ["biceps", "triceps", "forearms"] },
  { key: "legs", label: "Beine", muscles: ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors", "hips"] },
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

function ExercisePicker({ library, onPick, onClose }: { library: LibraryExercise[]; onPick: (l: LibraryExercise) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("chest");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = library;
    if (term) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(term) ||
          l.primary_muscle.toLowerCase().includes(term) ||
          l.movement_pattern.toLowerCase().includes(term),
      );
    } else {
      list = list.filter((l) => groupOf(l) === group);
    }
    return list.slice().sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [library, q, group]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-base font-bold">Übung wählen</h3>
          <button onClick={onClose} className="text-xs text-muted-foreground">Schließen</button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Suche (Name, Muskel, Pattern)…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {!q.trim() && (
          <div className="mt-2 flex flex-wrap gap-1">
            {MUSCLE_GROUPS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGroup(g.key)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${group === g.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 max-h-[60vh] space-y-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">Keine Übungen gefunden.</p>
          )}
          {filtered.map((l) => (
            <button
              key={l.id}
              onClick={() => onPick(l)}
              className="flex w-full items-center justify-between rounded-md border border-border bg-background px-2 py-1.5 text-left text-xs hover:bg-muted"
            >
              <span className="font-medium">{l.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {l.primary_muscle} · {l.movement_pattern}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

