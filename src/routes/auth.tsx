import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Lock, Mail } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Login — BODYFUEL" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Ungültige Email").max(255);
const pwSchema = z.string().min(6, "Mindestens 6 Zeichen").max(100);

function AuthPage() {
  const { supabaseUser, profile, isCoach, isFreeUser, loading } = useSession();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabaseUser) return;
    if (next) {
      window.location.href = next;
      return;
    }
    if (isCoach) {
      navigate({ to: "/coach" });
      return;
    }
    if (isFreeUser) {
      navigate({ to: "/tracker/app" });
      return;
    }
    (async () => {
      const { count } = await supabase
        .from("body_measurements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", supabaseUser.id);
      navigate({ to: (count ?? 0) === 0 ? "/measurements" : "/dashboard" });
    })();
  }, [supabaseUser, isCoach, isFreeUser, navigate, next]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Read directly from the form to catch browser-autofilled values that
    // sometimes don't trigger React's onChange (Chrome/Safari password manager).
    const form = e.currentTarget;
    const fd = new FormData(form);
    const rawEmail = (fd.get("email") ?? email ?? "").toString();
    const rawPw = (fd.get("password") ?? password ?? "").toString();
    const normalizedEmail = rawEmail.trim().toLowerCase();
    const normalizedPw = rawPw; // do not trim — passwords may contain spaces intentionally

    const ev = emailSchema.safeParse(normalizedEmail);
    const pv = pwSchema.safeParse(normalizedPw);
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
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Login fehlgeschlagen";
      const msg = /invalid login credentials/i.test(raw)
        ? "E-Mail oder Passwort falsch. Tipp: E-Mail bitte neu eintippen (Autofill kann fehlerhaft sein)."
        : raw;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading || supabaseUser) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-gold">
            <Flame className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          Lädt…
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-gold/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-gold sm:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold">
            <Flame className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-wider">BODYFUEL</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Nutrition Coaching
            </div>
          </div>
        </div>

        <h2 className="font-display text-2xl font-bold">Willkommen zurück</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Melde dich mit deinen Zugangsdaten an. Neue Kunden erhalten ihren
          Login per E-Mail nach dem Erstgespräch.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                required
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />

            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                required
                autoComplete="current-password"
              />

            </div>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            {busy ? "..." : "Einloggen"}
          </Button>
        </form>

        <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
          <div>
            Noch kein Kunde?{" "}
            <Link to="/" className="text-gold hover:underline">
              Kostenloses Erstgespräch anfragen
            </Link>
          </div>
          <div>
            oder{" "}
            <Link to="/login" className="text-gold hover:underline">
              Demo-Login ohne Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

