import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { CoachOrgDetail } from "./coach.teams.$orgId";

export const Route = createFileRoute("/coach/teams/$orgId/")({
  head: () => ({ meta: [{ title: "Organisation — BODYFUEL Coach" }] }),
  component: () => (
    <AppLayout>
      <CoachOrgDetail />
    </AppLayout>
  ),
});