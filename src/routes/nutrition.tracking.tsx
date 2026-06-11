import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { NutritionTracker } from "@/components/bodyfuel/NutritionTracker";

export const Route = createFileRoute("/nutrition/tracking")({
  head: () => ({ meta: [{ title: "Essen tracken — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ernährung</p>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">Essen tracken</h1>
          </div>
          <Link to="/nutrition" className="text-xs text-muted-foreground hover:text-gold">
            ← Zum Plan
          </Link>
        </div>
        <NutritionTracker />
      </div>
    </AppLayout>
  ),
});
