import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Lock, Mail, User } from "lucide-react";
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
const nameSchema = z
  .string()
  .trim()
  .min(2, "Mindestens 2 Zeichen")
  .max(60, "Maximal 60 Zeichen")
  .regex(/^[\p{L}][\p{L}\s'\-]*$/u, "Nur Buchstaben, Bindestrich, Leerzeichen");

function AuthPage() {
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  // Beitrittslinks (next=/join/...) starten direkt im Registrieren-Modus.
  const [mode, setMode] = useState<"signin" | "signup">(
    next && next.startsWith("/join/") ? "signup" : "signin",
  );

  useEffect(() => {
    if (loading) return;
    if (!supabaseUser) return;
    if (next) {
      navigate({ to: next as any, replace: true } as any);
      return;
    }
    navigate({ to: "/app", replace: true });
  }, [supabaseUser, loading, navigate, next]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const rawEmail = (fd.get("email") ?? email ?? "").toString();
    const rawPw = (fd.get("password") ?? password ?? "").toString();
    const normalizedEmail = rawEmail.trim().toLowerCase();
    const normalizedPw = rawPw;

    const ev = emailSchema.safeParse(normalizedEmail);
    const pv = pwSchema.safeParse(normalizedPw);
    if (!ev.success) return toast.error(ev.error.issues[0].message);
    if (!pv.success) return toast.error(pv.error.issues[0].message);

    let firstParsed = "";
    let lastParsed = "";
    if (mode === "signup") {
      const fv = nameSchema.safeParse((fd.get("first_name") ?? firstName ?? "").toString());
      const lv = nameSchema.safeParse((fd.get("last_name") ?? lastName ?? "").toString());
      if (!fv.success) return toast.error(`Vorname: ${fv.error.issues[0].message}`);
      if (!lv.success) return toast.error(`Nachname: ${lv.error.issues[0].message}`);
      firstParsed = fv.data;
      lastParsed = lv.data;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const emailRedirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}${next ?? "/app"}`
            : undefined;
        const displayName = `${firstParsed} ${lastParsed}`.replace(/\s+/g, " ").trim();
        const { data, error } = await supabase.auth.signUp({
          email: ev.data,
          password: pv.data,
          options: {
            emailRedirectTo,
            data: {
              display_name: displayName,
              first_name: firstParsed,
              last_name: lastParsed,
            },
          },
        });
        if (error) throw error;
        // Falls die Session direkt gesetzt wird, Profil-Namen sofort schreiben.
        if (data.session && data.user) {
          await supabase
            .from("profiles")
            .update({ display_name: displayName })
            .eq("id", data.user.id);
        }
        if (!data.session) {
          toast.success("Account erstellt. Bitte bestätige deine E-Mail, um fortzufahren.");
        } else {
          toast.success("Account erstellt!");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: ev.data,
          password: pv.data,
        });
        if (error) throw error;
        toast.success("Willkommen zurück!");
        // Defensiv: direkt weiter navigieren, ohne einen vollen Reload auszulösen.
        const target = next ?? "/app";
        navigate({ to: target as any, replace: true } as any);
        return;
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Fehler";
      const msg = /invalid login credentials/i.test(raw)
        ? "E-Mail oder Passwort falsch. Tipp: E-Mail bitte neu eintippen (Autofill kann fehlerhaft sein)."
        : /already registered|user already/i.test(raw)
        ? "Diese E-Mail ist bereits registriert. Bitte einloggen."
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

        <h2 className="font-display text-2xl font-bold">
          {mode === "signup" ? "Account erstellen" : "Willkommen zurück"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signup"
            ? "Erstelle deinen kostenlosen BODYFUEL-Account, um deinem Team beizutreten."
            : "Melde dich mit deinen Zugangsdaten an."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first_name">Vorname</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="first_name"
                    name="first_name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="pl-9"
                    required
                    autoComplete="given-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nachname</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
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
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />

            </div>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            {busy ? "..." : mode === "signup" ? "Registrieren" : "Einloggen"}
          </Button>
        </form>

        <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
          <div>
            {mode === "signup" ? "Schon einen Account?" : "Noch keinen Account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="text-gold hover:underline"
            >
              {mode === "signup" ? "Einloggen" : "Jetzt registrieren"}
            </button>
          </div>
          {mode === "signin" && (
            <div>
              oder{" "}
              <Link to="/login" className="text-gold hover:underline">
                Demo-Login ohne Account
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

