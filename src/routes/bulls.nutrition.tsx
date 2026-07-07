import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/bulls/nutrition")({
  head: () => ({ meta: [{ title: "Ernährung — Bulls Hub" }] }),
  component: () => <Outlet />,
});