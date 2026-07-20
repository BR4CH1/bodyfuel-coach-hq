import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Footprints, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/tracker/app/activity")({
  head: () => ({ meta: [{ title: "Aktivität — BodyFuel Tracker" }] }),
  component: ActivityPage,
});

const today = () => new Date().toISOString().slice(0, 10);

type Row = { id: string; log_date: string; steps: number | null; training_done: boolean };

function ActivityPage() {
  const { supabaseUser } = useSession();
  const [stepsInput, setStepsInput] = useState("");
  const [todayRow, setTodayRow] = useState<Row | null>(null);
  const [goal, setGoal] = useState(10000);
  const [history, setHistory] = useState<Row[]>([]);

  const load = async () => {
    if (!supabaseUser) return;
    const [{ data: p }, { data: rows }] = await Promise.all([
      supabase.from("profiles").select("daily_step_goal").eq("id", supabaseUser.id).maybeSingle(),
      supabase
        .from("activity_logs")
        .select("id, log_date, steps, training_done")
        .eq("user_id", supabaseUser.id)
        .order("log_date", { ascending: false })
        .limit(14),
    ]);
    if (p?.daily_step_goal) setGoal(p.daily_step_goal);
    const list = (rows ?? []) as Row[];
    setHistory(list);
    const t = list.find((r) => r.log_date === today()) ?? null;
    setTodayRow(t);
    setStepsInput(t?.steps != null ? String(t.steps) : "");
  };

  useEffect(() => { load(); }, [supabaseUser]);

  const upsert = async (patch: { steps?: number | null; training_done?: boolean }) => {
    if (!supabaseUser) return;
    const payload = {
      user_id: supabaseUser.id,
      log_date: today(),
      steps: patch.steps !== undefined ? patch.steps : todayRow?.steps ?? null,
      training_done: patch.training_done !== undefined ? patch.training_done : todayRow?.training_done ?? false,
    };
    const { error } = await supabase
      .from("activity_logs")
      .upsert(payload, { onConflict: "user_id,log_date" });
    if (error) return toast.error(error.message);
    load();
  };

  const saveSteps = async () => {
    const v = parseInt(stepsInput.replace(/\D/g, ""), 10);
    if (!Number.isFinite(v) || v < 0 || v > 200000) return toast.error("Bitte gültige Schrittzahl eingeben");
    await upsert({ steps: v });
    toast.success("Schritte gespeichert");
  };

  const toggleTraining = async () => {
    await upsert({ training_done: !(todayRow?.training_done ?? false) });
  };

  const todaySteps = todayRow?.steps ?? 0;
  const pct = Math.min(100, Math.round((todaySteps / Math.max(1, goal)) * 100));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Tracker</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Aktivität</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <Footprints className="h-10 w-10 text-primary" />
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Schritte heute</p>
            <p className="font-display text-4xl font-bold">{todaySteps.toLocaleString("de-DE")} <span className="text-lg text-muted-foreground">/ {goal.toLocaleString("de-DE")}</span></p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-gradient-gold transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-4 flex gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="z.B. 8200"
            value={stepsInput}
            onChange={(e) => setStepsInput(e.target.value)}
          />
          <Button onClick={saveSteps}>Speichern</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Activity className="h-10 w-10 text-primary" />
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Training heute</p>
              <p className="font-display text-xl font-bold">{todayRow?.training_done ? "Erledigt ✓" : "Noch offen"}</p>
            </div>
          </div>
          <Button onClick={toggleTraining} variant={todayRow?.training_done ? "secondary" : "default"}>
            <Check className="mr-2 h-4 w-4" />
            {todayRow?.training_done ? "Rückgängig" : "Als erledigt markieren"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-3 font-display text-lg font-bold">Letzte 14 Tage</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">{new Date(r.log_date).toLocaleDateString("de-DE")}</span>
                <span className="flex items-center gap-3">
                  <span>{(r.steps ?? 0).toLocaleString("de-DE")} Schritte</span>
                  {r.training_done && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">Training</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
