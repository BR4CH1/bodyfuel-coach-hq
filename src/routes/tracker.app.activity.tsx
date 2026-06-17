import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/tracker/app/activity")({
  head: () => ({ meta: [{ title: "Aktivität — BodyFuel Tracker" }] }),
  component: ActivityPage,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ActivityPage() {
  const { supabaseUser } = useSession();
  const [steps, setSteps] = useState("");
  const [training, setTraining] = useState(false);

  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("steps, training_done")
        .eq("user_id", supabaseUser.id)
        .eq("log_date", today())
        .maybeSingle();
      if (data) {
        if (data.steps != null) setSteps(String(data.steps));
        setTraining(!!data.training_done);
      }
    })();
  }, [supabaseUser]);

  const save = async (next: { steps?: number | null; training_done?: boolean }) => {
    if (!supabaseUser) return;
    const payload: any = {
      user_id: supabaseUser.id,
      log_date: today(),
      steps: next.steps !== undefined ? next.steps : steps ? parseInt(steps, 10) : null,
      training_done: next.training_done !== undefined ? next.training_done : training,
    };
    const { error } = await supabase.from("activity_logs").upsert(payload, { onConflict: "user_id,log_date" });
    if (error) toast.error(error.message);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Heute</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Aktivität</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <h2 className="font-display text-lg font-bold">Schritte</h2>
        </div>
        <div className="mt-4 flex gap-2">
          <Input
            type="number" placeholder="z.B. 8500"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          />
          <Button
            onClick={() => save({ steps: steps ? parseInt(steps, 10) : null })}
            className="bg-gradient-gold text-primary-foreground"
          >
            Speichern
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Dumbbell className="h-6 w-6 text-primary" />
          <h2 className="font-display text-lg font-bold">Training heute</h2>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => { setTraining(true); save({ training_done: true }); }}
            className={
              "flex-1 rounded-full border px-4 py-3 text-sm font-semibold " +
              (training ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")
            }
          >
            Ja, absolviert
          </button>
          <button
            onClick={() => { setTraining(false); save({ training_done: false }); }}
            className={
              "flex-1 rounded-full border px-4 py-3 text-sm font-semibold " +
              (!training ? "border-border bg-secondary text-foreground" : "border-border text-muted-foreground")
            }
          >
            Noch nicht
          </button>
        </div>
      </div>
    </div>
  );
}
