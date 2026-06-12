import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { createCustomer } from "@/lib/coaching.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/coach/customers/new")({
  head: () => ({ meta: [{ title: "Neuer Kunde — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <NewCustomerForm />
    </AppLayout>
  ),
});

const DEFAULT_PRICE = { starter: 79, coaching: 129, premium: 199 } as const;

function NewCustomerForm() {
  const fn = useServerFn(createCustomer);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    package: "coaching" as "starter" | "coaching" | "premium",
    price_eur: 129,
    start_date: new Date().toISOString().slice(0, 10),
    duration_days: 30,
    notes: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email) {
      return toast.error("Vorname, Nachname und E-Mail erforderlich.");
    }
    setBusy(true);
    try {
      await fn({ data: { ...form, origin: window.location.origin } });
      toast.success("Kunde angelegt — Einladung verschickt.");
      navigate({ to: "/coach/customers" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach</p>
        <h1 className="font-display text-3xl font-bold">Neuer Kunde</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Der Kunde erhält automatisch eine E-Mail mit Einladungslink.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Vorname *</Label>
            <Input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Nachname *</Label>
            <Input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>E-Mail *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Telefon</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Paket</Label>
            <Select
              value={form.package}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  package: v as typeof form.package,
                  price_eur: DEFAULT_PRICE[v as keyof typeof DEFAULT_PRICE],
                })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="coaching">Coaching</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Individueller Preis (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.price_eur}
              onChange={(e) => setForm({ ...form, price_eur: Number(e.target.value) })}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Startdatum</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Laufzeit (Tage)</Label>
            <Input
              type="number"
              value={form.duration_days}
              onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notizen</Label>
          <Textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <Button
          type="submit"
          disabled={busy}
          className="w-full bg-gradient-gold text-primary-foreground"
        >
          {busy ? "Lege an …" : "Kunde anlegen & Einladung senden"}
        </Button>
      </form>
    </div>
  );
}
