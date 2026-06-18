import { createFileRoute } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";
import { CoachingLockTeaser } from "@/components/bodyfuel/CoachingLockTeaser";

export const Route = createFileRoute("/tracker/app/training")({
  head: () => ({ meta: [{ title: "Training — BodyFuel Tracker" }] }),
  component: TrainingFreePage,
});

function TrainingFreePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Tracker</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Training</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <Dumbbell className="h-10 w-10 text-primary" />
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Dein Trainingsbereich
            </p>
            <p className="font-display text-xl font-bold">
              Persönlicher Trainingsplan
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ein auf dich zugeschnittener Plan, Übungsdemos, Satz- und
              Gewichts-Tracking sowie Fortschritts-Analyse sind im Coaching enthalten.
            </p>
          </div>
        </div>
      </div>

      <CoachingLockTeaser
        title="Mit Coaching freischalten"
        features={[
          "Individueller Trainingsplan",
          "Übungs-Bibliothek mit Demos",
          "Satz- & Gewichts-Tracking",
          "Stärken-Check & Fortschritt",
        ]}
      />
    </div>
  );
}
