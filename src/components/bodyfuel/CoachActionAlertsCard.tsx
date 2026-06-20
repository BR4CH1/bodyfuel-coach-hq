import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Scale,
  Utensils,
  Activity,
  ChevronRight,
  Check,
  X,
  ChevronDown,
  Undo2,
} from "lucide-react";
import {
  getCoachActionAlerts,
  resolveCoachAlert,
  unresolveCoachAlert,
  type CoachActionAlert,
  type CoachResolvedAlert,
} from "@/lib/coach-alerts.functions";
import { toast } from "sonner";

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
  const resolveFn = useServerFn(resolveCoachAlert);
  const unresolveFn = useServerFn(unresolveCoachAlert);
  const qc = useQueryClient();
  const [showDone, setShowDone] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["coach-action-alerts"],
    queryFn: () => fetchAlerts(),
    staleTime: 60_000,
  });

  const resolveMut = useMutation({
    mutationFn: (vars: { alert: CoachActionAlert; action: "done" | "ignored" }) =>
      resolveFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.action === "done" ? "Als erledigt markiert" : "Ignoriert");
      qc.invalidateQueries({ queryKey: ["coach-action-alerts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Konnte nicht gespeichert werden"),
  });

  const unresolveMut = useMutation({
    mutationFn: (alert_key: string) => unresolveFn({ data: { alert_key } }),
    onSuccess: () => {
      toast.success("Wieder als offen markiert");
      qc.invalidateQueries({ queryKey: ["coach-action-alerts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Konnte nicht gespeichert werden"),
  });

  const alerts = data?.alerts ?? [];
  const resolved = data?.resolved ?? [];
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
            Nur offene Aufgaben · erledigte sind im Verlauf unten
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
          Keine offenen Warnungen — alles im grünen Bereich. 🎯
        </div>
      ) : (
        <div className="space-y-2">
          {[...red, ...orange].slice(0, 25).map((a) => (
            <AlertRow
              key={a.key}
              alert={a}
              onDone={() => resolveMut.mutate({ alert: a, action: "done" })}
              onIgnore={() => resolveMut.mutate({ alert: a, action: "ignored" })}
              disabled={resolveMut.isPending}
            />
          ))}
          {alerts.length > 25 && (
            <div className="pt-1 text-xs text-muted-foreground">
              +{alerts.length - 25} weitere Warnungen
            </div>
          )}
        </div>
      )}

      <div className="border-t border-border/50 pt-3">
        <button
          type="button"
          onClick={() => setShowDone((s) => !s)}
          className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            Erledigte · letzte 7 Tage ({resolved.length})
          </span>
          <ChevronDown
            className={`h-4 w-4 transition ${showDone ? "rotate-180" : ""}`}
          />
        </button>
        {showDone && (
          <div className="mt-3 space-y-2">
            {resolved.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Noch nichts erledigt in den letzten 7 Tagen.
              </div>
            ) : (
              resolved.map((r) => (
                <ResolvedRow
                  key={r.key + r.resolved_at}
                  resolved={r}
                  onUndo={() => unresolveMut.mutate(r.key)}
                  disabled={unresolveMut.isPending}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertRow({
  alert,
  onDone,
  onIgnore,
  disabled,
}: {
  alert: CoachActionAlert;
  onDone: () => void;
  onIgnore: () => void;
  disabled?: boolean;
}) {
  const Icon = KIND_ICON[alert.kind];
  const tone =
    alert.severity === "red"
      ? "border-destructive/40 bg-destructive/5"
      : "border-warning/40 bg-warning/10";
  const dot = alert.severity === "red" ? "bg-destructive" : "bg-warning";

  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <Link
        to="/coach/customers/$userId"
        params={{ userId: alert.user_id }}
        className="group flex items-start gap-3"
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
          Details
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </Link>
      <div className="mt-2 flex items-center justify-end gap-2 pl-7">
        <button
          type="button"
          onClick={onIgnore}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Ignorieren
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Erledigt
        </button>
      </div>
    </div>
  );
}

function ResolvedRow({
  resolved,
  onUndo,
  disabled,
}: {
  resolved: CoachResolvedAlert;
  onUndo: () => void;
  disabled?: boolean;
}) {
  const Icon = KIND_ICON[resolved.kind];
  const when = new Date(resolved.resolved_at).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/30 p-2.5 opacity-80">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium line-through decoration-muted-foreground/60">
            {resolved.name}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {resolved.action === "done" ? "Erledigt" : "Ignoriert"} · {when}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {resolved.title}
        </div>
      </div>
      <button
        type="button"
        onClick={onUndo}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground transition hover:text-foreground disabled:opacity-50"
      >
        <Undo2 className="h-3 w-3" />
        Rückgängig
      </button>
    </div>
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
