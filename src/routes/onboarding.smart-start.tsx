import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  ListChecks,
  ShoppingBasket,
  Sparkles,
  Target,
  Utensils,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/bodyfuel/Logo";
import { SmartLockCard } from "@/components/bodyfuel/SmartGate";
import { useSession } from "@/lib/bodyfuel/session";
import { useEntitlement } from "@/hooks/use-entitlement";
import { getOnboardingStatus } from "@/lib/smart-onboarding.functions";

export const Route = createFileRoute("/onboarding/smart-start")({
  head: () => ({
    meta: [
      { title: "Smart Start — BODYFUEL" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SmartStartPage,
});

type TutorialStep = {
  eyebrow: string;
  title: string;
  text: string;
  icon: typeof Sparkles;
  points: Array<{ icon: typeof Sparkles; title: string; text: string }>;
};

const STEPS: TutorialStep[] = [
  {
    eyebrow: "Willkommen bei Smart",
    title: "Dein System statt irgendein Standardplan.",
    text: "Du gibst BodyFuel einmal die wichtigsten Informationen über dich. Smart baut daraus Ernährung und Training passend zu deinem Alltag.",
    icon: Sparkles,
    points: [
      { icon: Target, title: "Dein Ziel", text: "Abnehmen, Muskelaufbau, Performance oder Recomposition." },
      { icon: Activity, title: "Dein Alltag", text: "Körperdaten, Trainingstage, Zeit und Rahmenbedingungen fließen direkt ein." },
    ],
  },
  {
    eyebrow: "Schritt 1 · Dein Setup",
    title: "Smart muss wissen, wie du wirklich trainierst.",
    text: "Im Onboarding hinterlegst du deine Ausgangslage und die Bedingungen, unter denen dein Plan funktionieren muss.",
    icon: Dumbbell,
    points: [
      { icon: ListChecks, title: "Körper & Ziel", text: "Größe, Gewicht, Zielgewicht und persönliches Trainingsziel." },
      { icon: Dumbbell, title: "Training", text: "Erfahrung, Trainingsort, Equipment, Trainingstage und verfügbare Zeit." },
    ],
  },
  {
    eyebrow: "Schritt 2 · Smart Nutrition",
    title: "Der Ernährungsplan soll zu dir passen – nicht umgekehrt.",
    text: "Deine Angaben steuern, welche Gerichte Smart auswählt, wie alltagstauglich der Plan wird und wie deine Einkaufsliste vorbereitet wird.",
    icon: Utensils,
    points: [
      { icon: Utensils, title: "Was du wirklich isst", text: "Favoriten, No-Gos, Ernährungsform, Allergien und Unverträglichkeiten." },
      { icon: ShoppingBasket, title: "Wie du deinen Alltag organisierst", text: "Meal Prep, Einkaufstage, Budget und gewünschte Abwechslung." },
    ],
  },
  {
    eyebrow: "Schritt 3 · Plan-Erstellung",
    title: "Ein Klick startet deinen Autopilot.",
    text: "Am Ende des Onboardings tippst du auf „Autopilot starten“. Danach erstellt Smart deine Pläne im Hintergrund – du musst nichts manuell zusammenbauen.",
    icon: WandSparkles,
    points: [
      { icon: Utensils, title: "Zuerst Ernährung", text: "Smart erstellt deinen persönlichen Ernährungsplan auf Basis deiner Angaben und Ziele." },
      { icon: Dumbbell, title: "Danach Training", text: "Anschließend entsteht dein Trainingsplan passend zu Tagen, Equipment und Erfahrung." },
    ],
  },
  {
    eyebrow: "Danach · Dein Alltag",
    title: "Plan bekommen ist der Start – Tracking macht Smart wertvoll.",
    text: "Im Dashboard siehst du, wenn deine Pläne gebaut werden. Danach nutzt du BodyFuel täglich für Ernährung, Training und Fortschritt.",
    icon: CheckCircle2,
    points: [
      { icon: Activity, title: "Tracken & verstehen", text: "Mahlzeiten, Training und Fortschritt landen an einem Ort." },
      { icon: Sparkles, title: "Smart weiter nutzen", text: "Deine Smart-Nutrition-Angaben kannst du später jederzeit anpassen." },
    ],
  },
];

function SmartStartPage() {
  const navigate = useNavigate();
  const { supabaseUser, loading } = useSession();
  const { hasSmart, loading: entitlementLoading } = useEntitlement();
  const statusFn = useServerFn(getOnboardingStatus);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading && !supabaseUser) {
      navigate({ to: "/auth", search: { next: undefined }, replace: true });
    }
  }, [loading, supabaseUser, navigate]);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["smart-onboarding-status"],
    queryFn: () => statusFn(),
    enabled: !!supabaseUser && hasSmart,
    staleTime: 30_000,
  });

  if (!entitlementLoading && supabaseUser && !hasSmart) {
    return (
      <div className="mx-auto max-w-md p-6">
        <SmartLockCard title="Smart Tutorial" />
      </div>
    );
  }

  if (loading || entitlementLoading || (hasSmart && statusLoading)) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Sparkles className="h-5 w-5 animate-pulse text-gold" /> Smart wird vorbereitet…
        </div>
      </div>
    );
  }

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const completed = !!status?.completed;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Logo />
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Smart Start
          </div>
        </div>

        <div className="mb-5 flex gap-1.5" aria-label={`Schritt ${step + 1} von ${STEPS.length}`}>
          {STEPS.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-gold" : "bg-secondary"}`}
            />
          ))}
        </div>

        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-gradient-to-br from-gold/15 via-transparent to-transparent p-6 sm:p-8">
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
              <Icon className="h-7 w-7" />
            </div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{current.eyebrow}</div>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">{current.title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{current.text}</p>
          </div>

          <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
            {current.points.map((point) => {
              const PointIcon = point.icon;
              return (
                <div key={point.title} className="rounded-2xl border border-border bg-background/50 p-4">
                  <PointIcon className="h-5 w-5 text-gold" />
                  <div className="mt-3 font-display text-base font-bold">{point.title}</div>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{point.text}</p>
                </div>
              );
            })}
          </div>

          {isLast && (
            <div className="mx-6 mb-2 rounded-2xl border border-gold/25 bg-gold/5 p-4 sm:mx-8">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                <div>
                  <div className="font-semibold">{completed ? "Dein Smart-Onboarding ist bereits abgeschlossen." : "Bereit? Im nächsten Schritt wird es persönlich."}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {completed
                      ? "Du kannst das Tutorial jederzeit erneut ansehen und deine Smart-Nutrition-Einstellungen separat anpassen."
                      : "Das eigentliche Onboarding speichert deine Angaben und startet danach automatisch die Erstellung deiner beiden Pläne."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 p-6 sm:p-8">
            <Button
              variant="ghost"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Zurück
            </Button>

            {!isLast ? (
              <Button onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}>
                Weiter <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : completed ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => navigate({ to: "/onboarding/smart-nutrition" })}>
                  Smart Nutrition anpassen
                </Button>
                <Button onClick={() => navigate({ to: "/dashboard" })}>Zum Dashboard</Button>
              </div>
            ) : (
              <Button onClick={() => navigate({ to: "/onboarding/smart" })}>
                Smart Onboarding starten <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Schritt {step + 1} von {STEPS.length} · Deine Angaben werden erst im anschließenden Onboarding gespeichert.
        </p>
      </div>
    </main>
  );
}
