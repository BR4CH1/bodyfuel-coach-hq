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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setHasSession(!!s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Mindestens 6 Zeichen.");
    if (pw !== pw2) return toast.error("Passwörter stimmen nicht überein.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Passwort gesetzt — willkommen bei BodyFuel!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-gold">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-wider">BODYFUEL</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold">
              Willkommen an Bord
            </div>
          </div>
        </div>

        <h2 className="mt-6 font-display text-2xl font-bold">Setze dein Passwort</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Manu hat dich als Kunde angelegt. Vergib ein Passwort, um dein Dashboard
          zu öffnen.
        </p>

        {!hasSession ? (
          <p className="mt-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
            Bitte öffne diese Seite über den Einladungslink aus deiner E-Mail.
          </p>
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
                required
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              {busy ? "…" : "Passwort speichern & loslegen"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
