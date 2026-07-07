import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Activity, BarChart3, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsHero } from "@/components/bodyfuel/BullsHero";
import { PlanContentView } from "@/components/bodyfuel/PlanContentView";
import { TrainingTracker } from "@/components/bodyfuel/TrainingTracker";
import { StrengthCheckStatus } from "@/components/bodyfuel/StrengthCheckStatus";
import { StrengthSummaryCard } from "@/components/bodyfuel/StrengthSummaryCard";
import { AthleteProfileBanner } from "@/components/bodyfuel/AthleteProfileBanner";
import { useSession } from "@/lib/bodyfuel/session";
import { useTrial } from "@/hooks/use-trial";
import { TrialTrainingPlan } from "@/components/bodyfuel/TrialPlanView";
import { getMyStrengthStatus } from "@/lib/strength-check.functions";
import { trackHubEvent } from "@/lib/bulls.functions";

export const Route = createFileRoute("/bulls/training")({
  head: () => ({ meta: [{ title: "Training — Bulls Hub" }] }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <TrainingPage />
      </BullsGate>
    </AppLayout>
  ),
});

function TrainingPage() {
  const track = useServerFn(trackHubEvent);
  useEffect(() => {
    track({ data: { kind: "training_plan_opened" } }).catch(() => {});
  }, [track]);

  const { supabaseUser } = useSession();
  const { isTrial, isExpired } = useTrial();

  const statusFn = useServerFn(getMyStrengthStatus);
  const { data: strengthStatus } = useQuery({
    queryKey: ["my-strength-status"],
    queryFn: () => statusFn(),
    enabled: !!supabaseUser,
  });
  const last = strengthStatus?.last;
  const hasCompleted = !!last && !!last.score_total;

  return (
    <div className="space-y-6">
      <Link
        to="/bulls"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red"
      >
        <ArrowLeft className="h-3 w-3" /> Zurück zum Hub
      </Link>

      <BullsHero
        eyebrow="Training"
        title="Deine Trainingswoche"
        subtitle="Vollständiger Trainingsplan, Sätze tracken, Progression — im Bulls-Look."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <QuickLink to="/strength-check" icon={<Activity className="h-5 w-5" />} title="Strength Check" desc="Scores & Historie" />
        <QuickLink to="/progress" icon={<BarChart3 className="h-5 w-5" />} title="Trainingsanalyse" desc="Verbesserungen & Trends" />
        <QuickLink to="/achievements" icon={<Sparkles className="h-5 w-5" />} title="Erfolge" desc="Adhärenz & Volumen" />
      </section>

      <StrengthCheckStatus variant="block" />
      {supabaseUser && <AthleteProfileBanner />}

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

      {isTrial || isExpired ? (
        <TrialTrainingPlan />
      ) : (
        supabaseUser && <PlanContentView clientId={supabaseUser.id} planType="training" />
      )}

      {supabaseUser && !isExpired && (
        <section className="space-y-4">
          <TrainingTracker clientId={supabaseUser.id} />
        </section>
      )}
    </div>
  );
}

function QuickLink({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-bulls-red/60"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-bulls-red/15 text-bulls-red">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
    </Link>
  );
}
