import { Utensils, Users } from "lucide-react";
import type { CoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";
import { MacroTargetsCard } from "@/components/bodyfuel/MacroTargetsCard";
import { NutritionTargetsEditor } from "@/components/bodyfuel/NutritionTargetsEditor";
import { PlanManagementCard } from "@/components/bodyfuel/PlanManagementCard";
import { AthletePerformanceNutritionSection } from "./AthletePerformanceNutritionSection";
import { Section, TinyMetric, fmtPct } from "./athlete-tab-shared";

export function AthleteNutritionTab({
  data,
  orgId,
  userId,
}: {
  data: CoachAthleteDetail;
  orgId: string;
  userId: string;
}) {
  const c = data.compliance;
  return (
    <div className="space-y-4">
      <AthletePerformanceNutritionSection orgId={orgId} userId={userId} />
      <Section title="Compliance" icon={<Users className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-2">
          <TinyMetric label="Aktuelle Woche" value={fmtPct(c.current_week)} />
          <TinyMetric label="Vorwoche" value={fmtPct(c.prev_week)} />
          <TinyMetric label="Ø 4 Wochen" value={fmtPct(c.four_week_avg)} />
          <TinyMetric label="Team" value={fmtPct(c.team_avg)} />
        </div>
        {c.diff_to_team != null && (
          <div className="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {c.diff_to_team === 0
              ? "Auf Teamdurchschnitt."
              : c.diff_to_team > 0
              ? `${c.diff_to_team} Prozentpunkte über Teamdurchschnitt.`
              : `${Math.abs(c.diff_to_team)} Prozentpunkte unter Teamdurchschnitt.`}
          </div>
        )}
      </Section>

      <Section title="Ziele & Makros" icon={<Utensils className="h-4 w-4" />}>
        <div className="space-y-3">
          <MacroTargetsCard userId={userId} />
          <NutritionTargetsEditor userId={userId} />
        </div>
      </Section>

      <Section title="Ernährungsplan" icon={<Utensils className="h-4 w-4" />}>
        <PlanManagementCard userId={userId} returnOrgId={orgId} />
      </Section>
    </div>
  );
}
