import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Utensils, ChevronRight } from "lucide-react";
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
  const [clients, setClients] = useState<{ id: string; display_name: string | null }[]>([]);

  useEffect(() => {
    if (!isCoach || !supabaseUser) return;
    supabase
      .from("profiles")
      .select("id, display_name")
      .order("display_name")
      .then(({ data }) => {
        const opts = (data as { id: string; display_name: string | null }[]) ?? [];
        setClients(opts);
        if (opts.length && !coachClientId) setCoachClientId(opts[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCoach, supabaseUser]);

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
            <MacroTargetsCard userId={supabaseUser?.id} />
          </>
        )}
        {isCoach && <PlansView planType="nutrition" />}
        {isCoach && clients.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Inhalte ansehen für</label>
            <select
              value={coachClientId}
              onChange={(e) => setCoachClientId(e.target.value)}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name ?? c.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>
        )}
        {viewClientId && <PlanContentView clientId={viewClientId} planType="nutrition" />}
      </div>
    </AppLayout>
  );
}
