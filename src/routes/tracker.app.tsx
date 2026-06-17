import { createFileRoute, Outlet } from "@tanstack/react-router";
import { FreeAppLayout } from "@/components/bodyfuel/FreeAppLayout";

export const Route = createFileRoute("/tracker/app")({
  head: () => ({ meta: [{ title: "BodyFuel Tracker" }] }),
  component: () => (
    <FreeAppLayout>
      <Outlet />
    </FreeAppLayout>
  ),
});
