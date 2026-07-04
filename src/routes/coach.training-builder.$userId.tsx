import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { TrainingPlanBuilderPage } from "@/components/bodyfuel/TrainingPlanBuilderPage";
import { createFileRoute, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/coach/training-builder/$userId")({
  head: () => ({ meta: [{ title: "Trainingsplan manuell erstellen — BODYFUEL" }] }),
  component: CoachTrainingBuilderRoute,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">
      Trainings-Builder Fehler: {(error as any)?.message ?? String(error)}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Seite nicht gefunden.</div>
  ),
});

function CoachTrainingBuilderRoute() {
  const { userId } = useParams({ from: "/coach/training-builder/$userId" });
  return (
    <AppLayout>
      <TrainingPlanBuilderPage userId={userId} />
    </AppLayout>
  );
}
