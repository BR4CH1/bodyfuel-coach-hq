import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Flame, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/tracker/login")({
  head: () => ({ meta: [{ title: "Login — BodyFuel Tracker" }] }),
  component: TrackerLogin,
});

const emailSchema = z.string().trim().email("Ungültige E-Mail").max(255);
const pwSchema = z.string().min(6, "Mindestens 6 Zeichen").max(100);

function TrackerLogin() {
  const { supabaseUser, isCoach, isFreeUser, loading } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !supabaseUser) return;
    if (isCoach) navigate({ to: "/coach" });
    else if (isFreeUser) navigate({ to: "/tracker/app" });
    else navigate({ to: "/dashboard" });
  }, [supabaseUser, isCoach, isFreeUser, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ev = emailSchema.safeParse(email.trim().toLowerCase());
    const pv = pwSchema.safeParse(password);
    if (!ev.success) return toast.error(ev.error.issues[0].message);
    if (!pv.success) return toast.error(pv.error.issues[0].message);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: ev.data,
        password: pv.data,
      });
      if (error) throw error;
      toast.success("Willkommen zurück!");
    } catch (err: any) {
      toast.error(err?.message ?? "Login fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-gold sm:p-9">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold">
            <Flame className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-wider">BODYFUEL TRACKER</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary">Free Account</div>
          </div>
        </div>
        <h2 className="font-display text-2xl font-bold">Willkommen zurück</h2>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-Mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9" required autoComplete="email" autoCapitalize="none"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Passwort</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9" required autoComplete="current-password"
              />
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-gold text-primary-foreground">
            {busy ? "…" : "Einloggen"}
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Noch kein Account?{" "}
          <Link to="/tracker/signup" className="text-primary hover:underline">
            Kostenlos starten
          </Link>
        </p>
      </div>
    </div>
  );
}
