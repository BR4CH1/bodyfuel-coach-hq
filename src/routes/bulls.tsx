import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";

export const Route = createFileRoute("/bulls")({
  head: () => ({ meta: [{ title: "Bulls Hub — BODYFUEL" }] }),
  component: BullsRootPage,
});

function BullsRootPage() {
  return (
    <AppLayout>
      <BullsGate>
        <Navigate to="/bulls/checkin" replace />
      </BullsGate>
    </AppLayout>
  );
}
