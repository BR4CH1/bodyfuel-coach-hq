import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  CalendarDays,
  Footprints,
  Home,
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { TrainingPlanBuilderPage } from "@/components/bodyfuel/TrainingPlanBuilderPage";
import {
  getAthleteWeeklyTrainingPlan,
  saveAthleteWeeklyTrainingPlan,
  WEEKLY_TRAINING_ACTIVITY_LABELS,
  type WeeklyTrainingActivity,
  type WeeklyTrainingActivityType,
  type WeeklyTrainingDayPlan,
} from "@/lib/training-weekly-activity.functions";

const WEEKDAYS = [
  { value: 1, short: "Mo", long: "Montag" },
  { value: 2, short: "Di", long: "Dienstag" },
  { value: 3, short: "Mi", long: "Mittwoch" },
  { value: 4, short: "Do", long: "Donnerstag" },
  { value: 5, short: "Fr", long: "Freitag" },
  { value: 6, short: "Sa", long: "Samstag" },
  { value: 0, short: "So", long: "Sonntag" },
] as const;

const ACTIVITY_OPTIONS: Array<{ type: WeeklyTrainingActivityType; label: string }> = [
  { type: "class", label: "Kurs" },
  { type: "home_workout", label: "Home Workout" },
  { type: "cardio", label: "Cardio" },
  { type: "mobility", label: "Mobility" },
];

type PortalSlot = {
  weekday: number;
  element: HTMLDivElement;
};

type SyncState = "idle" | "saving" | "saved" | "error";

