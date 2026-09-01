import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CalendarDays, Footprints, Home, Plus, Save, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
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
  { type: "other", label: "Sonstiges" },
];

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

export function TrainingWeeklyActivityEditor({ userId }: { userId: string }) {
  const fetchPlan = useServerFn(getAthleteWeeklyTrainingPlan);
  const savePlan = useServerFn(saveAthleteWeeklyTrainingPlan);
  const queryClient = useQueryClient();
  const queryKey = ["weekly-training-activity-plan", userId] as const;
  const planQ = useQuery({
    queryKey,
    queryFn: () => fetchPlan({ data: { userId } }),
  });
  const [days, setDays] = useState<WeeklyTrainingDayPlan[]>([]);
  const [applyAllSteps, setApplyAllSteps] = useState("");

  useEffect(() => {
    if (planQ.data) setDays(cloneDays(planQ.data.days));
  }, [planQ.data]);

  const orderedDays = useMemo(
    () =>
      WEEKDAYS.map((weekday) => ({
        weekday,
        day: days.find((day) => day.weekday === weekday.value) ?? {
          weekday: weekday.value,
          stepTarget: null,
          activities: [],
        },
      })),
    [days],
  );

  const updateDay = (weekday: number, update: (day: WeeklyTrainingDayPlan) => WeeklyTrainingDayPlan) => {
    setDays((current) => {
      const exists = current.some((day) => day.weekday === weekday);
      if (!exists) {
        return [...current, update({ weekday, stepTarget: null, activities: [] })];
      }
      return current.map((day) => (day.weekday === weekday ? update(day) : day));
    });
  };

  const saveM = useMutation({
    mutationFn: () => savePlan({ data: { userId, days } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Wochenaktivitäten & Schrittziele gespeichert");
    },
    onError: (error) => toast.error(error.message || "Speichern fehlgeschlagen"),
  });

  const applyStepsToAllDays = () => {
    const n = Number(applyAllSteps.replace(/\D/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      toast.error("Bitte ein gültiges Schrittziel eingeben.");
      return;
    }
    setDays((current) =>
      Array.from({ length: 7 }, (_, weekday) => {
        const existing = current.find((day) => day.weekday === weekday);
        return {
          weekday,
          stepTarget: Math.round(n),
          activities: existing?.activities.map((activity) => ({ ...activity })) ?? [],
        };
      }),
    );
    toast.success(`${Math.round(n).toLocaleString("de-DE")} Schritte für alle Tage gesetzt`);
  };

  if (planQ.isLoading) {
    return (
      <section className="rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Wochenziele werden geladen …
      </section>
    );
  }

  if (planQ.error) {
    return (
      <section className="rounded-3xl border border-destructive/30 bg-card p-5 text-sm text-destructive">
        Wochenziele konnten nicht geladen werden: {planQ.error.message}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.45)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            Wochenaktivitäten
          </p>
          <h2 className="mt-1 font-sans text-xl font-black tracking-tight sm:text-2xl">
            Kurse, Home Workouts & Schrittziele
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Ergänzt den normalen Kraftplan. Mehrere Aktivitäten am selben Tag sind möglich – z. B.
            Gym + Spinning. Schrittziele gelten unabhängig davon auch an Ruhetagen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => saveM.mutate()}
          disabled={saveM.isPending || days.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground transition hover:brightness-95 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saveM.isPending ? "Speichert …" : "Wochenziele speichern"}
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-border bg-background p-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Gleiches Schrittziel für alle Tage
          </span>
          <div className="relative">
            <Footprints className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <input
              inputMode="numeric"
              value={applyAllSteps}
              onChange={(event) => setApplyAllSteps(event.target.value)}
              placeholder={
                planQ.data?.defaultStepTarget
                  ? String(planQ.data.defaultStepTarget)
                  : "z. B. 10000"
              }
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-3 text-sm font-bold outline-none focus:border-primary"
            />
          </div>
        </label>
        <button
          type="button"
          onClick={applyStepsToAllDays}
          className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-xs font-black text-primary transition hover:bg-primary/15"
        >
          Auf alle Tage anwenden
        </button>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {orderedDays.map(({ weekday, day }) => (
          <article key={weekday.value} className="rounded-2xl border border-border bg-background p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-[11px] font-black text-primary">
                  {weekday.short}
                </span>
                <div>
                  <div className="text-sm font-black">{weekday.long}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {day.activities.length} Zusatzaktivität{day.activities.length === 1 ? "" : "en"}
                  </div>
                </div>
              </div>
              <label className="w-36">
                <span className="mb-1 flex items-center justify-end gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Footprints className="h-3 w-3" /> Schritte
                </span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  step={500}
                  value={day.stepTarget ?? ""}
                  onChange={(event) =>
                    updateDay(weekday.value, (current) => ({
                      ...current,
                      stepTarget: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                  placeholder="optional"
                  className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-right text-xs font-bold outline-none focus:border-primary"
                />
              </label>
            </div>

            {day.activities.length > 0 && (
              <div className="mt-3 space-y-2">
                {day.activities.map((activity) => (
                  <div key={activity.id} className="rounded-xl border border-border bg-card p-2.5">
                    <div className="grid gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)_6.5rem_auto]">
                      <select
                        value={activity.type}
                        onChange={(event) =>
                          updateDay(weekday.value, (current) => ({
                            ...current,
                            activities: current.activities.map((item) =>
                              item.id === activity.id
                                ? { ...item, type: event.target.value as WeeklyTrainingActivityType }
                                : item,
                            ),
                          }))
                        }
                        className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-bold outline-none focus:border-primary"
                      >
                        {ACTIVITY_OPTIONS.map((option) => (
                          <option key={option.type} value={option.type}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={activity.title}
                        onChange={(event) =>
                          updateDay(weekday.value, (current) => ({
                            ...current,
                            activities: current.activities.map((item) =>
                              item.id === activity.id ? { ...item, title: event.target.value } : item,
                            ),
                          }))
                        }
                        placeholder={activity.type === "class" ? "z. B. Zumba / Reha-Kurs" : "Bezeichnung"}
                        className="min-w-0 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-bold outline-none focus:border-primary"
                      />
                      <input
                        type="time"
                        value={activity.time ?? ""}
                        onChange={(event) =>
                          updateDay(weekday.value, (current) => ({
                            ...current,
                            activities: current.activities.map((item) =>
                              item.id === activity.id
                                ? { ...item, time: event.target.value || null }
                                : item,
                            ),
                          }))
                        }
                        className="rounded-lg border border-border bg-background px-2 py-2 text-xs outline-none focus:border-primary"
                        aria-label="Uhrzeit optional"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateDay(weekday.value, (current) => ({
                            ...current,
                            activities: current.activities.filter((item) => item.id !== activity.id),
                          }))
                        }
                        className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`${activity.title || "Aktivität"} entfernen`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      value={activity.notes ?? ""}
                      onChange={(event) =>
                        updateDay(weekday.value, (current) => ({
                          ...current,
                          activities: current.activities.map((item) =>
                            item.id === activity.id
                              ? { ...item, notes: event.target.value || null }
                              : item,
                          ),
                        }))
                      }
                      placeholder="Optionale Notiz, z. B. 30 Min locker / Kursraum 2 …"
                      className="mt-2 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {ACTIVITY_OPTIONS.slice(0, 4).map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() =>
                    updateDay(weekday.value, (current) => ({
                      ...current,
                      activities: [...current.activities, newActivity(option.type)],
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground transition hover:border-primary/35 hover:text-primary"
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
          </article>
        ))}
      </div>
    </section>
  );
}
