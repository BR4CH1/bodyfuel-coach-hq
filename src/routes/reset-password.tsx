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

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Neues Passwort — BODYFUEL" },
      { name: "description", content: "Neues BODYFUEL-Passwort festlegen und wieder anmelden." },
      { property: "og:title", content: "Neues Passwort — BODYFUEL" },
      {
        property: "og:description",
        content: "Neues BODYFUEL-Passwort festlegen und wieder anmelden.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const resolveAccess = useServerFn(resolveMyAccess);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (typeof window === "undefined") return;
      const link = parseAuthLink(window.location.href);

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
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: link.tokenHash,
            type: link.type === "invite" ? "invite" : "recovery",
          });
          if (verifyError) throw verifyError;
        }
      } catch (linkError: unknown) {
        const message =
          linkError instanceof Error
            ? linkError.message
            : "Der Link konnte nicht geöffnet werden.";
        const { data } = await supabase.auth.getUser();
        if (!data.user && active) {
          setError(
            /expired|invalid/i.test(message)
              ? "Der Link ist ungültig oder abgelaufen. Bitte fordere eine neue Reset-Mail an."
              : message,
          );
          setChecking(false);
          return;
        }
      }

      const { data } = await supabase.auth.getUser();
      if (!active) return;
      window.history.replaceState({}, "", window.location.pathname);

      if (data.user) {
        setReady(true);
      } else {
        setError(
          "Der Link ist ungültig oder abgelaufen. Bitte fordere eine neue Reset-Mail an.",
        );
      }
      setChecking(false);
    };

    void run();
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
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
      await supabase.auth.refreshSession();
      toast.success("Passwort gespeichert. Du bist angemeldet.");

      let target = "/app";
      try {
        const access = await resolveAccess();
        target = access.homeRoute;
      } catch {
        target = "/app";
      }
      window.location.replace(new URL(target, window.location.origin).href);
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
        <h1 className="mt-6 text-center font-display text-2xl font-bold">Neues Passwort</h1>

        {checking ? (
          <p className="mt-2 text-center text-sm text-muted-foreground">Link wird geprüft…</p>
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
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <p className="text-center text-sm text-muted-foreground">
              Lege jetzt dein neues Passwort fest. Danach bist du direkt angemeldet.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reset-password">Neues Passwort</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  className="pl-9"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-password-confirm">Passwort bestätigen</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  className="pl-9"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              {saving ? "Wird gespeichert…" : "Passwort speichern"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
