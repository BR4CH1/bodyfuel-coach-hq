import { Dumbbell } from "lucide-react";
import type { CoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";
import { TrainingPlanManagementCard } from "@/components/bodyfuel/TrainingPlanManagementCard";
import { Section, TinyStat } from "./athlete-tab-shared";

export function AthleteTrainingTab({
  data,
  orgId,
  userId,
}: {
  data: CoachAthleteDetail;
  orgId: string;
  userId: string;
}) {
  const t = data.training;
  return (
    <div className="space-y-4">
      <Section title="Training · letzte 30 Tage" icon={<Dumbbell className="h-4 w-4" />}>
        <div className="grid grid-cols-4 gap-2">
          <TinyStat label="Zugewiesen" value={t.assigned} />
          <TinyStat label="Abgeschl." value={t.done} tone="green" />
          <TinyStat label="Offen" value={t.open} tone="yellow" />
          <TinyStat label="Ausgel." value={t.missed} tone="red" />
        </div>
        <div className="mt-2 rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Abschlussquote
          </div>
          <div className="mt-0.5 font-display text-xl font-bold">
            {t.completion_rate != null ? `${t.completion_rate} %` : "—"}
          </div>
        </div>
      </Section>

      <Section title="Trainingsplan" icon={<Dumbbell className="h-4 w-4" />}>
        <TrainingPlanManagementCard userId={userId} returnOrgId={orgId} />
      </Section>
    </div>
  );
}
