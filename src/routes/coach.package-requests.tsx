import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Mail } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFormDraft, clearFormDraft } from "@/hooks/use-form-draft";
import {
  listPackageRequests,
  updatePackageRequest,
} from "@/lib/coaching.functions";
import { PACKAGE_LABEL, type PackageKey } from "@/lib/bodyfuel/packages";

export const Route = createFileRoute("/coach/package-requests")({
  head: () => ({ meta: [{ title: "Paketanfragen — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <PackageRequestsAdmin />
    </AppLayout>
  ),
});

type Row = {
  id: string;
  user_id: string;
  request_type: "renewal" | "change" | "contact";
  current_package: string | null;
  requested_package: string | null;
  status: "pending" | "approved" | "declined";
  note: string | null;
  coach_note: string | null;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  renewal: "Verlängerung",
  change: "Paketwechsel",
  contact: "Kontaktanfrage",
};

function PackageRequestsAdmin() {
  const listFn = useServerFn(listPackageRequests);
  const updateFn = useServerFn(updatePackageRequest);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await listFn();
      setRows(data as Row[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const update = async (
    id: string,
    status: "approved" | "declined",
  ) => {
    try {
      await updateFn({
        data: { id, status, coach_note: notes[id] || undefined },
      });
      toast.success(status === "approved" ? "Genehmigt" : "Abgelehnt");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filtered = rows.filter((r) =>
    filter === "all" ? true : r.status === "pending",
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/coach"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Coach Dashboard
          </Link>
          <h1 className="mt-1 font-display text-3xl font-bold">Paketanfragen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verlängerungen, Wechsel und Kontaktanfragen deiner Kunden.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
          >
            Offen ({rows.filter((r) => r.status === "pending").length})
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Alle ({rows.length})
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="text-sm text-muted-foreground">Lade …</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Keine Anfragen.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-bold">
                    {r.customer_name ?? "Ohne Namen"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.customer_email}
                  </div>
                </div>
                <span
                  className={
                    "rounded-full px-3 py-1 text-xs font-semibold " +
                    (r.status === "approved"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : r.status === "declined"
                        ? "bg-destructive/20 text-destructive"
                        : "bg-warning/20 text-warning")
                  }
                >
                  {r.status === "pending"
                    ? "Offen"
                    : r.status === "approved"
                      ? "Genehmigt"
                      : "Abgelehnt"}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                <Field label="Typ" value={TYPE_LABEL[r.request_type]} />
                <Field
                  label="Aktuell"
                  value={
                    r.current_package
                      ? PACKAGE_LABEL[r.current_package as PackageKey] ??
                        r.current_package
                      : "—"
                  }
                />
                <Field
                  label="Gewünscht"
                  value={
                    r.requested_package
                      ? PACKAGE_LABEL[r.requested_package as PackageKey] ??
                        r.requested_package
                      : "—"
                  }
                />
                <Field
                  label="Datum"
                  value={new Date(r.created_at).toLocaleDateString("de-DE")}
                />
              </div>

              {r.note && (
                <div className="mt-3 rounded-lg border border-border bg-background/40 p-3 text-sm">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Nachricht vom Kunden
                  </div>
                  <div className="mt-1">{r.note}</div>
                </div>
              )}

              {r.status === "pending" && (
                <>
                  <Textarea
                    className="mt-3"
                    rows={2}
                    placeholder="Interne Notiz / Antwort (optional)"
                    value={notes[r.id] ?? ""}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [r.id]: e.target.value }))
                    }
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => update(r.id, "approved")}
                      className="bg-gradient-gold text-primary-foreground"
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Genehmigen
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => update(r.id, "declined")}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Ablehnen
                    </Button>
                    {r.customer_email && (
                      <a
                        href={`mailto:${r.customer_email}`}
                        className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:border-gold/40"
                      >
                        <Mail className="mr-1 h-4 w-4" />
                        Kunde kontaktieren
                      </a>
                    )}
                  </div>
                </>
              )}

              {r.coach_note && r.status !== "pending" && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Notiz: {r.coach_note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
