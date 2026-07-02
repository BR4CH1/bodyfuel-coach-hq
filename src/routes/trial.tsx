import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Flame,
  Lock,
  Mail,
  User,
  Check,
  Sparkles,
  Dumbbell,
  Salad,
  ShoppingCart,
  LineChart,
} from "lucide-react";
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
      { title: "BodyFuel Smart — 7 Tage gratis testen" },
      {
        name: "description",
        content:
          "Teste BodyFuel Smart 7 Tage gratis: automatischer Ernährungs- und Trainingsplan, Einkaufsliste, Tracking und Fortschritt. Ohne Zahlungsdaten.",
      },
      { property: "og:title", content: "BodyFuel Smart – 7 Tage gratis testen" },
      {
        property: "og:description",
        content:
          "Training & Ernährung digital planen. 7 Tage gratis, ohne Zahlungsdaten. Danach optional für 14,99 €/Monat weiterführen.",
      },
      { property: "og:url", content: "https://bodyfuel-coaching.com/trial" },
    ],
    links: [{ rel: "canonical", href: "https://bodyfuel-coaching.com/trial" }],
  }),
  component: SmartTrialSignupPage,
});

const nameSchema = z.string().trim().min(2, "Bitte deinen Namen eingeben").max(80);
const emailSchema = z.string().trim().email("Ungültige E-Mail").max(255);
const pwSchema = z.string().min(8, "Mindestens 8 Zeichen").max(100);

function SmartTrialSignupPage() {
  const { supabaseUser } = useSession();
  const navigate = useNavigate();
  const startTrialFn = useServerFn(startMyTrial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Bereits eingeloggt? → Smart-Trial aktivieren und ins Onboarding schicken.
  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      try {
        await startTrialFn();
      } catch (err) {
        console.error("startMyTrial failed", err);
      }
      navigate({ to: "/onboarding/smart" });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUser]);

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
        typeof window !== "undefined" ? window.location.origin : "https://bodyfuel-coaching.com";
      if (typeof window !== "undefined") {
        localStorage.setItem("bodyfuel.trial.pending", "1");
      }
      const { data: signUp, error } = await supabase.auth.signUp({
        email: ev.data,
        password: pv.data,
        options: {
          emailRedirectTo: `${origin}/trial`,
          data: { display_name: nv.data, role: "client", tier: "smart" },
        },
      });
      if (error) throw error;

      if (signUp.session) {
        try {
          await startTrialFn();
          if (typeof window !== "undefined") {
            localStorage.removeItem("bodyfuel.trial.pending");
          }
        } catch (err) {
          console.error("startMyTrial failed", err);
        }
        toast.success("Dein 7-Tage-Test von BodyFuel Smart ist aktiviert!");
        if (typeof window !== "undefined") {
          sessionStorage.setItem("bodyfuel.trial.welcome", "1");
        }
        navigate({ to: "/onboarding/smart" });
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
            <Sparkles className="h-3.5 w-3.5" /> BodyFuel Smart · 7 Tage gratis
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
            <span className="text-gold">BodyFuel Smart</span> 7 Tage gratis testen
          </h1>
          <p className="text-lg font-medium text-foreground/90">
            Training & Ernährung digital planen.
          </p>
          <p className="text-muted-foreground">
            Voller Zugriff auf das komplette Smart-System — 7 Tage lang, ohne Zahlungsdaten.
            Danach entscheidest du frei, ob du für 14,99 €/Monat weitermachst.
          </p>

          <ul className="space-y-3 text-sm">
            {[
              { icon: Salad, t: "Automatischer Ernährungsplan (individuell, mit Rezepten)" },
              { icon: Dumbbell, t: "Automatischer Trainingsplan (auf Equipment & Tage abgestimmt)" },
              { icon: ShoppingCart, t: "Smarte Einkaufsliste — sortiert und in deinem Budget" },
              { icon: LineChart, t: "Tracking, Prognose, Ranking & Fortschritt" },
              { icon: Check, t: "Kein Abo, keine Kreditkarte — endet automatisch nach 7 Tagen" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-border bg-card/60 p-4 text-xs text-muted-foreground">
            <p className="font-display text-sm font-bold text-foreground">
              So läuft dein Test
            </p>
            <p className="mt-1">
              Account anlegen → kurzes Smart-Onboarding → dein persönlicher Plan steht.
              Nach 7 Tagen endet der Test automatisch; du wirst rechtzeitig informiert.
            </p>
          </div>
        </div>

        {/* Rechte Seite: Formular */}
        <div className="rounded-3xl border border-gold/30 bg-gradient-to-b from-gold/10 to-transparent p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-2 text-gold">
            <Flame className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Smart · 7 Tage gratis</span>
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
              {busy ? "Wird erstellt…" : "BodyFuel Smart 7 Tage gratis testen"}
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
