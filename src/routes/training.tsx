import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { PlansView } from "@/components/bodyfuel/PlansView";
import { TrainingTracker } from "@/components/bodyfuel/TrainingTracker";
import { PlanContentView } from "@/components/bodyfuel/PlanContentView";
import { useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";
import { useTrial } from "@/hooks/use-trial";
import { TrialTrainingPlan } from "@/components/bodyfuel/TrialPlanView";

export const Route = createFileRoute("/training")({
  head: () => ({ meta: [{ title: "Trainingsplan — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <TrainingPage />
    </AppLayout>
  ),
});

function TrainingPage() {
  const { isCoach, supabaseUser } = useSession();
  const { isTrial, isExpired } = useTrial();
  const [clientId, setClientId] = useState<string>("");
  const [clients, setClients] = useState<{ id: string; display_name: string | null }[]>([]);

  useEffect(() => {
    if (!supabaseUser) return;
    if (!isCoach) {
      setClientId(supabaseUser.id);
      return;
    }
    supabase
      .from("profiles")
      .select("id, display_name")
      .order("display_name")
      .then(({ data }) => {
        const opts = (data as { id: string; display_name: string | null }[]) ?? [];
        setClients(opts);
        if (opts.length && !clientId) setClientId(opts[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCoach, supabaseUser]);

  return (
    <div className="space-y-8">
      {isCoach && <PlansView planType="training" />}
      {supabaseUser && (clientId || !isCoach) && (
        <PlanContentView clientId={clientId || supabaseUser.id} planType="training" />
      )}
      {supabaseUser && (
        <section className="space-y-4">
          {isCoach && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Tracker für Kunde
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {clients.length === 0 && <option>Keine Kunden</option>}
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name ?? c.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {clientId && <TrainingTracker clientId={clientId} />}
        </section>
      )}
    </div>
  );
}
