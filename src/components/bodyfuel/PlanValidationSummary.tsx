import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PlanValidationReport } from "@/lib/nutrition-plan-constraints";

function MetricRow({
  label,
  actual,
  target,
  unit,
}: {
  label: string;
  actual: number;
  target: number;
  unit: string;
}) {
  const ok = target <= 0 || Math.abs(actual - target) / Math.max(1, target) <= 0.1;
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={ok ? "font-semibold" : "font-semibold text-amber-600"}>
        {actual} / {target} {unit}
      </span>
    </div>
  );
}

/** Kompakte Validierungsübersicht nach einer Plan-Generierung. */
export function PlanValidationSummary({
  report,
  title,
  onApply,
  onRegenerate,
  onEdit,
  busy,
}: {
  report: PlanValidationReport;
  title?: string;
  /** Aktionen werden nur gerendert, wenn ein Handler übergeben wird. */
  onApply?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  busy?: boolean;
}) {
  const metrics = report.metrics;
  const hardOk = report.checks
    .filter((check) => check.id === "nogos" || check.id === "allergies" || check.id === "diet")
    .every((check) => check.ok);

  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {title && (
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
        )}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
            hardOk
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {hardOk ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {hardOk ? "Plan geprüft" : "Harte Regeln verletzt"}
        </span>
      </div>
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

      {metrics && (
        <div className="mt-3 space-y-1 rounded-lg border border-dashed border-border p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ist / Soll (Ø pro Tag)
          </p>
          <MetricRow
            label="Kalorien"
            actual={metrics.kcalActual}
            target={metrics.kcalTarget}
            unit="kcal"
          />
          <MetricRow
            label="Protein"
            actual={metrics.proteinActual}
            target={metrics.proteinTarget}
            unit="g"
          />
          <MetricRow
            label="Kohlenhydrate"
            actual={metrics.carbsActual}
            target={metrics.carbsTarget}
            unit="g"
          />
          <MetricRow label="Fett" actual={metrics.fatActual} target={metrics.fatTarget} unit="g" />
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">Verletzte No-Gos / Allergien</span>
            <span className="font-semibold">
              {metrics.nogoViolations} / {metrics.allergyViolations}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">Fehlende / wiederholte Mahlzeiten</span>
            <span className="font-semibold">
              {metrics.missingMeals} / {metrics.repeatedMeals}
            </span>
          </div>
        </div>
      )}

      {report.suggestions.length > 0 && (
        <p className="mt-2 break-words text-xs text-muted-foreground">
          Vorschläge: {report.suggestions.join(" · ")}
        </p>
      )}

      {(onApply || onRegenerate || onEdit) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onApply && (
            <button
              type="button"
              onClick={onApply}
              disabled={busy || !hardOk}
              className="min-h-[40px] rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-95 disabled:opacity-50"
            >
              Plan übernehmen
            </button>
          )}
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={busy}
              className="min-h-[40px] rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold transition hover:bg-accent disabled:opacity-50"
            >
              Neu generieren
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              disabled={busy}
              className="min-h-[40px] rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold transition hover:bg-accent disabled:opacity-50"
            >
              Manuell bearbeiten
            </button>
          )}
        </div>
      )}
    </div>
  );
}
