import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Flame } from "lucide-react";
import { LandingPageV2 } from "@/components/bodyfuel/LandingPageV2";
import { useSession } from "@/lib/bodyfuel/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BODYFUEL — Ernährung, Training & Fortschritt in einem System" },
      {
        name: "description",
        content:
          "BodyFuel verbindet Ernährungsplanung, Training, Tracking und Motivation in einer App. Smart 7 Tage kostenlos testen oder persönliche 1:1-Begleitung im Coaching nutzen.",
      },
      { property: "og:title", content: "BODYFUEL — Dein Ziel. Ein System. Jeden Tag." },
      {
        property: "og:description",
        content:
          "Ernährung, Training und Fortschritt in einer App — mit BodyFuel Smart oder persönlichem Coaching.",
      },
    ],
  }),
  component: LandingRoute,
});

function LandingRoute() {
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (supabaseUser) {
      navigate({ to: "/app", replace: true });
    }
  }, [supabaseUser, loading, navigate]);

  if (loading || supabaseUser) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
            <Flame className="h-5 w-5" />
          </span>
          Lädt…
        </div>
      </div>
    );
  }

  return <LandingPageV2 />;
}
