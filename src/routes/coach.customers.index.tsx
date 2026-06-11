import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Plus, Inbox } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { listCustomers } from "@/lib/coaching.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/coach/customers/")({
  head: () => ({ meta: [{ title: "Kunden — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <CustomersList />
    </AppLayout>
  ),
});

function CustomersList() {
  const fn = useServerFn(listCustomers);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: () => fn(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach</p>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Kunden & Pakete</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/coach/leads">
            <Button variant="outline" size="sm">
              <Inbox className="mr-1 h-4 w-4" /> Anfragen
            </Button>
          </Link>
          <Link to="/coach/customers/new">
            <Button size="sm" className="bg-gradient-gold text-primary-foreground">
              <Plus className="mr-1 h-4 w-4" /> Neuer Kunde
            </Button>
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Lade…</p>}
      {data && data.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Noch keine Kunden angelegt.
        </p>
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">E-Mail</th>
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3">Preis</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">Ende</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3 font-semibold">{c.display_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 uppercase tracking-wider text-gold">{c.package}</td>
                  <td className="px-4 py-3 font-display">{Number(c.price_eur).toFixed(2)} €</td>
                  <td className="px-4 py-3">{c.start_date}</td>
                  <td className="px-4 py-3">{c.end_date}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-2 py-1 text-[10px] font-bold uppercase " +
                        (c.is_active
                          ? "bg-gold/10 text-gold"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {c.is_active ? "aktiv" : "inaktiv"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/coach/customers/$userId"
                      params={{ userId: c.user_id }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
                    >
                      Detail <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
