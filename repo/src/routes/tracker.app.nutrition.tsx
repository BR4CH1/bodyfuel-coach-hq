import { createFileRoute } from "@tanstack/react-router";
import { NutritionTracker } from "@/components/bodyfuel/NutritionTracker";
import { CoachingLockTeaser } from "@/components/bodyfuel/CoachingLockTeaser";

export const Route = createFileRoute("/tracker/app/nutrition")({
  head: () => ({ meta: [{ title: "Ernährung — BodyFuel Tracker" }] }),
  component: () => (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Tracker</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Essen tracken</h1>
      </div>
      <NutritionTracker />
      <CoachingLockTeaser
        features={[
          "Persönlicher Ernährungsplan",
          "Rezepte auf dich abgestimmt",
          "Automatische Einkaufsliste",
          "Mahlzeiten-Tausch",
        ]}
      />
    </div>
  ),
});
