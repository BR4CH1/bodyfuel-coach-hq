import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { getCoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";
import { AthleteDetailHeader } from "@/components/coach/athlete/AthleteDetailHeader";
import { AthleteQuickActions } from "@/components/coach/athlete/AthleteQuickActions";
import { AthleteOverviewTab } from "@/components/coach/athlete/AthleteOverviewTab";
import { AthleteTasksTab } from "@/components/coach/athlete/AthleteTasksTab";
import { AthleteCheckinsTab } from "@/components/coach/athlete/AthleteCheckinsTab";
import { AthletePerformanceTab } from "@/components/coach/athlete/AthletePerformanceTab";
import { AthleteTrainingTab } from "@/components/coach/athlete/AthleteTrainingTab";
import { AthleteNutritionTab } from "@/components/coach/athlete/AthleteNutritionTab";
import { CoachPlayerCardView } from "@/components/player-cards/CoachPlayerCardView";

const BASE_TABS = [
  { key: "overview", label: "Übersicht" },
  { key: "tasks", label: "Aufgaben" },
  { key: "checkins", label: "Check-ins" },
  { key: "performance", label: "Performance" },
  { key: "training", label: "Training" },
  { key: "nutrition", label: "Ernährung" },
] as const;
const PLAYER_CARD_TAB = { key: "player-card", label: "Spielerkarte" } as const;
type TabDef = { key: string; label: string };

type TabKey = (typeof TABS)[number]["key"];

const searchSchema = z.object({
  tab: fallback(z.string(), "overview").default("overview"),
  focus: fallback(z.string().optional(), undefined).optional(),
});

export const Route = createFileRoute("/coach/teams/$orgId/athletes/$userId")({
  head: () => ({ meta: [{ title: "Spielerprofil — Bulls Hub" }] }),
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
    return <div className="p-4 text-sm text-muted-foreground">Spielerprofil wird geladen…</div>;
  }
  if (!data) {
    return (
      <div className="p-4">
        <BackLink orgId={orgId} />
        <div className="mt-4 rounded-lg border border-[#252525] bg-[#0b0b0b] p-4 text-sm text-muted-foreground">
          Spieler nicht gefunden oder kein Zugriff.
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
    <div className="bulls-theme bg-[#050505] -mx-4 -my-3 min-h-full">
      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-24 pt-4">
        <BackLink orgId={orgId} />
        <AthleteDetailHeader data={data} />
        <AthleteQuickActions
          orgId={orgId}
          userId={userId}
          athleteName={data.athlete.display_name}
        />

        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex min-w-max gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                  tab === t.key
                    ? "border-bulls-red bg-bulls-red text-white shadow-bulls"
                    : "border-[#252525] bg-[#0b0b0b] text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "overview" && (
          <AthleteOverviewTab data={data} orgId={orgId} userId={userId} />
        )}
        {tab === "tasks" && <AthleteTasksTab data={data} orgId={orgId} userId={userId} />}
        {tab === "checkins" && <AthleteCheckinsTab data={data} orgId={orgId} userId={userId} focus={search.focus} />}
        {tab === "performance" && (
          <AthletePerformanceTab data={data} orgId={orgId} userId={userId} />
        )}
        {tab === "training" && <AthleteTrainingTab data={data} orgId={orgId} userId={userId} />}
        {tab === "nutrition" && (
          <AthleteNutritionTab data={data} orgId={orgId} userId={userId} />
        )}
        {tab === "player-card" && (
          <CoachPlayerCardView
            userId={userId}
            jerseyNumber={data.athlete.jersey_number != null ? String(data.athlete.jersey_number) : null}
            teamLabel={data.athlete.team_name ?? null}
          />
        )}
      </div>
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
