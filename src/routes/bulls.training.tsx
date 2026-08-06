import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Activity, BarChart3, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsHero } from "@/components/bodyfuel/BullsHero";
import { PlanContentView } from "@/components/bodyfuel/PlanContentView";
import { TrainingTracker } from "@/components/bodyfuel/TrainingTracker";
import { AthleteProfileBanner } from "@/components/bodyfuel/AthleteProfileBanner";
import { LivePlanBanner } from "@/components/bodyfuel/LivePlanBanner";
import { BullsAthleteAthleticSession } from "@/components/bodyfuel/BullsAthleteAthleticSession";
import { useSession } from "@/lib/bodyfuel/session";
import { useEntitlement } from "@/hooks/use-entitlement";
import { SmartLockCard } from "@/components/bodyfuel/SmartGate";
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
  const { hasSmart } = useEntitlement();

  return (
    <div className="space-y-6">
      <Link
        to="/dashboard"
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
        <QuickLink to="/bulls/performance" icon={<Activity className="h-5 w-5" />} title="Performance Check" desc="Speed · Agility · Power · Strength" />
        <QuickLink to="/progress" icon={<BarChart3 className="h-5 w-5" />} title="Trainingsanalyse" desc="Verbesserungen & Trends" />
        <QuickLink to="/achievements" icon={<Sparkles className="h-5 w-5" />} title="Erfolge" desc="Adhärenz & Volumen" />
      </section>

      {supabaseUser && <AthleteProfileBanner />}
      {supabaseUser && hasSmart && <LivePlanBanner userId={supabaseUser.id} />}

      {supabaseUser && <BullsAthleteAthleticSession />}

      {supabaseUser && (
        <section className="space-y-4">
          <TrainingTracker clientId={supabaseUser.id} />
        </section>
      )}

      {!hasSmart ? (
        <SmartLockCard title="KI-Trainingsplan" />
      ) : (
        supabaseUser && (
          <details className="rounded-2xl border border-border bg-card">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold">
              Vollständigen Trainingsplan anzeigen
            </summary>
            <div className="border-t border-border p-4">
              <PlanContentView clientId={supabaseUser.id} planType="training" />
            </div>
          </details>
        )
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
