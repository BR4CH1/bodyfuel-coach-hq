import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Willkommen — BODYFUEL" }] }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [done, setDone] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setHasSession(!!s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const requestNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
        redirectTo: `${window.location.origin}/welcome`,
      });
      if (error) throw error;
      toast.success("Neuer Link wurde gesendet. Bitte E-Mails (auch Spam) prüfen.");
      setResendEmail("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResending(false);
    }
  };


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Mindestens 8 Zeichen.");
    if (pw !== pw2) return toast.error("Passwörter stimmen nicht überein.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      await supabase.auth.signOut();
      setDone(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-gold/30 bg-card p-8 shadow-gold">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-wider">BODYFUEL</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold">
              Nutrition Coaching
            </div>
          </div>
        </div>

        {done ? (
          <div className="mt-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-gold text-2xl">
              ✓
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold">
              Dein Zugang wurde erfolgreich eingerichtet.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Willkommen bei BodyFuel! 💪
            </p>
            <Button
              onClick={() => navigate({ to: "/login" })}
              className="mt-6 w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              Jetzt anmelden
            </Button>
          </div>
        ) : (
          <>
            <h2 className="mt-6 font-display text-2xl font-bold">
              Willkommen bei BodyFuel
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Bitte erstelle dein persönliches Passwort für deinen Zugang.
            </p>

            {!hasSession ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
                  Dein Link ist abgelaufen oder ungültig. Bitte fordere unten einen neuen Link an — er ist 15 Minuten gültig.
                </div>
                <form onSubmit={requestNewLink} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="resend-email">Deine E-Mail-Adresse</Label>
                    <Input
                      id="resend-email"
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={resending}
                    className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
                  >
                    {resending ? "…" : "Neuen Link senden"}
                  </Button>
                </form>
              </div>

            ) : (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pw">Neues Passwort</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="pw"
                      type="password"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      className="pl-9"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw2">Passwort wiederholen</Label>
                  <Input
                    id="pw2"
                    type="password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
                >
                  {busy ? "…" : "Zugang aktivieren"}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
