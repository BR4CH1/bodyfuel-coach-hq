import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Flame, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseAuthLink } from "@/lib/auth-flow.logic";
import { resolveMyAccess } from "@/lib/access/user-access.functions";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Einladung annehmen — BODYFUEL" },
      { name: "description", content: "BODYFUEL-Einladung annehmen und Passwort festlegen." },
      { property: "og:title", content: "Einladung annehmen — BODYFUEL" },
      {
        property: "og:description",
        content: "BODYFUEL-Einladung annehmen und Passwort festlegen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const resolveAccess = useServerFn(resolveMyAccess);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Einzige Redirect-Quelle dieser Route: Zielroute kommt ausschliesslich
   * DB-basiert aus resolveMyAccess (keine last-route/localStorage-Heuristik).
   * Ein interner next-Parameter wird nur verwendet, wenn er die Sanitizer-
   * Pruefung in parseAuthLink bestanden hat.
   */
  const goHome = async (preferredNext?: string) => {
    let target = preferredNext;
    if (!target) {
      try {
        const access = await resolveAccess();
        target = access.homeRoute;
      } catch {
        target = "/app";
      }
    }
    window.location.replace(new URL(target, window.location.origin).href);
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (typeof window === "undefined") return;
      const link = parseAuthLink(window.location.href);
      let redemptionFailed = false;

      try {
        if (link.error) throw new Error(link.error.replace(/\+/g, " "));

        if (link.accessToken && link.refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: link.accessToken,
            refresh_token: link.refreshToken,
          });
          if (sessionError) throw sessionError;
        } else if (link.code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(link.code);
          if (exchangeError) throw exchangeError;
        } else if (link.tokenHash) {
          const supportedTypes = ["invite", "recovery", "signup", "magiclink"] as const;
          const otpType = supportedTypes.find((value) => value === link.type) ?? "invite";
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: link.tokenHash,
            type: otpType,
          });
          if (verifyError) throw verifyError;
        }
      } catch (linkError: unknown) {
        redemptionFailed = true;
        const message =
          linkError instanceof Error
            ? linkError.message
            : "Einladung konnte nicht geöffnet werden.";
        const { data } = await supabase.auth.getUser();
        if (!data.user && active) {
          setError(message);
          setChecking(false);
          return;
        }
      }

      const { data, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      window.history.replaceState({}, "", window.location.pathname);

      if (redemptionFailed && data.user) {
        await goHome();
        return;
      }

      if (data.user && link.mode === "confirm") {
        await goHome(link.next);
        return;
      }

      if (data.user && !link.hasCredentials) {
        await goHome(link.next);
        return;
      }

      if (data.user && link.hasCredentials) {
        setReady(true);
      } else {
        setError(
          userError?.message ||
            "Der Einladungslink ist ungültig oder abgelaufen. Bitte fordere eine neue Einladung an.",
        );
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
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      const { data: verified, error: verifyError } = await supabase.auth.getUser();
      if (verifyError || !verified.user) {
        throw verifyError ?? new Error("Die Sitzung konnte nicht bestätigt werden.");
      }

      window.history.replaceState({}, "", "/app");
      await goHome();
    } catch (updateError: unknown) {
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : "Passwort konnte nicht gespeichert werden.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-gold/30 bg-card p-8 shadow-gold">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold">
          <Flame className="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 className="mt-6 text-center font-display text-2xl font-bold">
          Willkommen bei BODYFUEL
        </h1>

        {checking ? (
          <p className="mt-2 text-center text-sm text-muted-foreground">Einladung wird geprüft…</p>
        ) : error && !ready ? (
          <div className="mt-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              className="mt-6"
              variant="outline"
              onClick={() => navigate({ to: "/auth", search: { next: undefined } })}
            >
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
            <Button
              type="submit"
              className="w-full bg-gradient-gold text-primary-foreground"
              disabled={saving}
            >
              {saving ? "Wird gespeichert…" : "Passwort festlegen & starten"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
