import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Lock, Mail, User, Check, Sparkles } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { startMyTrial } from "@/lib/trial.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/trial")({
  head: () => ({
    meta: [
      { title: "7 Tage kostenlos testen — BODYFUEL" },
      {
        name: "description",
        content:
          "Teste BODYFUEL 7 Tage gratis: Starter-Trainingsplan, Starter-Ernährungsplan, Tracking, Ranking und Fortschritts-Graphen. Keine Zahlungsdaten nötig.",
      },
      { property: "og:title", content: "BODYFUEL – 7 Tage kostenlos testen" },
      {
        property: "og:description",
        content:
          "Starter-Trainingsplan, Starter-Ernährungsplan, Tracking & Fortschritte – 7 Tage gratis testen.",
      },
    ],
  }),
  component: TrialSignupPage,
});

const nameSchema = z.string().trim().min(2, "Bitte deinen Namen eingeben").max(80);
const emailSchema = z.string().trim().email("Ungültige E-Mail").max(255);
const pwSchema = z.string().min(8, "Mindestens 8 Zeichen").max(100);

function TrialSignupPage() {
  const { supabaseUser } = useSession();
  const navigate = useNavigate();
  const startTrialFn = useServerFn(startMyTrial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (supabaseUser) navigate({ to: "/dashboard" });
  }, [supabaseUser, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nv = nameSchema.safeParse(name);
    const ev = emailSchema.safeParse(email);
    const pv = pwSchema.safeParse(password);
    if (!nv.success) return toast.error(nv.error.issues[0].message);
    if (!ev.success) return toast.error(ev.error.issues[0].message);
    if (!pv.success) return toast.error(pv.error.issues[0].message);

    setBusy(true);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "https://bodyfuel-coach-hq.lovable.app";
      // Vor dem Signup markieren: wird nach E-Mail-Bestätigung beim Dashboard-Load
      // verwendet, um den Trial automatisch zu starten.
      if (typeof window !== "undefined") {
        localStorage.setItem("bodyfuel.trial.pending", "1");
      }
      const { data: signUp, error } = await supabase.auth.signUp({
        email: ev.data,
        password: pv.data,
        options: {
          emailRedirectTo: `${origin}/dashboard?trial=started`,
          data: { display_name: nv.data, role: "client" },
        },
      });
      if (error) throw error;

      // Falls Auto-Confirm aktiv: Session existiert -> Trial sofort starten.
      if (signUp.session) {
        try {
          await startTrialFn();
          if (typeof window !== "undefined") {
            localStorage.removeItem("bodyfuel.trial.pending");
          }
        } catch (err) {
          console.error("startMyTrial failed", err);
        }
        toast.success("Dein 7-Tage-Test wurde aktiviert!");
        if (typeof window !== "undefined") {
          sessionStorage.setItem("bodyfuel.trial.welcome", "1");
        }
        navigate({ to: "/dashboard", search: { trial: "started" } as any });
      } else {
        toast.success("Bitte bestätige deine E-Mail-Adresse, um zu starten.");
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registrierung fehlgeschlagen";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-2 lg:py-16">
        {/* Linke Seite: USP */}
        <div className="flex flex-col justify-center space-y-6">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3.5 w-3.5" /> Gratis testen
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
            7 Tage <span className="text-gold">BODYFUEL</span> – kostenlos & unverbindlich
          </h1>
          <p className="text-muted-foreground">
            Lerne die Plattform kennen, sammle erste Erfolge und entscheide nach 7 Tagen, ob du
            deine individuelle Mitgliedschaft aktivieren willst.
          </p>

          <ul className="space-y-3 text-sm">
            {[
              "Starter-Trainingsplan (A/B/C)",
              "Starter-Ernährungsplan – Trainingstag & Restday",
              "Gewicht-, Wasser-, Schritte- & Schlaftracking",
              "Punkte- und Ranking-System mit Fortschritts-Graphen",
              "Kein Abo, keine Kreditkarte – endet automatisch",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-border bg-card/60 p-4 text-xs text-muted-foreground">
            <p className="font-display text-sm font-bold text-foreground">
              🔒 Nicht im Test enthalten
            </p>
            <p className="mt-1">
              Individuelle Pläne, Coach Check-ins, WhatsApp-Support und Smart-Anpassungen werden erst
              nach Aktivierung deiner Mitgliedschaft freigeschaltet.
            </p>
          </div>
        </div>

        {/* Rechte Seite: Formular */}
        <div className="rounded-3xl border border-gold/30 bg-gradient-to-b from-gold/10 to-transparent p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-2 text-gold">
            <Flame className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">7 Tage gratis</span>
          </div>
          <h2 className="font-display text-2xl font-bold">Kostenlos starten</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Erstelle dein Konto in unter einer Minute.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9"
                  placeholder="Max Mustermann"
                  autoComplete="name"
                />
              </div>
            </div>
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
                  placeholder="du@beispiel.de"
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
                  placeholder="Mind. 8 Zeichen"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full bg-gradient-gold text-base font-bold text-primary-foreground"
            >
              {busy ? "Wird erstellt…" : "🔥 7 Tage kostenlos testen"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Bereits Mitglied?{" "}
              <Link to="/auth" className="font-semibold text-gold hover:underline">
                Hier einloggen
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
