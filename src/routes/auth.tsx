import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Lock, Mail, User as UserIcon, Shield } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, CLIENTS } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Login — BODYFUEL" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Ungültige Email").max(255);
const pwSchema = z.string().min(6, "Mindestens 6 Zeichen").max(100);

function AuthPage() {
  const { supabaseUser, profile, isCoach } = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"client" | "coach">("client");
  const [demoKey, setDemoKey] = useState<string>("andreas");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (supabaseUser) {
      navigate({ to: isCoach ? "/coach" : "/dashboard" });
    }
  }, [supabaseUser, isCoach, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ev = emailSchema.safeParse(email);
    const pv = pwSchema.safeParse(password);
    if (!ev.success) return toast.error(ev.error.issues[0].message);
    if (!pv.success) return toast.error(pv.error.issues[0].message);

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: ev.data,
          password: pv.data,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              display_name: name.trim() || ev.data.split("@")[0],
              role,
              demo_client_key: role === "client" ? demoKey : null,
            },
          },
        });
        if (error) throw error;
        toast.success("Account erstellt! Du bist eingeloggt.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: ev.data,
          password: pv.data,
        });
        if (error) throw error;
        toast.success("Willkommen zurück!");
      }
      // navigation triggered by effect
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login fehlgeschlagen";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (supabaseUser && profile) return null;

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

        <div className="mb-6 flex gap-1 rounded-lg border border-border bg-secondary/40 p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                mode === m ? "bg-gradient-gold text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "signin" ? "Einloggen" : "Registrieren"}
            </button>
          ))}
        </div>

        <h2 className="font-display text-2xl font-bold">
          {mode === "signin" ? "Willkommen zurück" : "Werde Teil von BODYFUEL"}
        </h2>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Anzeigename</Label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9"
                  placeholder="Stefan M."
                  maxLength={80}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                required
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
          </div>

          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label>Rolle</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["client", "coach"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`rounded-lg border p-3 text-left transition ${
                        role === r
                          ? "border-gold/60 bg-accent/40"
                          : "border-border bg-secondary/30 hover:border-gold/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        {r === "coach" ? <Shield className="h-4 w-4 text-gold" /> : <UserIcon className="h-4 w-4 text-gold" />}
                        {r === "client" ? "Kunde" : "Coach"}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {r === "client" ? "Tracking & Plan ansehen" : "Kunden verwalten & Pläne hochladen"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {role === "client" && (
                <div className="space-y-2">
                  <Label htmlFor="demo">Demo-Profil verknüpfen</Label>
                  <select
                    id="demo"
                    value={demoKey}
                    onChange={(e) => setDemoKey(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {CLIENTS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Lädt das Demo-Dashboard für diesen Charakter (Tracking-Daten sind Beispiele).
                  </p>
                </div>
              )}
            </>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            {busy ? "..." : mode === "signin" ? "Einloggen" : "Account erstellen"}
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          oder{" "}
          <Link to="/login" className="text-gold hover:underline">
            Demo-Login ohne Account
          </Link>
        </div>
      </div>
    </div>
  );
}