function newActivity(type: WeeklyTrainingActivityType): WeeklyTrainingActivity {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `activity_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return {
    id,
    type,
    title:
      type === "class"
        ? ""
        : type === "home_workout"
          ? "Home Workout"
          : WEEKLY_TRAINING_ACTIVITY_LABELS[type],
    time: null,
    notes: null,
  };
}

function cloneDays(days: WeeklyTrainingDayPlan[]): WeeklyTrainingDayPlan[] {
  return days.map((day) => ({
    ...day,
    activities: day.activities.map((activity) => ({ ...activity })),
  }));
}

function sameSlots(a: PortalSlot[], b: PortalSlot[]) {
  return (
    a.length === b.length &&
    a.every((slot, index) =>
      slot.weekday === b[index]?.weekday && slot.element === b[index]?.element,
    )
  );
}

export function TrainingPlanBuilderWithWeeklyActivities({
  userId,
  planId,
  returnOrgId,
}: {
  userId: string;
  planId?: string;
  returnOrgId?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [slots, setSlots] = useState<PortalSlot[]>([]);
  const [days, setDays] = useState<WeeklyTrainingDayPlan[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const lastSavedRef = useRef("");
  const lastAttemptedRef = useRef("");

  const fetchPlan = useServerFn(getAthleteWeeklyTrainingPlan);
  const savePlan = useServerFn(saveAthleteWeeklyTrainingPlan);

  const planQ = useQuery({
    queryKey: ["weekly-training-activity-plan", userId],
    queryFn: () => fetchPlan({ data: { userId } }),
  });

  useEffect(() => {
    if (!planQ.data) return;
    const next = cloneDays(planQ.data.days);
    const serialized = JSON.stringify(next);
    lastSavedRef.current = serialized;
    lastAttemptedRef.current = serialized;
    setDays(next);
    setHydrated(true);
    setSyncState("saved");
  }, [planQ.data]);

  const serializedDays = useMemo(() => JSON.stringify(days), [days]);

  const saveM = useMutation({
    mutationFn: async (nextDays: WeeklyTrainingDayPlan[]) => {
      await savePlan({ data: { userId, days: nextDays } });
      return nextDays;
    },
    onMutate: () => setSyncState("saving"),
    onSuccess: (savedDays) => {
      lastSavedRef.current = JSON.stringify(savedDays);
      setSyncState("saved");
    },
    onError: (error) => {
      setSyncState("error");
      toast.error(error.message || "Wochenziele konnten nicht gespeichert werden");
    },
  });

  useEffect(() => {
    if (!hydrated || !days.length) return;
    if (serializedDays === lastSavedRef.current) return;
    if (serializedDays === lastAttemptedRef.current) return;

    const timeout = window.setTimeout(() => {
      const snapshot = cloneDays(days);
      lastAttemptedRef.current = JSON.stringify(snapshot);
      saveM.mutate(snapshot);
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [days, hydrated, saveM, serializedDays]);

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;

    let frame = 0;
    const syncSlots = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next: PortalSlot[] = [];

        for (const weekday of WEEKDAYS) {
          const dayNameInput = root.querySelector<HTMLInputElement>(
            `input[aria-label="Name für ${weekday.long}"]`,
          );
          const article = dayNameInput?.closest("article");
          if (!article) continue;

          let slot = article.querySelector<HTMLDivElement>(
            `[data-weekly-activity-inline-slot="${weekday.value}"]`,
          );
          if (!slot) {
            slot = document.createElement("div");
            slot.dataset.weeklyActivityInlineSlot = String(weekday.value);
            const header = article.querySelector("header");
            if (header) header.insertAdjacentElement("afterend", slot);
            else article.prepend(slot);
          }
          next.push({ weekday: weekday.value, element: slot });
        }

        next.sort(
          (a, b) =>
            WEEKDAYS.findIndex((weekday) => weekday.value === a.weekday) -
            WEEKDAYS.findIndex((weekday) => weekday.value === b.weekday),
        );
        setSlots((current) => (sameSlots(current, next) ? current : next));
      });
    };

    syncSlots();
    const observer = new MutationObserver(syncSlots);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  function updateDay(
    weekday: number,
    update: (day: WeeklyTrainingDayPlan) => WeeklyTrainingDayPlan,
  ) {
    setDays((current) => {
      const exists = current.some((day) => day.weekday === weekday);
      if (!exists) {
        return [...current, update({ weekday, stepTarget: null, activities: [] })];
      }
      return current.map((day) => (day.weekday === weekday ? update(day) : day));
    });
  }

  return (
    <div ref={hostRef}>
      <TrainingPlanBuilderPage userId={userId} planId={planId} returnOrgId={returnOrgId} />

      {slots.map((slot) => {
        const day = days.find((entry) => entry.weekday === slot.weekday) ?? {
          weekday: slot.weekday,
          stepTarget: planQ.data?.defaultStepTarget ?? null,
          activities: [],
        };
        return createPortal(
          <InlineWeeklyDayEditor
            key={`${userId}:${slot.weekday}`}
            day={day}
            disabled={planQ.isLoading || Boolean(planQ.error)}
            loading={planQ.isLoading}
            syncState={syncState}
            onChange={(update) => updateDay(slot.weekday, update)}
          />,
          slot.element,
        );
      })}
    </div>
  );
}

function InlineWeeklyDayEditor({
  day,
  disabled,
  loading,
  syncState,
  onChange,
}: {
  day: WeeklyTrainingDayPlan;
  disabled: boolean;
  loading: boolean;
  syncState: SyncState;
  onChange: (update: (day: WeeklyTrainingDayPlan) => WeeklyTrainingDayPlan) => void;
}) {
  const weekday = WEEKDAYS.find((entry) => entry.value === day.weekday);

  return (
    <div className="border-b border-border bg-muted/15 px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                Alltag & Zusatzaktivitäten
              </span>
              <span className="text-[9px] font-semibold text-muted-foreground">
                gilt für jeden {weekday?.long ?? "Tag"} im Plan
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              Schritte, Kurse, Cardio oder Home Workouts direkt diesem Wochentag zuordnen.
            </p>
          </div>

          <div className="flex items-end gap-2">
            <label className="w-32">
              <span className="mb-1 flex items-center justify-end gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                <Footprints className="h-3 w-3" /> Schritte
              </span>
              <input
                type="number"
                min={0}
                max={100000}
                step={500}
                disabled={disabled}
                value={day.stepTarget ?? ""}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    stepTarget: event.target.value ? Number(event.target.value) : null,
                  }))
                }
                placeholder="optional"
                className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-right text-xs font-bold outline-none focus:border-primary disabled:opacity-55"
              />
            </label>
            <div className="pb-2 text-[9px] font-bold text-muted-foreground">
              {loading || syncState === "saving" ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> {loading ? "Lädt" : "Speichert"}
                </span>
              ) : syncState === "error" ? (
                <span className="text-destructive">Nicht gespeichert</span>
              ) : (
                <span className="text-primary">Gespeichert</span>
              )}
            </div>
          </div>
        </div>

        {day.activities.length > 0 && (
          <div className="space-y-2">
            {day.activities.map((activity) => (
              <div key={activity.id} className="rounded-xl border border-border bg-card p-2.5">
                <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_6rem_auto]">
                  <select
                    disabled={disabled}
                    value={activity.type}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        activities: current.activities.map((item) =>
                          item.id === activity.id
                            ? { ...item, type: event.target.value as WeeklyTrainingActivityType }
                            : item,
                        ),
                      }))
                    }
                    className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-bold outline-none focus:border-primary disabled:opacity-55"
                  >
                    {ACTIVITY_OPTIONS.map((option) => (
                      <option key={option.type} value={option.type}>
                        {option.label}
                      </option>
                    ))}
                    <option value="other">Sonstiges</option>
                  </select>
                  <input
                    disabled={disabled}
                    value={activity.title}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        activities: current.activities.map((item) =>
                          item.id === activity.id ? { ...item, title: event.target.value } : item,
                        ),
                      }))
                    }
                    placeholder={activity.type === "class" ? "z. B. Spinning / Reha-Kurs" : "Bezeichnung"}
                    className="min-w-0 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-bold outline-none focus:border-primary disabled:opacity-55"
                  />
                  <input
                    type="time"
                    disabled={disabled}
                    value={activity.time ?? ""}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        activities: current.activities.map((item) =>
                          item.id === activity.id
                            ? { ...item, time: event.target.value || null }
                            : item,
                        ),
                      }))
                    }
                    className="rounded-lg border border-border bg-background px-2 py-2 text-xs outline-none focus:border-primary disabled:opacity-55"
                    aria-label="Uhrzeit optional"
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onChange((current) => ({
                        ...current,
                        activities: current.activities.filter((item) => item.id !== activity.id),
                      }))
                    }
                    className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    aria-label={`${activity.title || "Aktivität"} entfernen`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <input
                  disabled={disabled}
                  value={activity.notes ?? ""}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      activities: current.activities.map((item) =>
                        item.id === activity.id
                          ? { ...item, notes: event.target.value || null }
                          : item,
                      ),
                    }))
                  }
                  placeholder="Optionale Notiz, z. B. 30 Min locker …"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] outline-none focus:border-primary disabled:opacity-55"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  activities: [...current.activities, newActivity(option.type)],
                }))
              }
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground transition hover:border-primary/35 hover:text-primary disabled:opacity-40"
            >
              {option.type === "class" ? (
                <Users className="h-3 w-3" />
              ) : option.type === "home_workout" ? (
                <Home className="h-3 w-3" />
              ) : option.type === "cardio" ? (
                <Activity className="h-3 w-3" />
              ) : (
                <CalendarDays className="h-3 w-3" />
              )}
              <Plus className="h-3 w-3" /> {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
