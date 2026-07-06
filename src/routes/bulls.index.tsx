import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bulls/")({
  head: () => ({ meta: [{ title: "Coesfeld Bulls — BODYFUEL" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/$orgSlug/home", params: { orgSlug: "bulls" }, replace: true });
  },
  component: () => null,
});
