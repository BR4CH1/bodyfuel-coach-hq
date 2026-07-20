import { createFileRoute, redirect } from "@tanstack/react-router";

// Dauerhafter Alias für Visitenkarten/QR-Codes:
// https://bodyfuel-coaching.com/smart/trial  →  /trial (7-Tage-Gratis-Test)
export const Route = createFileRoute("/smart/trial")({
  beforeLoad: () => {
    throw redirect({ to: "/trial" });
  },
});
