import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Utensils, Heart, ShoppingCart, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";
import { BullsHero } from "@/components/bodyfuel/BullsHero";
import { useSession } from "@/lib/bodyfuel/session";
import { useTrial } from "@/hooks/use-trial";
import { trackHubEvent } from "@/lib/bulls.functions";
import { getMySmartProfile } from "@/lib/smart-profile.functions";
import { MacroTargetsCard } from "@/components/bodyfuel/MacroTargetsCard";
import { BullsPlanContentView } from "@/components/bodyfuel/BullsPlanContentView";
import { WeekScheduleCard } from "@/components/bodyfuel/WeekScheduleCard";
import { PlateauWarning } from "@/components/bodyfuel/PlateauWarning";
import { DietPreferencesCard } from "@/components/bodyfuel/DietPreferencesCard";
import { MealWishesCard } from "@/components/bodyfuel/MealWishesCard";
import { CustomMealsCard } from "@/components/bodyfuel/CustomMealsCard";

export const Route = createFileRoute("/bulls/nutrition/")({
  head: () => ({ meta: [{ title: "Ernährung — Bulls Hub" }] }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <NutritionPage />
      </BullsGate>
    </AppLayout>
  ),
});

function NutritionPage() {
  const track = useServerFn(trackHubEvent);
  useEffect(() => {
    track({ data: { kind: "nutrition_plan_opened" } }).catch(() => {});
  }, [track]);

  const { supabaseUser } = useSession();
  const { isTrial, isExpired } = useTrial();

  const getProfile = useServerFn(getMySmartProfile);
  const { data: profile } = useQuery({
    queryKey: ["smart-profile-me"],
    queryFn: () => getProfile(),
    enabled: !!supabaseUser?.id,
  });
  const needsOnboarding = profile !== undefined && !profile?.completed_at;
  const needsTrainingDays = !!profile?.completed_at && !(profile?.training_weekdays?.length);

  return (
    <div className="space-y-5">
      <Link
        to="/bulls"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red"
      >
        <ArrowLeft className="h-3 w-3" /> Zurück zum Hub
      </Link>

      <BullsHero
        eyebrow="Ernährung"
        title="Dein Ernährungsplan"
        subtitle="Vollständiger Tagesplan, Tracker & One-Click-Tracking — im Bulls-Look."
      />

      {needsOnboarding && (
        <Link
          to="/onboarding/smart-nutrition"
          className="flex items-center justify-between gap-3 rounded-2xl border border-gold bg-gradient-to-br from-gold/20 to-card p-4 transition hover:from-gold/30"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Ernährung einrichten</div>
              <div className="text-xs text-muted-foreground">
                60 Sek. — danach passt sich dein Plan an deine Vorlieben an
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gold" />
        </Link>
      )}
      {needsTrainingDays && (
        <Link
          to="/onboarding/smart-nutrition"
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/60 bg-gradient-to-br from-amber-500/15 to-card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/20 text-amber-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Trainingstage festlegen</div>
              <div className="text-xs text-muted-foreground">
                Damit dein Plan zwischen Trainings- und Restdays unterscheiden kann
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-amber-500" />
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          to="/bulls/nutrition/tracking"
          className="flex items-center gap-3 rounded-2xl border border-gold/50 bg-gradient-to-br from-accent/40 to-card p-4 transition hover:border-gold"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-gold text-primary-foreground">
            <Utensils className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold">Tracker</div>
            <div className="truncate text-xs text-muted-foreground">Kalorien & Makros</div>
          </div>
        </Link>
        <Link
          to="/bulls/nutrition/favorites"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 text-rose-500">
            <Heart className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold">Favoriten</div>
            <div className="truncate text-xs text-muted-foreground">Rezepte & Bewertungen</div>
          </div>
        </Link>
        <Link
          to="/bulls/nutrition/shopping"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold">Einkaufsliste</div>
            <div className="truncate text-xs text-muted-foreground">Aus deinem Plan</div>
          </div>
        </Link>
      </div>

      {supabaseUser?.id && <WeekScheduleCard userId={supabaseUser.id} variant="bulls" />}
      <MacroTargetsCard userId={supabaseUser?.id} variant="bulls" />
      {supabaseUser?.id && <PlateauWarning userId={supabaseUser.id} />}
      {supabaseUser?.id && profile?.completed_at && <DietPreferencesCard />}
      {supabaseUser?.id && <MealWishesCard userId={supabaseUser.id} mode="client" />}
      {supabaseUser?.id && <CustomMealsCard userId={supabaseUser.id} />}

      {/* Bulls Performance: Engine ist Source of Truth — kein Trial-Plan,
          keine planbasierte Zielaggregation. */}
      {supabaseUser?.id && <BullsPlanContentView />}
    </div>
  );
}
