import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { BullsGate } from "@/components/bodyfuel/BullsGate";

export const Route = createFileRoute("/bulls/performance")({
  head: () => ({ meta: [{ title: "Performance Check — Bulls Hub" }] }),
  component: () => (
    <AppLayout>
      <BullsGate>
        <Outlet />
      </BullsGate>
    </AppLayout>
  ),
});

export function BullsPerformanceBackLink() {
  return (
    <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red">
      ← Zurück zum Hub
    </Link>
  );
}
