import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/bodyfuel/AppLayout";

export const Route = createFileRoute("/coach-tools")({
  head: () => ({ meta: [{ title: "Coach Tools — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
