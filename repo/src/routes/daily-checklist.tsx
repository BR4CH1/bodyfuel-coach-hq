import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { DailyChecklist } from "@/components/bodyfuel/DailyChecklist";
import { useSession } from "@/lib/bodyfuel/session";

export const Route = createFileRoute("/daily-checklist")({
  head: () => ({ meta: [{ title: "Tagescheckliste — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <DailyChecklistPage />
    </AppLayout>
  ),
});

function DailyChecklistPage() {
  const { supabaseUser } = useSession();

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Zurück zum Dashboard
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
          Tagescheckliste
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hake deine täglichen Ziele ab und sammle Punkte für dein Level.
        </p>
      </div>

      {supabaseUser ? (
        <DailyChecklist userId={supabaseUser.id} />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Bitte melde dich an, um deine Tagescheckliste zu sehen.
        </div>
      )}
    </div>
  );
}
