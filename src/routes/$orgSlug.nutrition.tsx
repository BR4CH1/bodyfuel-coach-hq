import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/$orgSlug/nutrition")({
  head: () => ({ meta: [{ title: "Ernährung — BODYFUEL" }] }),
  component: () => <Outlet />,
});