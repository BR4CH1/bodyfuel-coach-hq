import { Fuely } from "@/components/bodyfuel/Fuely";
import type { CoachWorkloadMetric, CoachWorkloadViewModel } from "@/features/coach-dashboard/types";
import { cn } from "@/lib/utils";

const TONES: Record<CoachWorkloadMetric["tone"], string> = {
  urgent: "border-red-500/30 bg-red-500/8 text-red-500",
  attention: "border-amber-500/30 bg-amber-500/8 text-amber-500",
  info: "border-gold/30 bg-gold/8 text-gold",
  neutral: "border-border bg-background/50 text-muted-foreground",
};

export function CoachFuelyWorkload({ workload }: { workload: CoachWorkloadViewModel }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <Fuely
            emotion={workload.state === "clear" ? "celebrating" : "focused"}
            animation="idle"
            size="md"
            className="shrink-0"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Fuely Workload
            </p>
            <h2 className="mt-1 font-display text-xl font-bold">{workload.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{workload.summary}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {workload.metrics.map((metric) => (
            <div
              key={metric.label}
              className={cn("min-w-28 rounded-2xl border px-3 py-3", TONES[metric.tone])}
            >
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
