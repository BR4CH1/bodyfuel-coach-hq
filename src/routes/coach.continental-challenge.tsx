import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Clock3, Copy, ExternalLink, Flag, Users, XCircle } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CONTINENTAL_MAX_APPROVED,
  GOAL_TYPE_LABELS,
  listContinentalApplications,
  reviewContinentalApplication,
  updateContinentalApplicationNotes,
} from "@/lib/continental-challenge.functions";

export const Route = createFileRoute("/coach/continental-challenge")({
  head: () => ({ meta: [{ title: "Continental Bewerbungen — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <ContinentalApplicationsPage />
    </AppLayout>
  ),
});

type ApplicationRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  age: number | null;
  goal_type: string | null;
  goal_text: string;
  motivation: string;
  status: string;
  reviewed_at: string | null;
  internal_notes: string | null;
  created_at: string;
  performance_org_id: string | null;
  performance_org_slug: string | null;
  performance_invite_status: string | null;
  performance_invite_path: string | null;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Offen", className: "bg-amber-500/15 text-amber-400" },
  approved: { label: "Angenommen", className: "bg-gold/15 text-gold" },
  rejected: { label: "Abgelehnt", className: "bg-red-500/15 text-red-400" },
};

const INVITE_META: Record<string, string> = {
  pending: "Einladung offen",
  accepted: "Beigetreten",
  expired: "Einladung abgelaufen",
  revoked: "Einladung widerrufen",
};

const FILTERS = [
  { key: "all", label: "Alle" },
  { key: "pending", label: "Offen" },
  { key: "approved", label: "Angenommen" },
  { key: "rejected", label: "Abgelehnt" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function ContinentalApplicationsPage() {
  const listFn = useServerFn(listContinentalApplications);
  const reviewFn = useServerFn(reviewContinentalApplication);
  const notesFn = useServerFn(updateContinentalApplicationNotes);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["continental-applications"],
    queryFn: () => listFn(),
  });

  const applications = (data ?? []) as ApplicationRow[];
  const performanceOrgId = applications.find((a) => a.performance_org_id)?.performance_org_id ?? null;

  const stats = useMemo(() => {
    const total = applications.length;
    const pending = applications.filter((a) => a.status === "pending").length;
    const approved = applications.filter((a) => a.status === "approved").length;
    const rejected = applications.filter((a) => a.status === "rejected").length;
    return { total, pending, approved, rejected };
  }, [applications]);

  const filtered = filter === "all" ? applications : applications.filter((a) => a.status === filter);
  const selected = applications.find((a) => a.id === selectedId) ?? null;
  const capacityReached = stats.approved >= CONTINENTAL_MAX_APPROVED;

  const copyInvite = async (path: string) => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Einladungslink kopiert.");
    } catch {
      toast.error("Link konnte nicht kopiert werden.");
    }
  };

  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      reviewFn({ data: { id, decision } }),
    onSuccess: (res, vars) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        vars.decision === "approved"
          ? "Bewerbung angenommen. Performance-Einladung erstellt."
          : "Bewerbung abgelehnt.",
      );
      qc.invalidateQueries({ queryKey: ["continental-applications"] });
    },
    onError: (err: Error) => toast.error(err.message || "Status konnte nicht geändert werden."),
  });

  const saveNotes = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => notesFn({ data: { id, notes } }),
    onSuccess: () => {
      toast.success("Notiz gespeichert.");
      qc.invalidateQueries({ queryKey: ["continental-applications"] });
    },
    onError: (err: Error) => toast.error(err.message || "Notiz konnte nicht gespeichert werden."),
  });

  const openDetail = (application: ApplicationRow) => {
    setSelectedId(application.id);
    setNotesDraft(application.internal_notes ?? "");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach</p>
          <h1 className="font-display text-3xl font-bold">Continental Bewerbungen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bewerbungen für die 30-Tage-Challenge prüfen und in die Performance-Organisation freigeben.
            Maximal {CONTINENTAL_MAX_APPROVED} Plätze.
          </p>
        </div>
        {performanceOrgId && (
          <Button variant="outline" asChild className="gap-2">
            <a href={`/coach/teams/${performanceOrgId}`}>
              Performance-Cockpit <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <div className="font-semibold">Continental läuft über BodyFuel Performance</div>
        <p className="mt-1 text-muted-foreground">
          Freigegebene Personen erhalten eine persönliche Athleten-Einladung. Erst nach Annahme werden
          sie Mitglied der Organisation und erhalten über die aktivierten Organisationsmodule BodyFuel Smart.
          Die 30-Tage-Challenge wird im normalen Performance-Cockpit terminiert und aktiviert, sobald das
          Startdatum feststeht.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Bewerbungen gesamt" value={String(stats.total)} />
        <StatCard icon={Clock3} label="Offen" value={String(stats.pending)} />
        <StatCard
          icon={CheckCircle2}
          label="Angenommene Plätze"
          value={`${stats.approved} / ${CONTINENTAL_MAX_APPROVED}`}
          highlight={capacityReached}
        />
        <StatCard icon={XCircle} label="Abgelehnt" value={String(stats.rejected)} />
      </div>

      {capacityReached && (
        <div className="rounded-xl border border-gold/35 bg-gold/10 p-4 text-sm">
          Alle {CONTINENTAL_MAX_APPROVED} Plätze sind vergeben. Weitere Bewerbungen können nur noch
          abgelehnt werden.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                {f.key === "pending" ? stats.pending : f.key === "approved" ? stats.approved : stats.rejected}
              </span>
            )}
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Lade…</p>}

      {!isLoading && filtered.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {filter === "all" ? "Noch keine Bewerbungen." : "Keine Bewerbungen mit diesem Status."}
        </p>
      )}

      <div className="grid gap-4">
        {filtered.map((application) => {
          const meta = STATUS_META[application.status] ?? STATUS_META.pending;
          return (
            <div key={application.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-lg font-bold">
                    {application.first_name} {application.last_name}
                  </div>
                  <div className="break-all text-sm text-muted-foreground">
                    {application.email} · {application.phone}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Bewerbung vom {new Date(application.created_at).toLocaleDateString("de-DE")}
                    {application.age ? ` · ${application.age} Jahre` : ""}
                    {application.goal_type
                      ? ` · ${GOAL_TYPE_LABELS[application.goal_type] ?? application.goal_type}`
                      : ""}
                  </div>
                  {application.performance_invite_status && (
                    <div className="mt-2 text-xs font-medium text-gold">
                      {INVITE_META[application.performance_invite_status] ?? application.performance_invite_status}
                    </div>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${meta.className}`}>
                  {meta.label}
                </span>
              </div>

              <p className="mt-3 line-clamp-2 rounded-lg bg-secondary/40 p-3 text-sm">
                {application.goal_text}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openDetail(application)}>
                  Details
                </Button>
                {application.performance_invite_path && application.performance_invite_status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => copyInvite(application.performance_invite_path!)}
                  >
                    <Copy className="h-3.5 w-3.5" /> Einladungslink
                  </Button>
                )}
                {application.status !== "approved" && (
                  <Button
                    size="sm"
                    disabled={review.isPending || capacityReached}
                    onClick={() => review.mutate({ id: application.id, decision: "approved" })}
                  >
                    Zustimmen
                  </Button>
                )}
                {application.status !== "rejected" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={review.isPending || application.performance_invite_status === "accepted"}
                    className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => review.mutate({ id: application.id, decision: "rejected" })}
                  >
                    Ablehnen
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  {selected.first_name} {selected.last_name}
                </DialogTitle>
                <DialogDescription>
                  Bewerbung vom {new Date(selected.created_at).toLocaleString("de-DE")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailItem label="E-Mail">
                    <a href={`mailto:${selected.email}`} className="break-all text-gold hover:underline">
                      {selected.email}
                    </a>
                  </DetailItem>
                  <DetailItem label="Mobilnummer">
                    <a href={`tel:${selected.phone}`} className="text-gold hover:underline">
                      {selected.phone}
                    </a>
                  </DetailItem>
                  <DetailItem label="Alter">{selected.age ? `${selected.age} Jahre` : "—"}</DetailItem>
                  <DetailItem label="Hauptziel">
                    {selected.goal_type ? GOAL_TYPE_LABELS[selected.goal_type] ?? selected.goal_type : "—"}
                  </DetailItem>
                </div>

                <DetailItem label="Was möchtest du in den 30 Tagen erreichen?">
                  <p className="whitespace-pre-wrap rounded-lg bg-secondary/40 p-3">{selected.goal_text}</p>
                </DetailItem>

                <DetailItem label="Warum möchtest du bei der Challenge dabei sein?">
                  <p className="whitespace-pre-wrap rounded-lg bg-secondary/40 p-3">{selected.motivation}</p>
                </DetailItem>

                <DetailItem label="Status">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
                      (STATUS_META[selected.status] ?? STATUS_META.pending).className
                    }`}
                  >
                    {(STATUS_META[selected.status] ?? STATUS_META.pending).label}
                  </span>
                  {selected.reviewed_at && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      geprüft am {new Date(selected.reviewed_at).toLocaleString("de-DE")}
                    </span>
                  )}
                </DetailItem>

                {selected.performance_invite_status && (
                  <DetailItem label="Performance-Zugang">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{INVITE_META[selected.performance_invite_status] ?? selected.performance_invite_status}</span>
                      {selected.performance_invite_path && selected.performance_invite_status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => copyInvite(selected.performance_invite_path!)}
                        >
                          <Copy className="h-3.5 w-3.5" /> Link kopieren
                        </Button>
                      )}
                    </div>
                  </DetailItem>
                )}

                <div>
                  <label
                    htmlFor="cc-internal-notes"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Interne Notiz
                  </label>
                  <Textarea
                    id="cc-internal-notes"
                    rows={3}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    maxLength={4000}
                    className="mt-2"
                    placeholder="Nur für Coaches sichtbar…"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={saveNotes.isPending || notesDraft === (selected.internal_notes ?? "")}
                    onClick={() => saveNotes.mutate({ id: selected.id, notes: notesDraft })}
                  >
                    {saveNotes.isPending ? "Speichert…" : "Notiz speichern"}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {selected.status !== "approved" && (
                    <Button
                      size="sm"
                      disabled={review.isPending || capacityReached}
                      onClick={() => review.mutate({ id: selected.id, decision: "approved" })}
                    >
                      Zustimmen
                    </Button>
                  )}
                  {selected.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={review.isPending || selected.performance_invite_status === "accepted"}
                      className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => review.mutate({ id: selected.id, decision: "rejected" })}
                    >
                      Ablehnen
                    </Button>
                  )}
                  {capacityReached && selected.status !== "approved" && (
                    <p className="w-full text-xs text-muted-foreground">
                      Alle {CONTINENTAL_MAX_APPROVED} Plätze sind vergeben — Zustimmen ist deaktiviert.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof Flag;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-gold/40 bg-gold/10" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
