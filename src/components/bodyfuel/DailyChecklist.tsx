import { useEffect, useState } from "react";
import { Check, Flame, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TASKS, MAX_DAILY_POINTS, type CheckTaskKey } from "@/lib/bodyfuel/data";

type TaskState = Partial<Record<CheckTaskKey, boolean>>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function calcPoints(state: TaskState): number {
  return TASKS.reduce((s, t) => s + (state[t.key] ? t.points : 0), 0);
}

export function DailyChecklist({ userId }: { userId: string }) {
  const date = today();
  const [tasks, setTasks] = useState<TaskState>({});
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("daily_checks")
        .select("id, tasks")
        .eq("user_id", userId)
        .eq("check_date", date)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setRowId(data.id);
        setTasks((data.tasks as TaskState) ?? {});
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, date]);

  const toggle = async (key: CheckTaskKey) => {
    const next = { ...tasks, [key]: !tasks[key] };
    setTasks(next);
    setSaving(true);
    const points = calcPoints(next);
    const payload = {
      user_id: userId,
      check_date: date,
      tasks: next,
      points,
    };
    const { data, error } = await supabase
      .from("daily_checks")
      .upsert(payload, { onConflict: "user_id,check_date" })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Konnte nicht speichern");
      setTasks(tasks);
      return;
    }
    if (data && !rowId) setRowId(data.id);
  };

  const points = calcPoints(tasks);
  const pct = Math.round((points / MAX_DAILY_POINTS) * 100);
  const done = TASKS.filter((t) => tasks[t.key]).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-gold">
          <Flame className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Tagesziele heute</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {saving ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> speichern…
            </span>
          ) : (
            `${done} / ${TASKS.length} erledigt`
          )}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="font-display text-3xl font-bold">
            {points}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              / {MAX_DAILY_POINTS} Pkt
            </span>
          </div>
        </div>
        <div className="text-xs text-gold">{pct}%</div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-gold transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-5 space-y-2">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className="h-12 animate-pulse rounded-xl border border-border bg-background/40"
              />
            ))
          : TASKS.map((t) => {
              const active = !!tasks[t.key];
              return (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => toggle(t.key)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-gold/60 bg-gold/10"
                        : "border-border bg-background/40 hover:border-gold/40"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base ${
                          active ? "bg-gradient-gold" : "bg-secondary"
                        }`}
                      >
                        {active ? (
                          <Check className="h-4 w-4 text-primary-foreground" />
                        ) : (
                          <span>{t.emoji}</span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{t.label}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          +{t.points} Punkte
                        </div>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        active ? "text-gold" : "text-muted-foreground"
                      }`}
                    >
                      {active ? "Erledigt" : "Offen"}
                    </span>
                  </button>
                </li>
              );
            })}
      </ul>
    </div>
  );
}
