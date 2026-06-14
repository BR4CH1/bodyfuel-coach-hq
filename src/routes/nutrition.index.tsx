import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Utensils, ChevronRight, Heart, ShoppingCart, Carrot } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { PlansView } from "@/components/bodyfuel/PlansView";
import { MacroTargetsCard } from "@/components/bodyfuel/MacroTargetsCard";
import { PlanContentView } from "@/components/bodyfuel/PlanContentView";
import { useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";
import { useTrial } from "@/hooks/use-trial";
import { TrialNutritionPlan } from "@/components/bodyfuel/TrialPlanView";

export const Route = createFileRoute("/nutrition/")({
  head: () => ({ meta: [{ title: "Ernährungsplan — BODYFUEL" }] }),
  component: NutritionIndex,
});

function NutritionIndex() {
  const { isCoach, supabaseUser } = useSession();
  const { isTrial, isExpired } = useTrial();
  const [coachClientId, setCoachClientId] = useState<string>("");

  const viewClientId = isCoach ? coachClientId : supabaseUser?.id ?? "";

  return (
    <AppLayout>
      <div className="space-y-5">
        {!isCoach && (
          <>
            <Link
              to="/nutrition/tracking"
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
              to="/nutrition/favorites"
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-rose-500/50"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-rose-500/15 text-rose-500">
                  <Heart className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">Meine Favoriten</div>
                  <div className="text-xs text-muted-foreground">
                    Gespeicherte Rezepte & Bewertungen
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Link
              to="/nutrition/shopping"
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-gold/50"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/15 text-gold">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">Einkaufsliste</div>
                  <div className="text-xs text-muted-foreground">
                    KI generiert aus deinem Plan
                  </div>
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
                    Sag was du hast — KI baut ein Rezept
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
            <MacroTargetsCard userId={supabaseUser?.id} />
          </>
        )}
        {isCoach && <PlansView planType="nutrition" onClientChange={setCoachClientId} />}
        {!isCoach && (isTrial || isExpired) ? (
          <TrialNutritionPlan />
        ) : (
          viewClientId && <PlanContentView clientId={viewClientId} planType="nutrition" />
        )}
      </div>
    </AppLayout>
  );
}
