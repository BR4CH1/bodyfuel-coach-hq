import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  ListChecks,
  Pencil,
  Rocket,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  getCustomerPlanOverview,
  transitionPlanStatus,
  deletePlanDraft,
  updatePlanScheduling,
  setAutoPublish,
  type PlanStatus,
} from "@/lib/plan-management.functions";
import { generateAiNutritionPlanDraft } from "@/lib/nutrition-plan-ai.functions";

const STATUS_LABEL: Record<PlanStatus, string> = {
  draft: "Entwurf",
  approved: "Freigegeben",
  published: "Veröffentlicht",
  active: "Aktiv",
  archived: "Archiviert",
};

const STATUS_COLOR: Record<PlanStatus, string> = {
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

export function PlanManagementCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getCustomerPlanOverview);
  const genFn = useServerFn(generateAiNutritionPlanDraft);
  const transFn = useServerFn(transitionPlanStatus);
  const delFn = useServerFn(deletePlanDraft);
  const schedFn = useServerFn(updatePlanScheduling);
  const autoFn = useServerFn(setAutoPublish);

  const { data, isLoading } = useQuery({
    queryKey: ["plan-overview", userId],
    queryFn: () => getFn({ data: { user_id: userId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["plan-overview", userId] });
  };

  const gen = useMutation({
    mutationFn: () => genFn({ data: { user_id: userId } }),
    onSuccess: () => {
      toast.success("Plan-Entwurf erstellt.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Erstellen"),
  });

  const trans = useMutation({
    mutationFn: ({ id, to }: { id: string; to: PlanStatus }) =>
      transFn({ data: { plan_id: id, to } }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.to === "active" ? "Plan aktiviert." : `Status: ${STATUS_LABEL[vars.to]}`,
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
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Ernährung
          </p>
          <h2 className="font-display text-xl font-bold">Plan Management</h2>
        </div>
        <button
          onClick={() => gen.mutate()}
          disabled={gen.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {gen.isPending ? "Erstelle…" : "Plan erstellen"}
        </button>
      </div>

      {isLoading && (
        <div className="mt-4 text-sm text-muted-foreground">Lade…</div>
      )}

      {!isLoading && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <PlanColumn
            label="Aktiver Plan"
            tone="active"
            plan={data?.active ?? null}
            onArchive={(id) => trans.mutate({ id, to: "archived" })}
          />
          <PlanColumn
            label="Nächster Plan"
            tone="next"
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
              Nächster Einkauf in <strong>{data.days_until_next_shopping}</strong> Tag
              {data.days_until_next_shopping === 1 ? "" : "en"}
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
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{p.title}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {p.compliance && <ComplianceDot c={p.compliance} />}
                  <span className="text-xs text-muted-foreground">{fmtDate(p.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function PlanColumn(props: {
  label: string;
  tone: "active" | "next";
  plan: any | null;
  onArchive?: (id: string) => void;
  onApprove?: (id: string) => void;
  onPublish?: (id: string) => void;
  onActivate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateDates?: (id: string, start: string | null, end: string | null) => void;
}) {
  const { label, tone, plan } = props;
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
        <div className="flex items-center gap-2">
          {plan?.compliance && <ComplianceDot c={plan.compliance} />}
          {plan && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLOR[plan.status as PlanStatus]}`}
            >
              {STATUS_LABEL[plan.status as PlanStatus]}
            </span>
          )}
        </div>
      </div>

      {!plan && (
        <p className="mt-3 text-sm text-muted-foreground">
          {tone === "active"
            ? "Kein aktiver Plan."
            : "Kein nächster Plan vorbereitet."}
        </p>
      )}

      {plan && (
        <>
          <h3 className="mt-2 font-display text-base font-bold">{plan.title}</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {fmtDate(plan.scheduled_start_date)} – {fmtDate(plan.scheduled_end_date)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" />
              <span>
                {plan.days_count} Tage · {plan.meals_count} Mahlzeiten
              </span>
            </div>
          </div>

          {(plan.kcal || plan.protein_g) && (
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px]">
              <Macro label="kcal" value={plan.kcal} />
              <Macro label="P" value={plan.protein_g} suffix="g" />
              <Macro label="KH" value={plan.carbs_g} suffix="g" />
              <Macro label="F" value={plan.fat_g} suffix="g" />
            </div>
          )}

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
              href={`/coach/${plan.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Pencil className="h-3.5 w-3.5" /> Bearbeiten
            </a>
            <a
              href={`/nutrition`}
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

function Macro({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div className="rounded-md bg-background/60 px-2 py-1.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold">
        {value ?? "—"}
        {suffix ?? ""}
      </div>
    </div>
  );
}

function ComplianceDot({
  c,
}: {
  c: { score: number; tone: "green" | "yellow" | "red"; days_tracked: number };
}) {
  const color =
    c.tone === "green"
      ? "bg-emerald-500"
      : c.tone === "yellow"
        ? "bg-amber-500"
        : "bg-rose-500";
  const label =
    c.tone === "green"
      ? "Stark dabei"
      : c.tone === "yellow"
        ? "Geht so"
        : "Wenig aktiv";
  return (
    <span
      title={`${label} · ${c.score}% · ${c.days_tracked} Check-ins`}
      className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {c.score}%
    </span>
  );
}
