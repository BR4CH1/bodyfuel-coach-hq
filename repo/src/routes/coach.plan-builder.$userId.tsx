import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { PlanBuilderPage } from "@/components/bodyfuel/PlanBuilderPage";
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";

type Search = { planId?: string; orgId?: string };

export const Route = createFileRoute("/coach/plan-builder/$userId")({
  head: () => ({ meta: [{ title: "Plan manuell erstellen — BODYFUEL" }] }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    planId: typeof search.planId === "string" ? search.planId : undefined,
    orgId: typeof search.orgId === "string" ? search.orgId : undefined,
  }),
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
  const { planId, orgId } = useSearch({ from: "/coach/plan-builder/$userId" });
  return (
    <AppLayout>
      <PlanBuilderPage userId={userId} planId={planId} returnOrgId={orgId} />
    </AppLayout>
  );
}
