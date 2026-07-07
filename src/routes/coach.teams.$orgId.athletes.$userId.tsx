import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ArrowLeft, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { deleteOrgAthlete } from "@/lib/organizations/athlete-admin.functions";
import { getCoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";
import { AthleteDetailHeader } from "@/components/coach/athlete/AthleteDetailHeader";
import { AthleteQuickActions } from "@/components/coach/athlete/AthleteQuickActions";
import { AthleteOverviewTab } from "@/components/coach/athlete/AthleteOverviewTab";
import { AthleteTasksTab } from "@/components/coach/athlete/AthleteTasksTab";
import { AthleteCheckinsTab } from "@/components/coach/athlete/AthleteCheckinsTab";
import { AthletePerformanceTab } from "@/components/coach/athlete/AthletePerformanceTab";
import { AthleteTrainingTab } from "@/components/coach/athlete/AthleteTrainingTab";
import { AthleteNutritionTab } from "@/components/coach/athlete/AthleteNutritionTab";

const TABS = [
  { key: "overview", label: "Übersicht" },
  { key: "tasks", label: "Aufgaben" },
  { key: "checkins", label: "Check-ins" },
  { key: "performance", label: "Performance" },
  { key: "training", label: "Training" },
  { key: "nutrition", label: "Ernährung" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const searchSchema = z.object({
  tab: fallback(z.string(), "overview").default("overview"),
});

export const Route = createFileRoute("/coach/teams/$orgId/athletes/$userId")({
  head: () => ({ meta: [{ title: "Athletenprofil — BODYFUEL Coach" }] }),
  validateSearch: zodValidator(searchSchema),
  component: () => (
    <AppLayout>
      <AthleteProfile />
    </AppLayout>
  ),
});

function AthleteProfile() {
  const { orgId, userId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const tab: TabKey = (TABS.find((t) => t.key === search.tab)?.key ?? "overview") as TabKey;

  const fetch = useServerFn(getCoachAthleteDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["coach-athlete-detail", orgId, userId],
    queryFn: () => fetch({ data: { orgId, userId } }),
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Athletenprofil wird geladen…</div>;
  }
  if (!data) {
    return (
      <div className="p-4">
        <BackLink orgId={orgId} />
        <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Athlet nicht gefunden oder kein Zugriff.
        </div>
      </div>
    );
  }

  const setTab = (key: TabKey) =>
    navigate({
      to: "/coach/teams/$orgId/athletes/$userId",
      params: { orgId, userId },
      search: { tab: key },
      replace: true,
    });

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-24 pt-3">
      <BackLink orgId={orgId} />
      <AthleteDetailHeader data={data} />
      <AthleteQuickActions />

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${
                tab === t.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <AthleteOverviewTab data={data} />}
      {tab === "tasks" && <AthleteTasksTab data={data} />}
      {tab === "checkins" && <AthleteCheckinsTab data={data} />}
      {tab === "performance" && <AthletePerformanceTab data={data} orgId={orgId} />}
      {tab === "training" && <AthleteTrainingTab data={data} orgId={orgId} userId={userId} />}
      {tab === "nutrition" && <AthleteNutritionTab data={data} orgId={orgId} userId={userId} />}

      <DangerZone orgId={orgId} userId={userId} displayName={data.athlete.display_name} />
    </div>
  );
}

function BackLink({ orgId }: { orgId: string }) {
  return (
    <Link
      to="/coach/teams/$orgId"
      params={{ orgId }}
      className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Zurück zum Team
    </Link>
  );
}

function DangerZone({
  orgId,
  userId,
  displayName,
}: {
  orgId: string;
  userId: string;
  displayName: string;
}) {
  const navigate = useNavigate();
  const del = useServerFn(deleteOrgAthlete);
  const [busy, setBusy] = useState(false);
  return (
    <section className="mt-8 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-destructive">
        <Trash2 className="h-4 w-4" />
        Gefahrenzone
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Löscht {displayName} vollständig aus der Plattform: Profil, Zugang, alle Trainings-,
        Ernährungs- und Vereinsdaten. Diese Aktion kann nicht rückgängig gemacht werden.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          const input = window.prompt(
            `Profil von ${displayName} unwiderruflich löschen?\n\nZum Bestätigen tippe LÖSCHEN ein:`,
          );
          if (input !== "LÖSCHEN") return;
          setBusy(true);
          try {
            await del({ data: { org_id: orgId, user_id: userId } });
            toast.success("Profil gelöscht.");
            navigate({ to: "/coach/teams/$orgId", params: { orgId } });
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-destructive bg-destructive px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-destructive-foreground hover:opacity-90 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {busy ? "Lösche…" : "Profil vollständig löschen"}
      </button>
    </section>
  );
}
