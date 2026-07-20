import { ClipboardList, Gauge, Users, Users2 } from "lucide-react";
import { PerfKpi } from "@/features/coach-org-detail/components/OrgDetailPrimitives";
import type { DisplayKpis } from "@/features/coach-org-detail/lib/org-detail.logic";

export function OrgDetailKpiGrid({
  display,
  teamCount,
  staffCount,
}: {
  display: DisplayKpis;
  teamCount: number;
  staffCount: number;
}) {
  return (
    <section className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      <PerfKpi
        icon={<Users className="h-3.5 w-3.5" />}
        label="Athleten"
        value={display.athletes}
        sub="Gesamt"
      />
      <PerfKpi
        icon={<Gauge className="h-3.5 w-3.5" />}
        label="Compliance"
        value={display.compliance != null ? `${display.compliance}%` : "—"}
        sub={display.compliance != null ? "letzte 7 Tage" : "Noch keine Daten"}
        tone={complianceTone(display.compliance)}
      />
      <PerfKpi
        icon={<ClipboardList className="h-3.5 w-3.5" />}
        label="Onboarding offen"
        value={display.pendingOnboardings}
        sub={display.pendingOnboardings > 0 ? "Athleten unvollständig" : "Alle vollständig"}
        tone={display.pendingOnboardings > 0 ? "warn" : "positive"}
      />
      <PerfKpi
        icon={<Users2 className="h-3.5 w-3.5" />}
        label="Teams"
        value={teamCount}
        sub={staffCount > 0 ? `${staffCount} Staff` : "—"}
      />
    </section>
  );
}

function complianceTone(compliance: number | null): "muted" | "positive" | "warn" | "critical" {
  if (compliance == null) return "muted";
  if (compliance >= 80) return "positive";
  if (compliance >= 60) return "warn";
  return "critical";
}
