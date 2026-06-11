import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Trophy } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { MAX_DAILY_POINTS, TASKS, todayKey, type CheckTaskKey } from "@/lib/bodyfuel/data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/check-in")({
  head: () => ({ meta: [{ title: "Tagescheck — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <CheckInContent />
    </AppLayout>
  ),
});

function CheckInContent() {
  const { user, updateTodayCheck } = useSession();
  const today = user?.checks.find((c) => c.date === todayKey());
  const [state, setState] = useState<Record<CheckTaskKey, boolean>>(
    today?.tasks ?? {
      protein: false,
      water: false,
      fruitsVeg: false,
      steps: false,
      training: false,
      sleep: false,
      recovery: false,
    },
  );

  const points = useMemo(
    () => TASKS.reduce((s, t) => s + (state[t.key] ? t.points : 0), 0),
    [state],
  );
  const pct = (points / MAX_DAILY_POINTS) * 100;

  const save = () => {
    updateTodayCheck(state);
    toast.success(`Check-in gespeichert: ${points} Punkte 🔥`);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tagescheck</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Heute, {fmt(todayKey())}</h1>
      </div>

      {/* Score card */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold">
              <Trophy className="h-3.5 w-3.5" /> Heutige Punkte
            </div>
            <div className="mt-1 font-display text-5xl font-bold">
              <span className="text-gradient-gold">{points}</span>
              <span className="ml-2 text-2xl text-muted-foreground">/ {MAX_DAILY_POINTS}</span>
            </div>
          </div>
          <div className="w-full sm:w-72">
            <div className="h-3 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-gold transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 text-right text-xs text-muted-foreground">
              {pct === 100 ? "Perfect Day! 🔥" : `${Math.round(pct)}% deines Tageszieles`}
            </div>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="grid gap-3 sm:grid-cols-2">
        {TASKS.map((task) => {
          const active = state[task.key];
          return (
            <button
              key={task.key}
              onClick={() => setState((s) => ({ ...s, [task.key]: !s[task.key] }))}
              className={`group flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-gold/50 bg-accent/40 shadow-gold"
                  : "border-border bg-card hover:border-gold/30 hover:bg-secondary"
              }`}
            >
              <div className="text-3xl">{task.emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{task.label}</div>
                <div className="text-xs uppercase tracking-wider text-gold">
                  +{task.points} Punkte
                </div>
              </div>
              <div
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 transition ${
                  active
                    ? "border-gold bg-gradient-gold text-primary-foreground"
                    : "border-border bg-background"
                }`}
              >
                {active && <Check className="h-4 w-4" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-20 lg:static">
        <Button
          onClick={save}
          className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
          size="lg"
        >
          Tagescheck speichern
        </Button>
      </div>
    </div>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}
