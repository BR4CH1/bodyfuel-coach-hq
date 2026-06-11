import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import {
  getCustomerDetail,
  updateCustomerPackage,
  confirmPayment,
} from "@/lib/coaching.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/coach/customers/$userId")({
  head: () => ({ meta: [{ title: "Kunde — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <CustomerDetail />
    </AppLayout>
  ),
});

function CustomerDetail() {
  const { userId } = useParams({ from: "/coach/customers/$userId" });
  const getFn = useServerFn(getCustomerDetail);
  const updFn = useServerFn(updateCustomerPackage);
  const payFn = useServerFn(confirmPayment);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["customer", userId],
    queryFn: () => getFn({ data: { user_id: userId } }),
  });

  const activePkg = data?.packages.find((p) => p.is_active) ?? data?.packages[0];

  const [price, setPrice] = useState<number>(0);
  const [pkgKey, setPkgKey] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    if (activePkg) {
      setPrice(Number(activePkg.price_eur));
      setPkgKey(activePkg.package);
      setEndDate(activePkg.end_date);
    }
  }, [activePkg]);

  const update = useMutation({
    mutationFn: (patch: Parameters<typeof updFn>[0]["data"]) =>
      updFn({ data: patch }),
    onSuccess: () => {
      toast.success("Gespeichert.");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: (payment_id: string) => payFn({ data: { payment_id, extend_days: 30 } }),
    onSuccess: () => {
      toast.success("Zahlung bestätigt, Laufzeit verlängert.");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Lade…</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Kunde</p>
        <h1 className="font-display text-3xl font-bold">
          {data.profile?.display_name ?? data.email}
        </h1>
        <p className="text-sm text-muted-foreground">{data.email}</p>
        {data.profile?.phone && (
          <p className="text-sm text-muted-foreground">{data.profile.phone}</p>
        )}
      </div>

      {activePkg && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-bold">Aktives Paket</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Paket</Label>
              <select
                value={pkgKey}
                onChange={(e) => setPkgKey(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="starter">Starter</option>
                <option value="coaching">Coaching</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Preis (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Ablaufdatum</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                update.mutate({
                  package_id: activePkg.id,
                  package: pkgKey as "starter" | "coaching" | "premium",
                  price_eur: price,
                  end_date: endDate,
                })
              }
              className="bg-gradient-gold text-primary-foreground"
            >
              Speichern
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                update.mutate({
                  package_id: activePkg.id,
                  is_active: !activePkg.is_active,
                })
              }
            >
              {activePkg.is_active ? "Deaktivieren" : "Aktivieren"}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Zahlungshistorie</h2>
        {data.payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Noch keine Zahlungen.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2">Datum</th>
                <th>Betrag</th>
                <th>Methode</th>
                <th>Status</th>
                <th>Notiz</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2">{p.payment_date}</td>
                  <td>{Number(p.amount_eur).toFixed(2)} €</td>
                  <td>{p.method}</td>
                  <td>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase " +
                        (p.status === "confirmed"
                          ? "bg-gold/10 text-gold"
                          : p.status === "pending"
                            ? "bg-warning/20 text-warning"
                            : "bg-muted text-muted-foreground")
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{p.note ?? "—"}</td>
                  <td className="text-right">
                    {p.status === "pending" && (
                      <Button size="sm" onClick={() => confirm.mutate(p.id)}>
                        Bestätigen
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
