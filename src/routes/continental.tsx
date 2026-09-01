import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/continental")({
  beforeLoad: () => {
    throw redirect({ to: "/continental-challenge" });
  },
});
