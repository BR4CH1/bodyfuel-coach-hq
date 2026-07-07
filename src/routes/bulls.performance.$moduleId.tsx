import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/bulls/performance/$moduleId")({
  head: () => ({ meta: [{ title: "Modul — Bulls Performance" }] }),
  component: () => <Outlet />,
});
