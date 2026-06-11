import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { PlansView } from "@/components/bodyfuel/PlansView";

export const Route = createFileRoute("/nutrition/")({
  head: () => ({ meta: [{ title: "Ernährungsplan — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <PlansView planType="nutrition" />
    </AppLayout>
  ),
});
