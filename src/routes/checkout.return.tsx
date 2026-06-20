import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id:
      typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Willkommen bei BodyFuel Smart" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <CheckCircle2 className="h-16 w-16 text-emerald-500" />
      <div>
        <h1 className="font-display text-3xl font-bold">Willkommen an Bord!</h1>
        <p className="mt-2 text-muted-foreground">
          Dein BodyFuel Smart Abo ist aktiv. Dein Autopilot startet jetzt mit
          Trainings- und Ernährungsplan.
        </p>
      </div>
      <Link
        to="/onboarding/smart"
        className="rounded-lg bg-gradient-gold px-6 py-3 font-semibold text-primary-foreground"
      >
        Jetzt Onboarding starten
      </Link>
      {session_id && (
        <p className="text-xs text-muted-foreground">Beleg: {session_id}</p>
      )}
    </div>
  );
}
