import { useState } from "react";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type BookingPackage = {
  name: string;
  price: number;
};

const PAYPAL_HANDLE = "ManuSchrader";

const schema = z.object({
  name: z.string().trim().min(2, "Bitte gib deinen Namen an").max(100),
  email: z.string().trim().email("Bitte gültige E-Mail").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

export function BookingDialog({
  pkg,
  open,
  onOpenChange,
}: {
  pkg: BookingPackage | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg) return;

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("bookings").insert({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        package: pkg.name,
        price_eur: pkg.price,
        payment_status: "pending",
      });
      if (error) throw error;

      // Buchungsdaten für Danke-Seite zwischenspeichern
      try {
        sessionStorage.setItem(
          "bodyfuel_last_booking",
          JSON.stringify({
            name: parsed.data.name,
            package: pkg.name,
            price: pkg.price,
          }),
        );
      } catch {
        /* ignore */
      }

      const url = `https://www.paypal.me/${PAYPAL_HANDLE}/${pkg.price}EUR`;
      window.open(url, "_blank", "noopener,noreferrer");
      onOpenChange(false);
      setForm({ name: "", email: "", phone: "" });
      // kurze Verzögerung, damit Tab-Öffnen nicht abgebrochen wird
      setTimeout(() => {
        window.location.href = "/danke";
      }, 300);
    } catch (err) {
      console.error(err);
      toast.error("Buchung konnte nicht gespeichert werden. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {pkg ? `${pkg.name} buchen` : "Paket buchen"}
          </DialogTitle>
          <DialogDescription>
            {pkg ? (
              <>
                <span className="text-gradient-gold font-semibold">
                  {pkg.price} €
                </span>{" "}
                / Monat — du wirst zu PayPal weitergeleitet.
              </>
            ) : (
              "Bitte wähle ein Paket"
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="b-name">Name *</Label>
            <Input
              id="b-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Max Mustermann"
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-email">E-Mail *</Label>
            <Input
              id="b-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="max@beispiel.de"
              required
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-phone">Telefon (optional)</Label>
            <Input
              id="b-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+49 …"
              maxLength={40}
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            size="lg"
            className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
          >
            {submitting ? "Weiterleitung …" : "Mit PayPal bezahlen"}
            {!submitting && <ArrowRight className="ml-1 h-4 w-4" />}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Alle Preise inkl. Kleinunternehmerregelung gemäß § 19 UStG. Es wird keine
            Umsatzsteuer ausgewiesen.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
