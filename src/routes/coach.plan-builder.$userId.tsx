import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { PlanBuilderPage } from "@/components/bodyfuel/PlanBuilderPage";
import { createFileRoute, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/coach/plan-builder/$userId")({
  head: () => ({ meta: [{ title: "Plan manuell erstellen — BODYFUEL" }] }),
  component: CoachPlanBuilderRoute,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">
      Plan-Builder Fehler: {(error as any)?.message ?? String(error)}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Seite nicht gefunden.</div>
  ),
});

function CoachPlanBuilderRoute() {
  const { userId } = useParams({ from: "/coach/plan-builder/$userId" });
  return (
    <AppLayout>
      <PlanBuilderPage userId={userId} />
    </AppLayout>
  );
}