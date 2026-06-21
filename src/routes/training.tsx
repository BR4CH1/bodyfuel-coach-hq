import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, ChevronRight, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { PlansView } from "@/components/bodyfuel/PlansView";
import { TrainingTracker } from "@/components/bodyfuel/TrainingTracker";
import { PlanContentView } from "@/components/bodyfuel/PlanContentView";
import { useSession } from "@/lib/bodyfuel/session";
import { StrengthCheckStatus } from "@/components/bodyfuel/StrengthCheckStatus";
import { StrengthSummaryCard } from "@/components/bodyfuel/StrengthSummaryCard";
import { getMyStrengthStatus } from "@/lib/strength-check.functions";
import { AthleteProfileBanner } from "@/components/bodyfuel/AthleteProfileBanner";
import { useScrollRestore } from "@/hooks/use-scroll-restore";

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
  const statusFn = useServerFn(getMyStrengthStatus);
  const [clientId, setClientId] = useState<string>("");
  const [trackerKey, setTrackerKey] = useState(0);
  const seededRef = useRef(false);

  // Scroll-Position über Tab-/Routenwechsel hinweg merken.
  useScrollRestore(
    `training:${supabaseUser?.id ?? "anon"}`,
    !!supabaseUser,
  );

  const { data: strengthStatus } = useQuery({
    queryKey: ["my-strength-status"],
    queryFn: () => statusFn(),
    enabled: !!supabaseUser && !isCoach,
  });

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

  const last = strengthStatus?.last;
  const hasCompleted = !!last && !!last.score_total;

  return (
    <div className="space-y-8">
      {!isCoach && (
        <section className="grid gap-3 sm:grid-cols-3">
          <TrainingQuickLink to="/strength-check" icon={<Activity className="h-5 w-5" />} title="Strength Check" desc="Scores, Historie, Trends" />
          <TrainingQuickLink to="/progress" icon={<BarChart3 className="h-5 w-5" />} title="Trainingsanalyse" desc="Verbesserungen & Rückgänge" />
          <TrainingQuickLink to="/achievements" icon={<Sparkles className="h-5 w-5" />} title="Insights & Erfolge" desc="Adhärenz, Volumen, Belastung" />
        </section>
      )}
      {!isCoach && <StrengthCheckStatus variant="block" />}
      {!isCoach && supabaseUser && <AthleteProfileBanner />}
      {hasCompleted && (
        <StrengthSummaryCard
          total={last.score_total}
          performedAt={last.performed_at}
          bodyweightKg={last.bodyweight_kg}
          groups={[
            { key: "score_lower", label: "Unterkörper", val: last.score_lower },
            { key: "score_push", label: "Push", val: last.score_push },
            { key: "score_pull", label: "Pull", val: last.score_pull },
            { key: "score_core", label: "Core", val: last.score_core },
          ]}
        />
      )}
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

function TrainingQuickLink({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-gold/50"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/15 text-gold">{icon}</div>
        <div>
          <div className="text-sm font-bold">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}
