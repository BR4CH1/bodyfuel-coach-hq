import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { CLIENTS, useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO_FLAG_KEY = "bodyfuel:demo-visible";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — BODYFUEL" },
      { name: "description", content: "Login für BODYFUEL Coaching Kunden." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { loginAs, supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const param = url.searchParams.get("demo");
    if (param === "1") {
      localStorage.setItem(DEMO_FLAG_KEY, "1");
    } else if (param === "0") {
      localStorage.removeItem(DEMO_FLAG_KEY);
    }
    setShowDemo(localStorage.getItem(DEMO_FLAG_KEY) === "1");
  }, []);

  useEffect(() => {
    if (loading) return;
    if (supabaseUser) navigate({ to: "/app", replace: true });
  }, [supabaseUser, loading, navigate]);

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

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rawEmail = (fd.get("email") ?? email ?? "").toString();
    const rawPw = (fd.get("password") ?? password ?? "").toString();
    const normalizedEmail = rawEmail.trim().toLowerCase();
    if (!normalizedEmail || !rawPw) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: rawPw,
      });
      if (error) throw error;
      toast.success("Willkommen zurück!");
      navigate({ to: "/app", replace: true });
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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* background flair */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-gold/5 blur-3xl" />
      </div>

      <div className="relative grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Brand panel */}
        <div className="hidden flex-col justify-between rounded-3xl border border-border bg-card/40 p-10 lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-gold shadow-gold">
              <Flame className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display text-xl font-bold tracking-wider">BODYFUEL</div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                Nutrition Coaching
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="font-display text-5xl font-bold leading-[1.05]">
              Fuel your <span className="text-gradient-gold">grind.</span>
            </h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tracke täglich deine Habits, level dich vom Rookie zum Legend und arbeite eng mit
              deinem Coach an deinem nächsten Ziel.
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { v: "15", l: "Punkte / Tag" },
                { v: "6", l: "Level" },
                { v: "5", l: "Achievements" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl border border-border bg-background/40 px-3 py-4">
                  <div className="font-display text-2xl text-gold">{s.v}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Login card */}
        <div className="rounded-3xl border border-border bg-card p-7 shadow-gold sm:p-10">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
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

          <h2 className="font-display text-2xl font-bold">{showDemo ? "Demo-Modus" : "Login"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {showDemo ? "Klick dich durch die App – oder " : "Noch kein Account? "}
            <Link to="/auth" search={{ next: undefined }} className="text-gold hover:underline">
              {showDemo ? "erstelle einen echten Account" : "Jetzt registrieren"}
            </Link>
            .
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

          {showDemo && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Demo-Konten
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                {CLIENTS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      loginAs(c.id, false);
                      navigate({ to: "/dashboard" });
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3 text-left transition hover:border-gold/50 hover:bg-secondary"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-gold font-display text-sm font-bold text-primary-foreground">
                      {c.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{c.email}</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-gold">Login →</span>
                  </button>
                ))}
                {/* Demo-Coach-Button entfernt: Coach-Modus erfordert echten Login mit Coach-Rolle. */}
                <button
                  onClick={() => {
                    localStorage.removeItem(DEMO_FLAG_KEY);
                    setShowDemo(false);
                  }}
                  className="mt-2 w-full text-center text-[10px] uppercase tracking-wider text-muted-foreground hover:text-gold"
                >
                  Demo-Konten ausblenden
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
