import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Archive, CalendarClock, CheckCircle2, ChevronDown, ExternalLink, Loader2, PackagePlus } from "lucide-react";
import { useState } from "react";
import {
  listCustomerNutritionPlans,
  setNutritionPlanStatus,
  type CoachPlanRow,
} from "@/lib/coach-plan-history.functions";

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00Z");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manuell",
  ai: "KI",
  import: "Import",
  autopilot: "Autopilot",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-blue-500/15 text-blue-500",
  published: "bg-emerald-500/15 text-emerald-500",
  active: "bg-emerald-500/20 text-emerald-500",
  archived: "bg-muted/50 text-muted-foreground line-through",
};

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "draft";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLE[s] ?? "bg-muted"}`}>
      {s}
    </span>
  );
}

export function CoachNutritionPlanHistoryCard({ userId }: { userId: string }) {
  const listFn = useServerFn(listCustomerNutritionPlans);
  const setStatusFn = useServerFn(setNutritionPlanStatus);
  const qc = useQueryClient();
  const [showPast, setShowPast] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["coach-nutrition-plans", userId],
    queryFn: () => listFn({ data: { client_id: userId } }),
  });

  const setStatus = useMutation({
    mutationFn: (v: { plan_id: string; status: "active" | "archived" | "published" }) =>
      setStatusFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-nutrition-plans", userId] });
      toast.success("Aktualisiert");
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehlgeschlagen"),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold">Ernährungsplan-Historie</h3>
          <p className="text-xs text-muted-foreground">
            Alle Zeiträume dieses Kunden. Pläne werden nicht mehr automatisch überschrieben.
          </p>
        </div>
        <Link
          to="/coach/import-plan"
          search={{ client: userId, type: "nutrition" as const }}
          className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-gold/20"
        >
          <PackagePlus className="h-3.5 w-3.5" /> Woche / Plan importieren
        </Link>
      </div>

      {isLoading && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade…
        </div>
      )}
      {error && <p className="mt-4 text-xs text-destructive">{(error as Error).message}</p>}

      {data && (
        <div className="mt-4 space-y-5">
          <Bucket
            title="Aktuell"
            rows={data.current}
            emptyText="Kein aktiver Plan für heute."
            onArchive={(id) => setStatus.mutate({ plan_id: id, status: "archived" })}
            userId={userId}
          />
          <Bucket
            title="Kommende Pläne"
            rows={data.upcoming}
            emptyText="Keine kommenden Pläne."
            onActivate={(id) => setStatus.mutate({ plan_id: id, status: "active" })}
            onArchive={(id) => setStatus.mutate({ plan_id: id, status: "archived" })}
            userId={userId}
          />
          {data.drafts.length > 0 && (
            <Bucket
              title="Entwürfe"
              rows={data.drafts}
              emptyText=""
              onActivate={(id) => setStatus.mutate({ plan_id: id, status: "published" })}
              onArchive={(id) => setStatus.mutate({ plan_id: id, status: "archived" })}
              userId={userId}
            />
          )}

          <div>
            <button
              onClick={() => setShowPast((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition ${showPast ? "rotate-180" : ""}`} />
              Vergangene Pläne ({data.past.length})
            </button>
            {showPast && (
              <div className="mt-3">
                <Bucket
                  title=""
                  rows={data.past.slice(0, 20)}
                  emptyText="Keine älteren Pläne."
                  userId={userId}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Bucket({
  title,
  rows,
  emptyText,
  onActivate,
  onArchive,
  userId,
}: {
  title: string;
  rows: CoachPlanRow[];
  emptyText: string;
  onActivate?: (id: string) => void;
  onArchive?: (id: string) => void;
  userId: string;
}) {
  return (
    <div>
      {title && (
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
      )}
      {rows.length === 0 ? (
        emptyText ? <p className="text-xs text-muted-foreground">{emptyText}</p> : null
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.id} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{p.title || "Ohne Titel"}</p>
                    <StatusBadge status={p.status} />
                    {p.source && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {SOURCE_LABEL[p.source] ?? p.source}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {fmt(p.scheduled_start_date)} – {fmt(p.scheduled_end_date)}
                    </span>
                    {p.weeks_count ? <span>· {p.weeks_count} Wo.</span> : null}
                    {p.created_at ? (
                      <span>· erstellt {new Date(p.created_at).toLocaleDateString("de-DE")}</span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Link
                    to="/coach/plan-preview/$planId"
                    params={{ planId: p.id }}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:border-gold/50"
                  >
                    <ExternalLink className="h-3 w-3" /> Öffnen
                  </Link>
                  {onActivate && p.status !== "active" && p.status !== "published" && (
                    <button
                      onClick={() => onActivate(p.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-400 hover:bg-emerald-500/20"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Freigeben
                    </button>
                  )}
                  {onArchive && p.status !== "archived" && (
                    <button
                      onClick={() => onArchive(p.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Archive className="h-3 w-3" /> Archivieren
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
