import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Flame, Lock, Mail, Shield } from "lucide-react";
import { CLIENTS, useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const { loginAs } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("stefan@bodyfuel.app");
  const [password, setPassword] = useState("demo");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const client = CLIENTS.find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (client) {
      loginAs(client.id, false);
      navigate({ to: "/dashboard" });
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

          <h2 className="font-display text-2xl font-bold">Demo-Modus</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Klick dich durch die App – oder{" "}
            <Link to="/auth" className="text-gold hover:underline">
              erstelle einen echten Account
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
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
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
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              Einloggen
            </Button>
          </form>

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
            <button
              onClick={() => {
                loginAs("stefan", true);
                navigate({ to: "/coach" });
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-gold/40 bg-accent/40 p-3 text-left transition hover:bg-accent"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background font-display text-sm font-bold text-gold">
                <Shield className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">Coach-Modus</div>
                <div className="truncate text-xs text-muted-foreground">
                  Übersicht aller Kunden öffnen
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-gold">Coach →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
