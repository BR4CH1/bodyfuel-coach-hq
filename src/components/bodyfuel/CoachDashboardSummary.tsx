import {
  AlertTriangle,
  Eye,
  CheckCircle2,
  Inbox,
  CalendarClock,
  AlertOctagon,
} from "lucide-react";
import type { CoachRadarData } from "@/lib/coach-radar.functions";

export function CoachDashboardSummary({ data }: { data: CoachRadarData | undefined }) {
  const s = data?.summary;
  const tiles: Array<{
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: "red" | "orange" | "yellow" | "green" | "muted";
  }> = [
    { label: "Sofort handeln", value: s?.red ?? 0, icon: <AlertOctagon className="h-4 w-4" />, tone: "red" },
    { label: "Beobachten", value: (s?.orange ?? 0) + (s?.yellow ?? 0), icon: <Eye className="h-4 w-4" />, tone: "orange" },
    { label: "Auf Kurs", value: s?.green ?? 0, icon: <CheckCircle2 className="h-4 w-4" />, tone: "green" },
    { label: "Offene Aufgaben", value: s?.open_tasks ?? 0, icon: <Inbox className="h-4 w-4" />, tone: "muted" },
    { label: "Pläne laufen aus", value: s?.expiring_plans ?? 0, icon: <CalendarClock className="h-4 w-4" />, tone: "muted" },
    { label: "Aktive Warnungen", value: s?.active_warnings ?? 0, icon: <AlertTriangle className="h-4 w-4" />, tone: "muted" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <SummaryTile key={t.label} {...t} />
      ))}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "red" | "orange" | "yellow" | "green" | "muted";
}) {
  const toneCls =
    tone === "red"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tone === "orange"
        ? "border-warning/40 bg-warning/10 text-warning"
        : tone === "green"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
          : "border-border bg-card text-foreground";
  return (
    <div className={`rounded-2xl border p-3 ${toneCls}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-80">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
