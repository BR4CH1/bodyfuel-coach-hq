import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { listLeads, updateLeadStatus } from "@/lib/coaching.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/coach/leads")({
  head: () => ({ meta: [{ title: "Anfragen — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <LeadsList />
    </AppLayout>
  ),
});

const STATUS_LABEL: Record<string, string> = {
  new: "Neu",
  contacted: "Kontaktiert",
  converted: "Kunde",
  declined: "Abgelehnt",
};

function LeadsList() {
  const listFn = useServerFn(listLeads);
  const updFn = useServerFn(updateLeadStatus);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => listFn(),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "new" | "contacted" | "converted" | "declined" }) =>
      updFn({ data: { id, status } }),
    onSuccess: () => {
      toast.success("Status aktualisiert.");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach</p>
        <h1 className="font-display text-3xl font-bold">Erstgespräch-Anfragen</h1>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Lade…</p>}
      {data && data.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Noch keine Anfragen.
        </p>
      )}

      <div className="grid gap-4">
        {data?.map((l) => (
          <div key={l.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-display text-lg font-bold">{l.name}</div>
                <div className="text-sm text-muted-foreground">
                  {l.email}
                  {l.phone && ` · ${l.phone}`}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("de-DE")}
                </div>
              </div>
              <span className="rounded-full bg-gold/10 px-3 py-1 text-[11px] font-bold uppercase text-gold">
                {STATUS_LABEL[l.status] ?? l.status}
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              {l.goal && <div><span className="text-muted-foreground">Ziel:</span> {l.goal}</div>}
              {l.current_weight && <div><span className="text-muted-foreground">Gewicht:</span> {l.current_weight}</div>}
              {l.desired_package && <div><span className="text-muted-foreground">Wunschpaket:</span> {l.desired_package}</div>}
            </div>

            {l.message && (
              <p className="mt-3 rounded-lg bg-secondary/40 p-3 text-sm">{l.message}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {(["contacted", "converted", "declined"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={l.status === s ? "default" : "outline"}
                  onClick={() => setStatus.mutate({ id: l.id, status: s })}
                >
                  {STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
