import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PlanValidationReport } from "@/lib/nutrition-plan-constraints";

/** Kompakte Validierungsübersicht nach einer Plan-Generierung. */
export function PlanValidationSummary({
  report,
  title,
}: {
  report: PlanValidationReport;
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      {title && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      <ul className="space-y-1.5">
        {report.checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 text-xs">
            {check.ok ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            )}
            <span className="min-w-0 break-words">
              <span className="font-semibold">{check.label}</span>
              {check.detail ? (
                <span className="text-muted-foreground"> — {check.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {report.suggestions.length > 0 && (
        <p className="mt-2 break-words text-xs text-muted-foreground">
          Vorschläge: {report.suggestions.join(" · ")}
        </p>
      )}
    </div>
  );
}
