import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Dumbbell,
  Eye,
  ListChecks,
  Pencil,
  Rocket,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  getCustomerTrainingPlanOverview,
  transitionTrainingPlanStatus,
  deleteTrainingPlanDraft,
  updateTrainingPlanScheduling,
  setAutoPublishTraining,
  type TrainingPlanStatus,
} from "@/lib/training-plan-management.functions";
import { generateAiTrainingPlanDraft } from "@/lib/training-plan-ai.functions";

const STATUS_LABEL: Record<TrainingPlanStatus, string> = {
  draft: "Entwurf",
  approved: "Freigegeben",
  published: "Veröffentlicht",
  active: "Aktiv",
  archived: "Archiviert",
};

const STATUS_COLOR: Record<TrainingPlanStatus, string> = {
  draft: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  approved: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  published: "bg-violet-500/15 text-violet-600 border-violet-500/30",
  active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  archived: "bg-muted text-muted-foreground border-border",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function TrainingPlanManagementCard({ userId, returnOrgId }: { userId: string; returnOrgId?: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getCustomerTrainingPlanOverview);
  const genFn = useServerFn(generateAiTrainingPlanDraft);
  const transFn = useServerFn(transitionTrainingPlanStatus);
  const delFn = useServerFn(deleteTrainingPlanDraft);
  const schedFn = useServerFn(updateTrainingPlanScheduling);
  const autoFn = useServerFn(setAutoPublishTraining);

  const { data, isLoading } = useQuery({
    queryKey: ["training-plan-overview", userId],
    queryFn: () => getFn({ data: { user_id: userId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["training-plan-overview", userId] });
  };

  const gen = useMutation({
    mutationFn: (start_mode: "today" | "next_week") =>
      genFn({ data: { user_id: userId, start_mode } }),
    onSuccess: (_d, mode) => {
      toast.success(
        mode === "today"
          ? "Trainingsplan-Entwurf ab heute erstellt."
          : "Trainingsplan-Entwurf ab nächster Woche erstellt.",
      );
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Erstellen"),
  });

  const trans = useMutation({
    mutationFn: ({ id, to }: { id: string; to: TrainingPlanStatus }) =>
      transFn({ data: { plan_id: id, to } }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.to === "active"
          ? "Trainingsplan aktiviert."
          : `Status: ${STATUS_LABEL[vars.to]}`,
      );
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { plan_id: id } }),
    onSuccess: () => {
      toast.success("Plan gelöscht.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const auto = useMutation({
    mutationFn: (v: boolean) =>
      autoFn({ data: { user_id: userId, auto_publish: v } }),
    onSuccess: () => invalidate(),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-gold" />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Training
            </p>
            <h2 className="font-display text-xl font-bold">Trainingsplan Management</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => gen.mutate("today")}
            disabled={gen.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {gen.isPending ? "Erstelle…" : "Smart-Plan generieren"}
          </button>
          <button
            onClick={() => gen.mutate("next_week")}
            disabled={gen.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {gen.isPending ? "Erstelle…" : "Plan ab nächster Woche"}
          </button>
          <Link
            to="/coach/training-builder/$userId"
            params={{ userId }}
            search={returnOrgId ? { orgId: returnOrgId } : {}}
            className="inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-background px-3 py-2 text-sm font-semibold hover:bg-accent"
          >
            <Pencil className="h-4 w-4" />
            Manuell erstellen
          </Link>
          <a
            href={
              returnOrgId
                ? `/coach/import-plan?type=training&client=${userId}&orgId=${returnOrgId}`
                : `/coach/import-plan?type=training&client=${userId}`
            }
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-accent"
          >
            <Pencil className="h-4 w-4" />
            Eigenen Plan importieren
          </a>
        </div>
      </div>

      {isLoading && (
        <div className="mt-4 text-sm text-muted-foreground">Lade…</div>
      )}

      {!isLoading && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TrainingPlanColumn
            label="Aktiver Plan"
            tone="active"
            userId={userId}
            plan={data?.active ?? null}
            onArchive={(id) => trans.mutate({ id, to: "archived" })}
          />
          <TrainingPlanColumn
            label="Nächster Plan"
            tone="next"
            userId={userId}
            plan={data?.next ?? null}
            onApprove={(id) => trans.mutate({ id, to: "approved" })}
            onPublish={(id) => trans.mutate({ id, to: "published" })}
            onActivate={(id) => trans.mutate({ id, to: "active" })}
            onDelete={(id) => {
              if (confirm("Entwurf wirklich löschen?")) del.mutate(id);
            }}
            onUpdateDates={(id, start, end) =>
              schedFn({
                data: {
                  plan_id: id,
                  scheduled_start_date: start,
                  scheduled_end_date: end,
                },
              })
                .then(() => {
                  toast.success("Termine gespeichert.");
                  invalidate();
                })
                .catch((e) => toast.error(e?.message ?? "Fehler"))
            }
          />

        </div>
      )}

      {data && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              Trainingstage:{" "}
              <strong>
                {data.training_weekdays?.length
                  ? data.training_weekdays.join(", ")
                  : "—"}
              </strong>
            </span>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-current"
              checked={data.auto_publish}
              onChange={(e) => auto.mutate(e.target.checked)}
            />
            Automatisch aktivieren (sonst Coach-Freigabe nötig)
          </label>
        </div>
      )}

      {data && data.archive.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
            Planarchiv ({data.archive.length})
          </summary>
          <ul className="mt-3 divide-y divide-border text-sm">
            {data.archive.map((p: any) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Dumbbell className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{p.title}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {fmtDate(p.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function TrainingPlanColumn(props: {
  label: string;
  tone: "active" | "next";
  userId: string;
  plan: any | null;
  onArchive?: (id: string) => void;
  onApprove?: (id: string) => void;
  onPublish?: (id: string) => void;
  onActivate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateDates?: (id: string, start: string | null, end: string | null) => void;
}) {
  const { label, tone, plan, userId } = props;

  const [editDates, setEditDates] = useState(false);
  const [start, setStart] = useState<string>(plan?.scheduled_start_date ?? "");
  const [end, setEnd] = useState<string>(plan?.scheduled_end_date ?? "");

  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === "active"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-amber-500/30 bg-amber-500/5"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        {plan && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLOR[plan.status as TrainingPlanStatus]}`}
          >
            {STATUS_LABEL[plan.status as TrainingPlanStatus]}
          </span>
        )}
      </div>

      {!plan && (
        <p className="mt-3 text-sm text-muted-foreground">
          {tone === "active"
            ? "Kein aktiver Trainingsplan."
            : "Kein nächster Trainingsplan vorbereitet."}
        </p>
      )}

      {plan && (
        <>
          <h3 className="mt-2 font-display text-base font-bold">{plan.title}</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {fmtDate(plan.scheduled_start_date)} –{" "}
                {fmtDate(plan.scheduled_end_date)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" />
              <span>
                {plan.days_count} Tage · {plan.exercises_count} Übungen
              </span>
            </div>
          </div>

          {tone === "next" && editDates && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                type="date"
                value={start ?? ""}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              />
              <input
                type="date"
                value={end ?? ""}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              />
              <button
                onClick={() => {
                  props.onUpdateDates?.(plan.id, start || null, end || null);
                  setEditDates(false);
                }}
                className="col-span-2 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
              >
                Termine speichern
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/coach/training-builder/${userId}?planId=${plan.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Pencil className="h-3.5 w-3.5" /> Bearbeiten
            </a>

            <a
              href={`/coach/plan-preview/${plan.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Eye className="h-3.5 w-3.5" /> Vorschau
            </a>
            {tone === "next" && (
              <button
                onClick={() => setEditDates((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <Calendar className="h-3.5 w-3.5" /> Termine
              </button>
            )}
            {tone === "next" && plan.status === "draft" && (
              <button
                onClick={() => props.onApprove?.(plan.id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Freigeben
              </button>
            )}
            {tone === "next" && plan.status === "approved" && (
              <button
                onClick={() => props.onPublish?.(plan.id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                <Clock className="h-3.5 w-3.5" /> Veröffentlichen
              </button>
            )}
            {tone === "next" && (
              <button
                onClick={() => props.onActivate?.(plan.id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                <Rocket className="h-3.5 w-3.5" /> Jetzt aktivieren
              </button>
            )}
            {tone === "next" && (
              <button
                onClick={() => props.onDelete?.(plan.id)}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {tone === "active" && (
              <button
                onClick={() => props.onArchive?.(plan.id)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Archivieren
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
