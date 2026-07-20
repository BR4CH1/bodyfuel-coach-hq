import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { CoachDashboardPage } from "@/features/coach-dashboard/components/CoachDashboardPage";

export const Route = createFileRoute("/coach/")({
  head: () => ({ meta: [{ title: "Coach Dashboard — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <CoachDashboardPage />
    </AppLayout>
  ),
});
