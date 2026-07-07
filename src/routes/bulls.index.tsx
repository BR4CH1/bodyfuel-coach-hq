import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bulls/")({
  head: () => ({ meta: [{ title: "Coesfeld Bulls — BODYFUEL" }] }),
  beforeLoad: () => {
    // Smart-Router: /$orgSlug entscheidet je nach Rolle (Athlet vs. Staff/Leitung),
    // wohin es weiter geht. Athleten landen im Athletenbereich, Vereinsleitung/Staff
    // im Coach-Cockpit. Direktes /$orgSlug/home würde Staff auf Athleten-UI zwingen.
    throw redirect({ to: "/$orgSlug", params: { orgSlug: "bulls" }, replace: true });
  },
  component: () => null,
});
