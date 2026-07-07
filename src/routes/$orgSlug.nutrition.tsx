import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Utensils, Heart, ShoppingCart, Carrot, Sparkles } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { useTrial } from "@/hooks/use-trial";
import { getMySmartProfile } from "@/lib/smart-profile.functions";
import { getOrgHomeData } from "@/lib/organizations/athlete.functions";
import { OrgAthleteLayout } from "@/components/organizations/OrgAthleteLayout";
import { MacroTargetsCard } from "@/components/bodyfuel/MacroTargetsCard";
import { PlanContentView } from "@/components/bodyfuel/PlanContentView";
import { WeekScheduleCard } from "@/components/bodyfuel/WeekScheduleCard";
import { PlateauWarning } from "@/components/bodyfuel/PlateauWarning";
import { DietPreferencesCard } from "@/components/bodyfuel/DietPreferencesCard";
import { MealWishesCard } from "@/components/bodyfuel/MealWishesCard";
import { CustomMealsCard } from "@/components/bodyfuel/CustomMealsCard";
import { TrialNutritionPlan } from "@/components/bodyfuel/TrialPlanView";
import { Route as OrgLayoutRoute } from "./$orgSlug";

export const Route = createFileRoute("/$orgSlug/nutrition")({
  head: () => ({ meta: [{ title: "Ernährung — BODYFUEL" }] }),
  component: OrgNutrition,
});

function OrgNutrition() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser } = useSession();
  const { isTrial, isExpired } = useTrial();

  const fetchHome = useServerFn(getOrgHomeData);
  const { data: home } = useQuery({
    queryKey: ["org-home", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchHome({ data: { slug: org.slug } }),
  });

  const getProfile = useServerFn(getMySmartProfile);
  const { data: profile } = useQuery({
    queryKey: ["smart-profile-me"],
    queryFn: () => getProfile(),
    enabled: !!supabaseUser?.id,
  });
  const needsOnboarding = profile !== undefined && !profile?.completed_at;
  const needsTrainingDays =
    !!profile?.completed_at && !(profile?.training_weekdays?.length);

  const primary = org.primary_color ?? "#e11d48";

  return (
    <OrgAthleteLayout slug={org.slug} features={(home?.features as any) ?? []} primaryColor={primary}>
      <header
        className="px-5 py-6 text-white"
        style={{ background: `linear-gradient(135deg, ${org.primary_color ?? "#000"} 0%, #000 100%)` }}
      >
        <Link
          to="/$orgSlug/home"
          params={{ orgSlug: org.slug }}
          className="mb-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80"
        >
          <ChevronLeft className="h-3 w-3" /> Home
        </Link>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">{org.name}</div>
        <h1 className="font-display text-2xl font-bold">Ernährung</h1>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-4 py-5">
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
                <div className="text-sm font-bold">Smart Nutrition aktivieren ✨</div>
                <div className="text-xs text-muted-foreground">
                  60 Sek. — danach passt sich dein Plan automatisch an deine Vorlieben an
                </div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gold" />
          </Link>
        )}
        {needsTrainingDays && (
          <Link
            to="/onboarding/smart-nutrition"
            className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/60 bg-gradient-to-br from-amber-500/15 to-card p-4 transition hover:border-amber-500"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/20 text-amber-500">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold">Trainingstage festlegen 💪</div>
                <div className="text-xs text-muted-foreground">
                  Damit dein Plan zwischen Trainings- und Restdays unterscheiden kann
                </div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-amber-500" />
          </Link>
        )}

        <Link
          to="/$orgSlug/nutrition/tracking"
          params={{ orgSlug: org.slug }}
          className="flex items-center justify-between gap-3 rounded-2xl border border-gold/50 bg-gradient-to-br from-accent/40 to-card p-4 transition hover:border-gold"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold text-primary-foreground">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Essen tracken</div>
              <div className="text-xs text-muted-foreground">
                Kalorien, Makros & Wasser — mit Barcode-Scanner
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gold" />
        </Link>

        <Link
          to="/$orgSlug/nutrition/favorites"
          params={{ orgSlug: org.slug }}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-rose-500/50"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-rose-500/15 text-rose-500">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Meine Favoriten</div>
              <div className="text-xs text-muted-foreground">Gespeicherte Rezepte & Bewertungen</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        <Link
          to="/$orgSlug/nutrition/shopping"
          params={{ orgSlug: org.slug }}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-gold/50"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/15 text-gold">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Einkaufsliste</div>
              <div className="text-xs text-muted-foreground">Automatisch aus deinem Plan erstellt</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        <Link
          to="/nutrition/recipe-from-ingredients"
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-emerald-500/50"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <Carrot className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Rezept aus Zutaten</div>
              <div className="text-xs text-muted-foreground">
                Sag was du hast — wir bauen dir ein Rezept
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        {supabaseUser?.id && profile?.completed_at && <WeekScheduleCard userId={supabaseUser.id} />}
        <MacroTargetsCard userId={supabaseUser?.id} />
        {supabaseUser?.id && <PlateauWarning userId={supabaseUser.id} />}
        {supabaseUser?.id && profile?.completed_at && <DietPreferencesCard />}
        {supabaseUser?.id && <MealWishesCard userId={supabaseUser.id} mode="client" />}
        {supabaseUser?.id && <CustomMealsCard userId={supabaseUser.id} />}

        {isTrial || isExpired ? (
          <TrialNutritionPlan />
        ) : (
          supabaseUser?.id && <PlanContentView clientId={supabaseUser.id} planType="nutrition" />
        )}
      </main>
    </OrgAthleteLayout>
  );
}
