import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { PlansView } from "@/components/bodyfuel/PlansView";
import { TrainingTracker } from "@/components/bodyfuel/TrainingTracker";
import { PlanContentView } from "@/components/bodyfuel/PlanContentView";
import { useSession } from "@/lib/bodyfuel/session";
import { StrengthCheckStatus } from "@/components/bodyfuel/StrengthCheckStatus";
import { StrengthSummaryCard } from "@/components/bodyfuel/StrengthSummaryCard";
import { getMyStrengthStatus } from "@/lib/strength-check.functions";

import { useTrial } from "@/hooks/use-trial";
import { TrialTrainingPlan } from "@/components/bodyfuel/TrialPlanView";
import { ensureTrialTrainingPlan } from "@/lib/trial.functions";

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
  const ensureFn = useServerFn(ensureTrialTrainingPlan);
  const [clientId, setClientId] = useState<string>("");
  const [trackerKey, setTrackerKey] = useState(0);
  const seededRef = useRef(false);

  // Trial-Nutzer: Starter-Trainingsplan idempotent anlegen, damit der Tracker
  // sofort Übungen anzeigt und Sätze geloggt werden können.
  useEffect(() => {
    if (!supabaseUser || isCoach || !isTrial || seededRef.current) return;
    seededRef.current = true;
    (async () => {
      try {
        await ensureFn();
        setTrackerKey((k) => k + 1);
      } catch (e) {
        console.error("ensureTrialTrainingPlan failed", e);
      }
    })();
  }, [supabaseUser, isCoach, isTrial, ensureFn]);

  useEffect(() => {
    if (!supabaseUser || isCoach) return;
    setClientId(supabaseUser.id);
  }, [isCoach, supabaseUser]);

  const effectiveId = clientId || (!isCoach ? supabaseUser?.id ?? "" : "");

  return (
    <div className="space-y-8">
      {!isCoach && <StrengthCheckStatus variant="block" />}
      {isCoach && <PlansView planType="training" onClientChange={setClientId} />}
      {!isCoach && (isTrial || isExpired) ? (
        <TrialTrainingPlan />
      ) : (
        supabaseUser && effectiveId && (
          <PlanContentView clientId={effectiveId} planType="training" />
        )
      )}
      {supabaseUser && !isExpired && effectiveId && (
        <section className="space-y-4">
          <TrainingTracker key={trackerKey} clientId={effectiveId} />
        </section>
      )}
    </div>
  );
}
