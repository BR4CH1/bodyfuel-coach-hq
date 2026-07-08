import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, Dumbbell, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  getMyAthleticSessions,
  toggleAthleticExerciseDone,
  completeAthleticSession,
} from "@/lib/organizations/athlete-training-session.functions";
import { FOCUS_LABEL, type TrainingFocus } from "@/lib/training-focus-detection";

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}
function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}
function formatDay(iso: string) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

type SessionRow = {
  id: string;
  session_date: string;
  focus: TrainingFocus;
  title: string;
  position_code: string | null;
  duration_min: number | null;
  exercises: Array<{ id: string; name: string; sets: number | null; reps: string | null; duration_sec: number | null; notes?: string | null }>;
  status: "scheduled" | "in_progress" | "completed" | "skipped";
  progress: Record<string, { done: boolean }>;
};

export function BullsAthleteAthleticSession() {
  const today = isoDate(new Date());
  const from = addDaysIso(today, -3);
  const to = addDaysIso(today, 10);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const fetchSessions = useServerFn(getMyAthleticSessions);
  const toggle = useServerFn(toggleAthleticExerciseDone);
  const complete = useServerFn(completeAthleticSession);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["my-athletic-sessions", from, to],
    queryFn: () => fetchSessions({ data: { from, to } }),
  });
  const sessions = (q.data ?? []) as SessionRow[];

  const dayChips = useMemo(() => {
    const arr: string[] = [];
    for (let i = -2; i <= 6; i++) arr.push(addDaysIso(today, i));
    return arr;
  }, [today]);

  const sessionsForDay = sessions.filter((s) => s.session_date === selectedDate);

  const toggleMut = useMutation({
    mutationFn: async (args: { session_id: string; exercise_id: string; done: boolean }) =>
      toggle({ data: args }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-athletic-sessions", from, to] }),
  });
  const completeMut = useMutation({
    mutationFn: async (id: string) => complete({ data: { session_id: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-athletic-sessions", from, to] });
      toast.success("Session abgeschlossen. Stark gemacht.");
    },
  });

  if (!q.isLoading && sessions.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[#252525] bg-[#0f0f0f] p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-bulls-red">
            <Dumbbell className="h-3.5 w-3.5" />
            Athletik
          </div>
          <h3 className="font-display text-xl font-bold text-white">Deine Athletik-Session</h3>
        </div>
      </div>

      {/* Day Chips */}
      <div className="mb-3 flex gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSelectedDate((d) => addDaysIso(d, -1))}
          className="rounded-md border border-[#252525] bg-[#111] p-1.5 text-neutral-400"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {dayChips.map((d) => {
          const has = sessions.some((s) => s.session_date === d);
          const isToday = d === today;
          const selected = d === selectedDate;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDate(d)}
              className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                selected
                  ? "border-bulls-red bg-bulls-red/15 text-white"
                  : has
                  ? "border-[#252525] bg-[#0a0a0a] text-neutral-200"
                  : "border-[#1a1a1a] bg-[#0a0a0a] text-neutral-600"
              }`}
            >
              {isToday ? "Heute" : formatDay(d)}
              {has && !selected && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-bulls-red align-middle" />}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setSelectedDate((d) => addDaysIso(d, 1))}
          className="rounded-md border border-[#252525] bg-[#111] p-1.5 text-neutral-400"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {sessionsForDay.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#252525] bg-[#0a0a0a] p-4 text-center text-xs text-neutral-500">
          Für diesen Tag ist keine Athletik-Session geplant.
        </div>
      ) : (
        sessionsForDay.map((s) => {
          const exDone = s.exercises.filter((e) => s.progress?.[e.id]?.done).length;
          const total = s.exercises.length;
          const pct = total ? Math.round((exDone / total) * 100) : 0;
          const isDone = s.status === "completed";
          return (
            <div key={s.id} className="mb-3 rounded-xl border border-[#252525] bg-[#0a0a0a] p-3 last:mb-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-bulls-red">
                    {FOCUS_LABEL[s.focus]} · {s.duration_min ?? "-"} Min
                    {s.position_code ? ` · ${s.position_code}` : ""}
                  </div>
                  <div className="font-semibold text-white">{s.title}</div>
                </div>
                <div className="text-right text-[10px] uppercase tracking-wider text-neutral-500">
                  {exDone}/{total}
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                <div
                  className="h-full bg-bulls-red transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <ul className="mt-3 space-y-1.5">
                {s.exercises.map((ex) => {
                  const done = !!s.progress?.[ex.id]?.done;
                  return (
                    <li
                      key={ex.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-[#1a1a1a] bg-[#0f0f0f] px-2 py-1.5"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          toggleMut.mutate({ session_id: s.id, exercise_id: ex.id, done: !done })
                        }
                        disabled={isDone}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-neutral-500" />
                        )}
                        <span className={`truncate text-sm ${done ? "text-neutral-500 line-through" : "text-white"}`}>
                          {ex.name}
                        </span>
                      </button>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-neutral-500">
                        {ex.sets}×{ex.reps ?? (ex.duration_sec ? `${ex.duration_sec}s` : "-")}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {!isDone && (
                <button
                  type="button"
                  onClick={() => completeMut.mutate(s.id)}
                  disabled={completeMut.isPending}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-bulls-red px-3 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
                >
                  {completeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Session abschließen
                </button>
              )}
              {isDone && (
                <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  ✓ Abgeschlossen
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
