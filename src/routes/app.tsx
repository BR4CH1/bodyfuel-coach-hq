import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Flame } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { resolveMyAccess } from "@/lib/access/user-access.functions";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "App — BODYFUEL" },
      { name: "description", content: "Öffnet deinen persönlichen BODYFUEL-Bereich." },
      { property: "og:title", content: "App — BODYFUEL" },
      { property: "og:description", content: "Öffnet deinen persönlichen BODYFUEL-Bereich." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppEntryPage,
});

function AppEntryPage() {
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const resolveAccess = useServerFn(resolveMyAccess);

  useEffect(() => {
    if (loading) return;

    if (!supabaseUser) {
      navigate({ to: "/auth", search: { next: undefined }, replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const access = await resolveAccess();
        if (!cancelled) {
          window.location.replace(new URL(access.homeRoute, window.location.origin).href);
        }
      } catch {
        if (!cancelled) navigate({ to: "/auth", search: { next: undefined }, replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabaseUser, loading, navigate, resolveAccess]);

  return (
    <div className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
          <Flame className="h-5 w-5" />
        </span>
        App wird geöffnet…
      </div>
    </div>
  );
}
