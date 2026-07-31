import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Flame, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Einladung annehmen — BODYFUEL" },
      { name: "description", content: "BODYFUEL-Einladung annehmen und Passwort festlegen." },
      { property: "og:title", content: "Einladung annehmen — BODYFUEL" },
      { property: "og:description", content: "BODYFUEL-Einladung annehmen und Passwort festlegen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite- und Recovery-Links may use PKCE query params or legacy hash tokens.
  // Redeem the link first, then deliberately keep the user on this public page
  // until a password has been chosen.
  useEffect(() => {
    let active = true;

    const run = async () => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const get = (k: string) => url.searchParams.get(k) ?? hash.get(k);
      const providerError = get("error_description") ?? get("error");
      const accessToken = get("access_token");
      const refreshToken = get("refresh_token");
      const code = get("code");
      const tokenHash = get("token_hash");
      const type = get("type");
      const hasInviteCredentials = Boolean(
        (accessToken && refreshToken) || code || tokenHash,
      );

      try {
        if (providerError) throw new Error(providerError.replace(/\+/g, " "));

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as "invite" | "recovery" | "signup" | "magiclink") ?? "invite",
          });
          if (verifyError) throw verifyError;
        }
      } catch (linkError: unknown) {
        const message = linkError instanceof Error ? linkError.message : "Einladung konnte nicht geöffnet werden.";
        const { data } = await supabase.auth.getSession();
        if (!data.session && active) setError(message);
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      window.history.replaceState({}, "", window.location.pathname);

      // /welcome is only the one-time invite landing page. Once its token has
      // already been consumed (for example after updateUser emits USER_UPDATED
      // or the customer reloads), an existing session must continue to the app
      // instead of showing the password form again.
      if (data.session && (!hasInviteCredentials || providerError)) {
        await navigate({ to: "/app", replace: true });
        return;
      }

      if (data.session && hasInviteCredentials) {
        setReady(true);
      } else {
        setError("Der Einladungslink ist ungültig oder abgelaufen. Bitte fordere eine neue Einladung an.");
      }
      setChecking(false);
    };

    void run();
    return () => {
      active = false;
    };
  }, [navigate]);

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Bitte wähle ein Passwort mit mindestens 8 Zeichen.");
      return;
    }
    if (password !== confirmation) {
      toast.error("Die Passwörter stimmen nicht überein.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      toast.error(updateError.message);
      setSaving(false);
      return;
    }
    toast.success("Passwort gespeichert. Willkommen bei BODYFUEL!");
    // A hard replace is intentional here: mobile mail browsers can otherwise
    // restore the consumed invite document during auth-state invalidation.
    window.location.replace("/app");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-gold/30 bg-card p-8 shadow-gold">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold">
          <Flame className="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 className="mt-6 text-center font-display text-2xl font-bold">Willkommen bei BODYFUEL</h1>

        {checking ? (
          <p className="mt-2 text-center text-sm text-muted-foreground">Einladung wird geprüft…</p>
        ) : error && !ready ? (
          <div className="mt-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button className="mt-6" variant="outline" onClick={() => navigate({ to: "/auth" })}>
              Zum Login
            </Button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submitPassword}>
            <p className="text-center text-sm text-muted-foreground">
              Lege jetzt dein persönliches Passwort fest. Danach wirst du direkt angemeldet.
            </p>
            <div className="space-y-2">
              <Label htmlFor="invite-password">Passwort</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="invite-password"
                  type="password"
                  autoComplete="new-password"
                  className="pl-9"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-password-confirmation">Passwort bestätigen</Label>
              <Input
                id="invite-password-confirmation"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-gradient-gold text-primary-foreground" disabled={saving}>
              {saving ? "Wird gespeichert…" : "Passwort festlegen & starten"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
