import { createFileRoute, Link } from "@tanstack/react-router";
import { Utensils, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { PlansView } from "@/components/bodyfuel/PlansView";
import { MacroTargetsCard } from "@/components/bodyfuel/MacroTargetsCard";
import { useSession } from "@/lib/bodyfuel/session";

export const Route = createFileRoute("/nutrition/")({
  head: () => ({ meta: [{ title: "Ernährungsplan — BODYFUEL" }] }),
  component: NutritionIndex,
});

function NutritionIndex() {
  const { isCoach, supabaseUser } = useSession();
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
            <MacroTargetsCard userId={supabaseUser?.id} />
          </>
        )}
        <PlansView planType="nutrition" />
      </div>
    </AppLayout>
  );
}
