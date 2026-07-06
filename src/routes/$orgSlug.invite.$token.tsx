import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Flame, Lock, Mail, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import {
  acceptOrganizationInvite,
  getInvitePreview,
} from "@/lib/organizations/organizations.functions";
import { roleLabelFromDbRole, scopeLabel } from "@/lib/organizations/staff-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Preview =
  | { ok: true; email: string | null; role: string; status: string;
      organization: { name: string; slug: string; logo_url: string | null };
      team_name: string | null }
  | { ok: false; reason: string };

export const Route = createFileRoute("/$orgSlug/invite/$token")({
  component: InviteAccept,
});

function InviteAccept() {
  const { orgSlug, token } = Route.useParams();
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const accept = useServerFn(acceptOrganizationInvite);
  const preview = useServerFn(getInvitePreview);

  const [info, setInfo] = useState<Preview | null>(null);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load invite preview once
  useEffect(() => {
    preview({ data: { token } })
      .then((res) => {
        setInfo(res as Preview);
        if (res.ok && res.email) setEmail(res.email);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Einladung konnte nicht geladen werden.");
        setInfo({ ok: false, reason: "error" });
      });
  }, [preview, token]);

  // Auto-accept once authenticated — nur wenn die eingeloggte E-Mail zur
  // Einladung passt, sonst würde der aktuell eingeloggte Coach die
  // Einladung versehentlich konsumieren.
  useEffect(() => {
    if (loading || !supabaseUser || accepting) return;
    if (!info || info.ok === false) return;
    if (info.status !== "pending") return;
    const inviteEmail = info.email?.trim().toLowerCase();
    const userEmail = supabaseUser.email?.trim().toLowerCase();
    if (inviteEmail && userEmail && inviteEmail !== userEmail) {
      setError(
        `Diese Einladung ist für ${info.email} ausgestellt. Du bist als ${supabaseUser.email} eingeloggt.`,
      );
      return;
    }
    setAccepting(true);
    accept({ data: { token } })
      .then((res) => {
        toast.success("Zugang aktiviert.");
        navigate({
          to: "/$orgSlug",
          params: { orgSlug: res.slug ?? orgSlug },
          replace: true,
        });
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Einladung ungültig.");
        setAccepting(false);
      });
  }, [supabaseUser, loading, accept, token, orgSlug, navigate, accepting, info]);

  const signOutAndReload = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!info || !info.ok) return;
    const normEmail = email.trim().toLowerCase();
    const inviteEmail = info.email?.trim().toLowerCase();
    if (inviteEmail && normEmail !== inviteEmail) {
      toast.error("Bitte die eingeladene E-Mail-Adresse verwenden.");
      return;
    }
    if (password.length < 8) {
      toast.error("Passwort mit mindestens 8 Zeichen wählen.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error: err } = await supabase.auth.signUp({
          email: normEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/${orgSlug}/invite/${token}` },
        });
        if (err) throw err;
        if (!signUpData.session) {
          toast.info(
            "Account erstellt. Bitte prüfe dein E-Mail Postfach und bestätige den Link, um fortzufahren.",
          );
        } else {
          toast.success("Account erstellt.");
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: normEmail,
          password,
        });
        if (err) throw err;
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Anmeldung fehlgeschlagen";
      if (/already registered|user already/i.test(raw)) {
        toast.error("Für diese E-Mail existiert bereits ein Account. Bitte einloggen.");
        setMode("signin");
      } else {
        toast.error(raw);
      }
    } finally {
      setBusy(false);
    }
  };

  // --- Rendering states ---
  if (!info || loading) {
    return <Centered>Einladung wird geladen…</Centered>;
  }
  if (!info.ok) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-semibold">Einladung ungültig</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "Diese Einladung existiert nicht mehr."}
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/auth">Zum Login</Link>
        </Button>
      </Centered>
    );
  }
  if (info.status !== "pending") {
    return (
      <Centered>
        <h1 className="font-display text-xl font-semibold">
          {info.status === "accepted"
            ? "Einladung bereits angenommen"
            : info.status === "expired"
              ? "Einladung abgelaufen"
              : "Einladung nicht mehr gültig"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bitte die Vereinsleitung um eine neue Einladung.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/auth">Zum Login</Link>
        </Button>
      </Centered>
    );
  }

  if (supabaseUser) {
    return <Centered>Zugang wird aktiviert…</Centered>;
  }

  const roleLabel = roleLabelFromDbRole(info.role);
  const scope = scopeLabel(info.team_name);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-gold/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-gold sm:p-10">
        <div className="mb-6 flex items-center gap-3">
          {info.organization.logo_url ? (
            <img
              src={info.organization.logo_url}
              alt=""
              className="h-11 w-11 rounded-xl object-cover"
            />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold">
              <Flame className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
          )}
          <div>
            <div className="font-display text-lg font-bold tracking-wider">
              {info.organization.name || "BODYFUEL"}
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Staff Einladung
            </div>
          </div>
        </div>

        <h2 className="font-display text-2xl font-bold">
          Willkommen im Trainerteam
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Du wurdest eingeladen als Teil des Staff bei{" "}
          <span className="text-foreground">{info.organization.name}</span>.
          Erstelle dein Konto, um Zugriff zu erhalten.
        </p>

        <div className="mt-4 space-y-2 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold" />
            <span className="text-muted-foreground">Funktion:</span>
            <span className="font-medium">{roleLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" />
            <span className="text-muted-foreground">Zuständigkeit:</span>
            <span className="font-medium">{scope}</span>
          </div>
        </div>

        <div className="mt-6 flex gap-2 rounded-xl bg-muted p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg py-2 font-medium transition ${
              mode === "signup" ? "bg-card text-foreground shadow" : "text-muted-foreground"
            }`}
          >
            Konto erstellen
          </button>
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-lg py-2 font-medium transition ${
              mode === "signin" ? "bg-card text-foreground shadow" : "text-muted-foreground"
            }`}
          >
            Bereits Account
          </button>
        </div>

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
                readOnly={!!info.email}
                autoComplete="email"
              />
            </div>
            {info.email && (
              <p className="text-xs text-muted-foreground">
                Die Einladung ist an diese Adresse gebunden.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {mode === "signup" ? "Passwort wählen" : "Passwort"}
            </Label>
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
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                Mindestens 8 Zeichen.
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            {busy
              ? "..."
              : mode === "signup"
                ? "Konto erstellen & annehmen"
                : "Einloggen & annehmen"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Nach der Anmeldung wirst du direkt zu deinem Bereich weitergeleitet.
        </p>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
      <div className="max-w-sm text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
