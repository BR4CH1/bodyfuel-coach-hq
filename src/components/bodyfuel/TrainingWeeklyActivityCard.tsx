import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, ChevronDown, Footprints, Home, Users } from "lucide-react";
import {
  getAthleteWeeklyTrainingPlan,
  WEEKLY_TRAINING_ACTIVITY_LABELS,
  type WeeklyTrainingActivity,
} from "@/lib/training-weekly-activity.functions";

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const numberFormat = new Intl.NumberFormat("de-DE");

function ActivityIcon({ activity }: { activity: WeeklyTrainingActivity }) {
  if (activity.type === "class") return <Users className="h-3.5 w-3.5" />;
  if (activity.type === "home_workout") return <Home className="h-3.5 w-3.5" />;
  return <Activity className="h-3.5 w-3.5" />;
}

export function TrainingWeeklyActivityCard({ userId }: { userId: string }) {
  const fetchPlan = useServerFn(getAthleteWeeklyTrainingPlan);
  const [expanded, setExpanded] = useState(false);
  const planQ = useQuery({
    queryKey: ["weekly-training-activity-plan", userId],
    queryFn: () => fetchPlan({ data: { userId } }),
  });

  const todayWeekday = new Date().getDay();
  const today = planQ.data?.days.find((day) => day.weekday === todayWeekday) ?? null;
  const hasAnyPlan = useMemo(
    () =>
      Boolean(
        planQ.data?.days.some(
          (day) => (day.stepTarget != null && day.stepTarget > 0) || day.activities.length > 0,
        ),
      ),
    [planQ.data],
  );

  if (planQ.isLoading || planQ.error || !hasAnyPlan || !today) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-card">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Heute · {WEEKDAYS[todayWeekday]}
            </p>
            <h2 className="mt-1 text-lg font-black">Deine Tagesziele</h2>
          </div>
          {today.stepTarget != null && today.stepTarget > 0 && (
            <div className="flex shrink-0 items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-primary">
              <Footprints className="h-4 w-4" />
              <span className="text-sm font-black">{numberFormat.format(today.stepTarget)}</span>
            </div>
          )}
        </div>

        {today.activities.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {today.activities.map((activity) => (
              <div key={activity.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <ActivityIcon activity={activity} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                      {WEEKLY_TRAINING_ACTIVITY_LABELS[activity.type]}
                      {activity.time ? ` · ${activity.time}` : ""}
                    </div>
                    <div className="truncate text-sm font-black">{activity.title}</div>
                    {activity.notes && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{activity.notes}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Heute ist keine zusätzliche Aktivität geplant.
          </p>
        )}

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground transition hover:text-primary"
        >
          Ganze Woche anzeigen
          <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/15 p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {WEEKDAY_ORDER.map((weekday) => {
              const day = planQ.data!.days.find((entry) => entry.weekday === weekday)!;
              return (
                <div key={weekday} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black">{WEEKDAYS[weekday]}</span>
                    {day.stepTarget != null && day.stepTarget > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                        <Footprints className="h-3 w-3" /> {numberFormat.format(day.stepTarget)}
                      </span>
                    )}
                  </div>
                  {day.activities.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {day.activities.map((activity) => (
                        <div key={activity.id} className="text-[10px] text-muted-foreground">
                          <span className="font-bold text-foreground">{activity.title}</span>
                          {activity.time ? ` · ${activity.time}` : ""}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-[10px] text-muted-foreground">Keine Zusatzaktivität</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
