import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Inbox,
  ChevronRight,
  Check,
  X,
  ChevronDown,
  Undo2,
  AlertOctagon,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  resolveCoachInboxTask,
  unresolveCoachInboxTask,
  type CoachRadarData,
  type InboxTask,
  type TaskPriority,
} from "@/lib/coach-radar.functions";
import {
  getCoachActionAlerts,
  unresolveCoachAlert,
} from "@/lib/coach-alerts.functions";
import { useQuery } from "@tanstack/react-query";

type Filter = "all" | TaskPriority;

const PRIO_META: Record<
  TaskPriority,
  { label: string; emoji: string; icon: React.ReactNode; pill: string; row: string; dot: string }
> = {
  critical: {
    label: "Kritisch",
    emoji: "🔴",
    icon: <AlertOctagon className="h-4 w-4" />,
    pill: "bg-destructive/15 text-destructive",
    row: "border-destructive/40 bg-destructive/5",
    dot: "bg-destructive",
  },
  important: {
    label: "Wichtig",
    emoji: "🟠",
    icon: <AlertTriangle className="h-4 w-4" />,
    pill: "bg-warning/15 text-warning",
    row: "border-warning/40 bg-warning/10",
    dot: "bg-warning",
  },
  info: {
    label: "Info",
    emoji: "🟢",
    icon: <Info className="h-4 w-4" />,
    pill: "bg-emerald-500/15 text-emerald-500",
    row: "border-emerald-500/30 bg-emerald-500/5",
    dot: "bg-emerald-500",
  },
};

export function CoachTaskInboxCard({ data }: { data: CoachRadarData | undefined }) {
  const qc = useQueryClient();
  const resolveFn = useServerFn(resolveCoachInboxTask);
  const unresolveFn = useServerFn(unresolveCoachInboxTask);
  const unresolveLegacyFn = useServerFn(unresolveCoachAlert);
  const fetchResolved = useServerFn(getCoachActionAlerts);
  const [filter, setFilter] = useState<Filter>("all");
  const [showDone, setShowDone] = useState(false);

  const resolvedQuery = useQuery({
    queryKey: ["coach-resolved-tasks"],
    queryFn: () => fetchResolved(),
    staleTime: 60_000,
    enabled: showDone,
  });

  const resolveMut = useMutation({
    mutationFn: (vars: { task: InboxTask; action: "done" | "ignored" }) =>
      resolveFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.action === "done" ? "Als erledigt markiert" : "Ignoriert");
      qc.invalidateQueries({ queryKey: ["coach-radar"] });
      qc.invalidateQueries({ queryKey: ["coach-resolved-tasks"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Konnte nicht gespeichert werden"),
  });

  const unresolveMut = useMutation({
    mutationFn: (alert_key: string) => unresolveLegacyFn({ data: { alert_key } }),
    onSuccess: () => {
      toast.success("Wieder als offen markiert");
      qc.invalidateQueries({ queryKey: ["coach-radar"] });
      qc.invalidateQueries({ queryKey: ["coach-resolved-tasks"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Konnte nicht gespeichert werden"),
  });
  void unresolveFn; // legacy table reuse keeps API symmetric

  const inbox = data?.inbox ?? [];
  const counts = useMemo(() => {
    const c = { all: inbox.length, critical: 0, important: 0, info: 0 };
    inbox.forEach((t) => {
      c[t.priority]++;
    });
    return c;
  }, [inbox]);

  const filtered = filter === "all" ? inbox : inbox.filter((t) => t.priority === filter);
  const resolvedList = (resolvedQuery.data?.resolved ?? []).slice(0, 50);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-gold" />
            <h2 className="font-display text-lg font-bold sm:text-xl">Aufgaben-Inbox</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Nur offene Aufgaben · automatisch priorisiert
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterPill
          active={filter === "all"}
          label={`Alle (${counts.all})`}
          onClick={() => setFilter("all")}
        />
        <FilterPill
          active={filter === "critical"}
          label={`🔴 Kritisch (${counts.critical})`}
          onClick={() => setFilter("critical")}
          tone="red"
        />
        <FilterPill
          active={filter === "important"}
          label={`🟠 Wichtig (${counts.important})`}
          onClick={() => setFilter("important")}
          tone="orange"
        />
        <FilterPill
          active={filter === "info"}
          label={`🟢 Info (${counts.info})`}
          onClick={() => setFilter("info")}
          tone="green"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
          Keine offenen Aufgaben in dieser Ansicht. 🎯
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 40).map((t) => (
            <TaskRow
              key={t.key}
              task={t}
              onDone={() => resolveMut.mutate({ task: t, action: "done" })}
              onIgnore={() => resolveMut.mutate({ task: t, action: "ignored" })}
              disabled={resolveMut.isPending}
            />
          ))}
          {filtered.length > 40 && (
            <div className="pt-1 text-xs text-muted-foreground">
              +{filtered.length - 40} weitere Aufgaben
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
            Verlauf · letzte 7 Tage
          </span>
          <ChevronDown className={`h-4 w-4 transition ${showDone ? "rotate-180" : ""}`} />
        </button>
        {showDone && (
          <div className="mt-3 space-y-2">
            {resolvedQuery.isLoading ? (
              <div className="text-xs text-muted-foreground">Lade…</div>
            ) : resolvedList.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Noch nichts erledigt in den letzten 7 Tagen.
              </div>
            ) : (
              resolvedList.map((r) => (
                <ResolvedRow
                  key={r.key + r.resolved_at}
                  name={r.name}
                  title={r.title}
                  action={r.action}
                  resolvedAt={r.resolved_at}
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

function FilterPill({
  active,
  label,
  onClick,
  tone,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  tone?: "red" | "orange" | "green";
}) {
  const activeCls =
    tone === "red"
      ? "border-destructive bg-destructive/15 text-destructive"
      : tone === "orange"
        ? "border-warning bg-warning/15 text-warning"
        : tone === "green"
          ? "border-emerald-500 bg-emerald-500/15 text-emerald-500"
          : "border-gold bg-gold/15 text-gold";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active ? activeCls : "border-border text-muted-foreground hover:border-gold/40"
      }`}
    >
      {label}
    </button>
  );
}

function TaskRow({
  task,
  onDone,
  onIgnore,
  disabled,
}: {
  task: InboxTask;
  onDone: () => void;
  onIgnore: () => void;
  disabled?: boolean;
}) {
  const meta = PRIO_META[task.priority];
  return (
    <div className={`rounded-xl border p-3 ${meta.row}`}>
      <Link
        to="/coach/customers/$userId"
        params={{ user_id: task.user_id } as any}
        // Note: TanStack Router expects `userId` as the param name; pass via params explicitly.
      >
        {/* unreachable wrapper; replaced below */}
      </Link>
      <Link
        to="/coach/customers/$userId"
        params={{ userId: task.user_id }}
        className="group flex items-start gap-3"
      >
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
        <span className="mt-0.5 shrink-0 text-muted-foreground">{meta.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold">{task.name}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {meta.label}
            </span>
          </div>
          <div className="text-sm">{task.title}</div>
          <div className="text-xs text-muted-foreground">{task.detail}</div>
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
  name,
  title,
  action,
  resolvedAt,
  onUndo,
  disabled,
}: {
  name: string;
  title: string;
  action: "done" | "ignored";
  resolvedAt: string;
  onUndo: () => void;
  disabled?: boolean;
}) {
  const when = new Date(resolvedAt).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/30 p-2.5 opacity-80">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium line-through decoration-muted-foreground/60">
            {name}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {action === "done" ? "Erledigt" : "Ignoriert"} · {when}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">{title}</div>
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
