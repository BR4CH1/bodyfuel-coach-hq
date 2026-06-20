import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Scale, Utensils, Activity, ChevronRight } from "lucide-react";
import {
  getCoachActionAlerts,
  type CoachActionAlert,
} from "@/lib/coach-alerts.functions";

const KIND_ICON = {
  weight: Scale,
  nutrition: Utensils,
  tracking: Activity,
} as const;

const KIND_LABEL = {
  weight: "Gewicht",
  nutrition: "Ernährung",
  tracking: "Tracking",
} as const;

export function CoachActionAlertsCard({
  expiringPlansCount = 0,
  openCheckinsCount = 0,
}: {
  expiringPlansCount?: number;
  openCheckinsCount?: number;
}) {
  const fetchAlerts = useServerFn(getCoachActionAlerts);
  const { data, isLoading } = useQuery({
    queryKey: ["coach-action-alerts"],
    queryFn: () => fetchAlerts(),
    staleTime: 60_000,
  });

  const alerts = data?.alerts ?? [];
  const red = alerts.filter((a) => a.severity === "red");
  const orange = alerts.filter((a) => a.severity === "orange");

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h2 className="font-display text-lg font-bold sm:text-xl">Handlungsbedarf</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Priorisiert nach Dringlichkeit · wer braucht jetzt Aufmerksamkeit?
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Pill tone="red" count={red.length} label="Rot" />
          <Pill tone="orange" count={orange.length} label="Orange" />
          <Pill tone="muted" count={expiringPlansCount} label="Pläne" />
          <Pill tone="muted" count={openCheckinsCount} label="Check-ins" />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
          Analysiere Kundendaten…
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
          Aktuell keine kritischen Warnungen — alle Kunden im grünen Bereich.
        </div>
      ) : (
        <div className="space-y-2">
          {[...red, ...orange].slice(0, 25).map((a) => (
            <AlertRow key={a.key} alert={a} />
          ))}
          {alerts.length > 25 && (
            <div className="pt-1 text-xs text-muted-foreground">
              +{alerts.length - 25} weitere Warnungen
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: CoachActionAlert }) {
  const Icon = KIND_ICON[alert.kind];
  const tone =
    alert.severity === "red"
      ? "border-destructive/40 bg-destructive/5"
      : "border-warning/40 bg-warning/10";
  const dot = alert.severity === "red" ? "bg-destructive" : "bg-warning";

  return (
    <Link
      to="/coach/customers/$userId"
      params={{ userId: alert.user_id }}
      className={`group flex items-start gap-3 rounded-xl border p-3 transition hover:border-gold/40 ${tone}`}
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold">{alert.name}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {KIND_LABEL[alert.kind]} · {alert.range}
          </span>
        </div>
        <div className="text-sm">{alert.title}</div>
        <div className="text-xs text-muted-foreground">{alert.detail}</div>
      </div>
      <div className="hidden shrink-0 items-center gap-1 self-center text-xs font-semibold text-gold group-hover:underline sm:flex">
        Details ansehen
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

function Pill({
  tone,
  count,
  label,
}: {
  tone: "red" | "orange" | "muted";
  count: number;
  label: string;
}) {
  const cls =
    tone === "red"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tone === "orange"
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-border bg-background/40 text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${cls}`}
    >
      <span>{count}</span>
      <span className="opacity-70">{label}</span>
    </span>
  );
}
