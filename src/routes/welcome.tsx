import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Willkommen — BODYFUEL" }] }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  // Einladungs-/Reset-Links kommen in verschiedenen Formaten an. Wenn eine
  // Session besteht (oder hergestellt werden kann), geht es direkt in die App —
  // niemand muss hier ein Passwort setzen.
  useEffect(() => {
    let active = true;

    const run = async () => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const get = (k: string) => url.searchParams.get(k) ?? hash.get(k);

      try {
        const accessToken = get("access_token");
        const refreshToken = get("refresh_token");
        const code = get("code");
        const tokenHash = get("token_hash");
        const type = get("type");

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (tokenHash) {
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as "invite" | "recovery" | "signup" | "magiclink") ?? "invite",
          });
        }
        window.history.replaceState({}, "", window.location.pathname);
      } catch {
        /* Link abgelaufen — ggf. besteht trotzdem schon eine Session */
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        navigate({ to: "/app", replace: true });
        return;
      }
      navigate({ to: "/auth", replace: true });
      setChecking(false);
    };

    void run();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-gold/30 bg-card p-8 text-center shadow-gold">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold">
          <Flame className="h-5 w-5 text-primary-foreground" />
        </div>
        <h2 className="mt-6 font-display text-2xl font-bold">Willkommen bei BodyFuel</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {checking ? "Du wirst angemeldet…" : "Weiterleitung…"}
        </p>
      </div>
    </div>
  );
}
