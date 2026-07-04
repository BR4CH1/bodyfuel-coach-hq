import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { TrainingPlanBuilderPage } from "@/components/bodyfuel/TrainingPlanBuilderPage";
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";

type Search = { planId?: string };

export const Route = createFileRoute("/coach/training-builder/$userId")({
  head: () => ({ meta: [{ title: "Trainingsplan manuell erstellen — BODYFUEL" }] }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    planId: typeof search.planId === "string" ? search.planId : undefined,
  }),
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
  const { planId } = useSearch({ from: "/coach/training-builder/$userId" });
  return (
    <AppLayout>
      <TrainingPlanBuilderPage userId={userId} planId={planId} />
    </AppLayout>
  );
}
