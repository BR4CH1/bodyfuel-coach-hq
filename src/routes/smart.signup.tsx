import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Sparkles, Mail, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { isPaymentsConfigured } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/bodyfuel/Logo";
import { AgeGate } from "@/components/bodyfuel/AgeGate";
import { getMyGuardianStatus } from "@/lib/guardian.functions";
import { X } from "lucide-react";

export const Route = createFileRoute("/smart/signup")({
  head: () => ({
    meta: [
      { title: "BodyFuel Smart starten — 14,99 € / Monat" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SmartSignupPage,
});

const schema = z.object({
  first_name: z.string().trim().min(1, "Vorname erforderlich").max(60),
  last_name: z.string().trim().min(1, "Nachname erforderlich").max(60),
  email: z.string().trim().email("Ungültige E-Mail").max(255),
  password: z.string().min(8, "Mindestens 8 Zeichen").max(100),
});

function SmartSignupPage() {
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const [busy, setBusy] = useState(false);

  // Logged-in user landing here → direkt Checkout starten
  useEffect(() => {
    if (loading || !supabaseUser) return;
    if (!isPaymentsConfigured()) {
      toast.error("Stripe ist noch nicht konfiguriert.");
      return;
    }
    openCheckout({ priceId: "bodyfuel_smart_monthly" });
  }, [loading, supabaseUser, openCheckout]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const v = parsed.data;
    setBusy(true);
    try {
      const display_name = `${v.first_name} ${v.last_name}`.trim();
      const { data, error } = await supabase.auth.signUp({
        email: v.email.toLowerCase(),
        password: v.password,
        options: {
          emailRedirectTo: `${window.location.origin}/smart/signup`,
          data: {
            tier: "smart",
            display_name,
            first_name: v.first_name,
            last_name: v.last_name,
          },
        },
      });
      if (error) throw error;
      if (!data.session) {
        toast.success("Bitte bestätige deine E-Mail, dann kannst du den Kauf abschließen.");
        return;
      }
      if (!isPaymentsConfigured()) {
        toast.error("Zahlungsanbieter noch nicht aktiv. Bitte später erneut versuchen.");
        return;
      }
      toast.success("Account erstellt! Schließe jetzt deinen Kauf ab.");
      openCheckout({ priceId: "bodyfuel_smart_monthly" });
    } catch (err: any) {
      const msg = /already registered|user already/i.test(err?.message ?? "")
        ? "Diese E-Mail ist schon registriert. Bitte einloggen."
        : err?.message ?? "Registrierung fehlgeschlagen";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-gold/15 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-gold/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-gold sm:p-9">
        <div className="mb-5 flex items-center justify-between">
          <Logo />
          <div className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3 w-3" /> Smart
          </div>
        </div>

        <h1 className="font-display text-2xl font-bold">
          {supabaseUser ? "Bereit für deinen Autopilot?" : "Smart-Account erstellen"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {supabaseUser
            ? "Schließe deinen Kauf ab — danach geht's direkt ins Onboarding."
            : "14,99 € / Monat · jederzeit kündbar · sofort startklar."}
        </p>

        {!supabaseUser && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">Vorname</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="first_name" name="first_name" required autoComplete="given-name" className="pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Nachname</Label>
                <Input id="last_name" name="last_name" required autoComplete="family-name" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" name="email" type="email" required autoComplete="email" className="pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Passwort</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="pl-9" />
              </div>
              <p className="text-[11px] text-muted-foreground">Mindestens 8 Zeichen.</p>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              {busy ? "…" : "Weiter zur Bezahlung"}
            </Button>
          </form>
        )}

        {supabaseUser && (
          <Button
            onClick={() => openCheckout({ priceId: "bodyfuel_smart_monthly" })}
            className="mt-6 w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="mr-2 h-4 w-4" /> Smart für 14,99 € starten
          </Button>
        )}

        <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
          {!supabaseUser ? (
            <div>
              Schon dabei?{" "}
              <Link to="/auth" className="text-gold hover:underline">Einloggen</Link>
            </div>
          ) : (
            <div>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/smart" });
                }}
                className="text-gold hover:underline"
              >
                Mit anderem Account fortfahren
              </button>
            </div>
          )}
          <div>
            <Link to="/smart" className="hover:text-foreground">← Zurück zur Smart-Übersicht</Link>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <div className="relative my-8 w-full max-w-xl rounded-2xl bg-background shadow-xl">
            <button
              onClick={closeCheckout}
              aria-label="Schließen"
              className="absolute right-3 top-3 z-10 rounded-full bg-background p-2 shadow hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="p-4 pt-12">{checkoutElement}</div>
          </div>
        </div>
      )}
    </div>
  );
}
