import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sparkles, Dumbbell, Salad, LineChart, ArrowRight } from "lucide-react";
import { useEntitlements } from "@/lib/bodyfuel/entitlements";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/mein-bodyfuel")({
  head: () => ({
    meta: [
      { title: "Mein BodyFuel freischalten — BODYFUEL" },
      {
        name: "description",
        content:
          "Training, Ernährung und Fortschritt persönlich steuern — mit BodyFuel Smart oder Coaching.",
      },
    ],
  }),
  component: MeinBodyFuelPage,
});

function MeinBodyFuelPage() {
  const ent = useEntitlements();
  const hasPersonal = ent.hasAnyPersonalBodyfuel;
  const isTeamOnly = !ent.loading && ent.hasTeamAccess && !hasPersonal && !ent.isPlatformCoach;
  const navigate = useNavigate();

  useEffect(() => {
    if (isTeamOnly && ent.primaryOrgSlug) {
      navigate({ to: "/$orgSlug", params: { orgSlug: ent.primaryOrgSlug }, replace: true });
    }
  }, [isTeamOnly, ent.primaryOrgSlug, navigate]);

  if (isTeamOnly) return null;



  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Mein BodyFuel
            </div>
            <h1 className="font-display text-2xl font-bold">
              {hasPersonal ? "Dein persönlicher Bereich" : "Mein BodyFuel freischalten"}
            </h1>
          </div>
        </div>

        {hasPersonal ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Dein persönlicher BodyFuel-Bereich ist aktiv.
            </p>
            <div className="grid gap-2">
              <Link
                to="/dashboard"
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-gold/60"
              >
                <span className="text-sm font-semibold">Zum persönlichen Dashboard</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link
                to="/training"
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-gold/60"
              >
                <span className="text-sm font-semibold">Mein Trainingsplan</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link
                to="/nutrition"
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-gold/60"
              >
                <span className="text-sm font-semibold">Meine Ernährung</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              Training, Ernährung und Fortschritt persönlich steuern. Zusätzlich zu deinem
              Vereinsbereich.
            </p>

            <div className="grid gap-3">
              <FeatureCard
                icon={<Dumbbell className="h-4 w-4" />}
                title="Persönlicher Trainingsplan"
                text="Auf dich zugeschnittener Plan — unabhängig vom Vereinstraining."
              />
              <FeatureCard
                icon={<Salad className="h-4 w-4" />}
                title="Ernährungsplan & Tracker"
                text="Makros, Rezepte und Einkaufsliste automatisch generiert."
              />
              <FeatureCard
                icon={<LineChart className="h-4 w-4" />}
                title="Fortschritt & Check-ins"
                text="Gewichtsentwicklung, Foto-Check und persönliche Auswertungen."
              />
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button asChild size="lg" className="w-full">
                <a href="https://bodyfuel-coaching.com/#pakete" target="_blank" rel="noreferrer">
                  Pakete ansehen
                </a>
              </Button>
              {ent.primaryOrgSlug && (
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link to="/$orgSlug" params={{ orgSlug: ent.primaryOrgSlug }}>
                    Zurück zum Vereinsbereich
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-gold/10 text-gold">
          {icon}
        </span>
        <div className="font-semibold">{title}</div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
