import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { getOrgCoachDetail } from "@/lib/organizations/athlete.functions";
import {
  runOrgTaskEngine,
  listOrgTasksForDay,
  createManualOrgTask,
  upsertTeamTrainingSchedule,
  getTeamTrainingSchedule,
  getOrgAthletesOnboardingAudit,
  listOrgStaffWithProfiles,
} from "@/lib/organizations/task-engine.functions";
import {
  listTeamPositionGroups,
  listTeamAthletesForAssign,
  getGroupTrainingSchedule,
  upsertGroupTrainingSchedule,
  getAthleteTrainingSchedule,
  upsertAthleteTrainingSchedule,
  getTeamNutritionSchedule,
  upsertTeamNutritionSchedule,
  getGroupNutritionSchedule,
  upsertGroupNutritionSchedule,
  getAthleteNutritionSchedule,
  upsertAthleteNutritionSchedule,
} from "@/lib/organizations/roster-schedule.functions";
import { TeamGroupAthletePicker, type PickerValue } from "@/components/organizations/TeamGroupAthletePicker";
import {
  listOrgChallenges,
  createOrgChallenge,
  listChallengeRules,
  upsertChallengeRule,
  awardChallengeBonus,
  listOrgCommunityPosts,
  createOrgCommunityPost,
  listOrgAthleticPlans,
  createOrgAthleticPlan,
  updateOrgAthleticPlanStatus,
  addOrgStaff,
  removeOrgStaff,
  updateOrgStaffPermissions,
  listOrgStaffInvites,
  revokeOrgStaffInvite,
  STAFF_PRESETS,
  ALL_PERMISSIONS,
} from "@/lib/organizations/operating-loop.functions";
import {
  PERMISSION_LABELS,
  PRESET_LABELS,
  permissionLabel,
  permissionDescription,
  roleLabelFromDbRole,
  scopeLabel,
  type PresetKey,
} from "@/lib/organizations/staff-labels";
import { CoachCockpit } from "@/components/coach/analytics/CoachCockpit";
import { AthletesTab } from "@/components/organizations/AthletesTab";

export const Route = createFileRoute("/coach/teams/$orgId")({
  head: () => ({ meta: [{ title: "Organisation — BODYFUEL Coach" }] }),
  component: () => (
    <AppLayout>
      <CoachOrgDetail />
    </AppLayout>
  ),
});

// Tab-Keys werden per URL-Hash (#cockpit, #athletes, ...) angesprochen und
// aus der Sidebar-Navigation in AppLayout gesteuert. Die frühere horizontale
// Tab-Leiste ist entfernt.


const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function CoachOrgDetail() {
  const { orgId } = Route.useParams();
  const routeHash = useRouterState({ select: (s) => s.location.hash });
  const fetch = useServerFn(getOrgCoachDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["coach-org-detail", orgId],
    queryFn: () => fetch({ data: { orgId } }),
  });
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "cockpit";
    const h = window.location.hash.replace("#", "");
    return h || "cockpit";
  });
  useEffect(() => {
    setTab((routeHash ?? "").replace(/^#/, "") || "cockpit");
  }, [routeHash]);
  const [athleteTeamFilter, setAthleteTeamFilter] = useState<string | null>(null);
  const selectTab = (next: string) => {
    setTab(next);
    if (typeof window !== "undefined") window.location.hash = next;
  };


  if (isLoading || !data || !data.org) {
    return <div className="text-sm text-muted-foreground">Lädt…</div>;
  }
  const org: any = data.org;
  const features = data.features as { feature: string; enabled: boolean }[];
  const featureOn = (k: string) => features.some((f) => f.feature === k && f.enabled);
  void featureOn;

  const caller = (data as any).caller as { experience: string; is_bodyfuel_coach: boolean; team_id: string | null } | undefined;
  const teamKpis = ((data as any).team_kpis ?? []) as Array<{ team_id: string; athletes: number; weekly_compliance: number | null; pending_onboardings: number }>;
  const experienceLabel =
    caller?.experience === "org_admin" ? "Vereinsleitung"
    : caller?.experience === "head_coach" ? "Head Coach"
    : caller?.experience === "team_coach" ? "Teamcoach"
    : caller?.experience === "staff" ? "Staff"
    : "Coach";
  const experienceHint =
    caller?.experience === "org_admin"
      ? "Vereinsweiter Zugriff auf Analytics, Teams, Athleten und Staff."
      : caller?.experience === "head_coach"
      ? "Vereinsweiter Analytics-Zugriff für den Head Coach."
      : caller?.experience === "team_coach"
      ? "Analytics deiner zugewiesenen Teams und Athleten."
      : caller?.experience === "staff"
      ? "Analytics innerhalb deiner Staff-Berechtigungen."
      : "BODYFUEL-Coach Analytics-Zugang.";


  return (
    <div>
      <div className="mb-4">
        <Link to="/coach/teams" className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
          ← Teams
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {org.logo_url ? (
          <img src={org.logo_url} alt={org.name} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div
            className="grid h-14 w-14 place-items-center rounded-full text-white text-sm font-bold"
            style={{ background: org.primary_color ?? "#333" }}
          >
            {org.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold">{org.name}</h1>
          <div className="flex gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>{org.organization_type}</span>
            <span>·</span>
            <span className="text-green-500">{org.status}</span>
          </div>
        </div>
      </div>

      {caller && (
        <div className="mt-4 rounded-lg border border-border bg-card/50 p-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
            <span
              className={
                caller.experience === "org_admin"
                  ? "rounded bg-amber-500/20 px-2 py-0.5 text-amber-500"
                  : caller.experience === "head_coach"
                  ? "rounded bg-blue-500/20 px-2 py-0.5 text-blue-500"
                  : "rounded bg-muted px-2 py-0.5 text-muted-foreground"
              }
            >
              {experienceLabel}
            </span>
            {caller.is_bodyfuel_coach && (
              <span className="rounded bg-primary/20 px-2 py-0.5 text-primary">BODYFUEL Coach</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{experienceHint}</p>
        </div>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Stat label="Athleten" value={data.athletes.length} />
        <Stat label="Staff" value={data.staff.length} />
        <Stat label="Teams" value={data.teams.length} />
        <Stat
          label="Weekly Compliance"
          value={data.weekly_compliance != null ? `${data.weekly_compliance}%` : "—"}
        />
      </section>



      <div className="mt-5">
        {tab === "cockpit" && <CoachCockpit orgId={orgId} />}
        {tab === "overview" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Aktuelle Challenge">
              {data.active_challenge ? (
                <div>
                  <div className="font-display text-lg font-bold">{(data.active_challenge as any).name}</div>
                  {(data.active_challenge as any).ends_at && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      bis {new Date((data.active_challenge as any).ends_at).toLocaleDateString("de-DE")}
                    </div>
                  )}
                </div>
              ) : (
                <Empty>Keine aktive Challenge. Historie ist derzeit leer — noch keine echten Challenge-Punkte im neuen Org-System.</Empty>
              )}
            </Card>
            <Card title="Offene Athlete Onboardings">
              <div className="font-display text-3xl font-bold">{data.pending_onboardings}</div>
              <div className="text-xs text-muted-foreground">Athleten mit unvollständigem Onboarding</div>
            </Card>
            <div className="md:col-span-2">
              <Card title="Letzte Aktivitäten">
                {data.activity.length === 0 ? (
                  <Empty>Noch keine Aktivitäten erfasst.</Empty>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {(data.activity as any[]).map((a) => (
                      <li key={a.id} className="flex justify-between border-b border-border py-1">
                        <span>{a.event_type}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("de-DE")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )}

        {tab === "athletes" && (
          <AthletesTab
            orgId={orgId}
            teamFilter={athleteTeamFilter}
            teams={data.teams as any[]}
            allowedUserIds={
              athleteTeamFilter
                ? new Set(
                    (data.athletes as any[])
                      .filter((a) => {
                        const teamName = (data.teams as any[]).find((t) => t.id === athleteTeamFilter)?.name;
                        return a.team_name === teamName;
                      })
                      .map((a) => a.user_id),
                  )
                : null
            }
            onClearFilter={() => setAthleteTeamFilter(null)}
          />
        )}

        {tab === "teams" && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(data.teams as any[]).map((t) => {
              const kpi = teamKpis.find((k) => k.team_id === t.id);
              return (
                <li key={t.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t.sport ?? "—"} {t.age_group ? `· ${t.age_group}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => { setAthleteTeamFilter(t.id); selectTab("athletes"); }}
                      className="rounded border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    >
                      Athleten →
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-muted/40 p-2">
                      <div className="font-display text-lg font-bold">{kpi?.athletes ?? 0}</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Athleten</div>
                    </div>
                    <div className="rounded bg-muted/40 p-2">
                      <div className="font-display text-lg font-bold">
                        {kpi?.weekly_compliance != null ? `${kpi.weekly_compliance}%` : "—"}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Compliance</div>
                    </div>
                    <div className="rounded bg-muted/40 p-2">
                      <div className="font-display text-lg font-bold">{kpi?.pending_onboardings ?? 0}</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Offen</div>
                    </div>
                  </div>
                </li>
              );
            })}
            {(data.teams as any[]).length === 0 && (
              <li className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Noch keine Teams angelegt.
              </li>
            )}
          </ul>
        )}

        {tab === "training" && <TrainingTab orgId={orgId} />}
        {tab === "tasks" && <TasksTab orgId={orgId} teams={data.teams as any[]} />}
        {tab === "challenges" && <ChallengesTab orgId={orgId} teams={data.teams as any[]} />}
        {tab === "ranking" && (
          <Empty>Ranking spiegelt Punkte aus aktiven Org-Challenges (Ledger `organization_challenge_point_events`). Ohne aktive Challenge leer.</Empty>
        )}
        {tab === "community" && <CommunityTab orgId={orgId} />}
        {tab === "staff" && <StaffTab orgId={orgId} teams={data.teams as any[]} />}

        {tab === "settings" && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {features.map((f) => (
              <li
                key={f.feature}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm"
              >
                <span className="capitalize">{f.feature.replace(/_/g, " ")}</span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                    f.enabled ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {f.enabled ? "aktiv" : "aus"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Inline AthletesTab wurde nach src/components/organizations/AthletesTab.tsx
// verschoben (inkl. „Athlet hinzufügen"-Flow und Pending-Kaderplätzen).



function TrainingTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const fetchSched = useServerFn(getTeamTrainingSchedule);
  const upsertTeam = useServerFn(upsertTeamTrainingSchedule);
  const fetchGroup = useServerFn(getGroupTrainingSchedule);
  const upsertGroup = useServerFn(upsertGroupTrainingSchedule);
  const fetchAthlete = useServerFn(getAthleteTrainingSchedule);
  const upsertAthlete = useServerFn(upsertAthleteTrainingSchedule);
  const engine = useServerFn(runOrgTaskEngine);

  const [msg, setMsg] = useState<string | null>(null);
  const [pick, setPick] = useState<PickerValue>({
    scope: "team",
    team_id: null,
    position_group: null,
    athlete_user_id: null,
    athlete_name: null,
  });

  const teamsQ = useQuery({
    queryKey: ["org-team-schedule", orgId],
    queryFn: () => fetchSched({ data: { organization_id: orgId } }),
  });
  useEffect(() => {
    if (!pick.team_id && teamsQ.data) {
      const firstTeamId = (teamsQ.data.teams as any[])[0]?.id;
      if (firstTeamId) setPick((p) => ({ ...p, team_id: firstTeamId }));
    }
  }, [teamsQ.data, pick.team_id]);

  // Schedule-Zeilen je nach Ebene
  const scheduleQ = useQuery({
    queryKey: [
      "training-schedule",
      pick.scope,
      pick.team_id,
      pick.position_group,
      pick.athlete_user_id,
    ],
    queryFn: async () => {
      if (pick.scope === "group") {
        if (!pick.team_id || !pick.position_group) return [];
        return fetchGroup({
          data: {
            organization_id: orgId,
            team_id: pick.team_id,
            position_group: pick.position_group,
          },
        });
      }
      if (pick.scope === "athlete") {
        if (!pick.athlete_user_id) return [];
        return fetchAthlete({
          data: { organization_id: orgId, user_id: pick.athlete_user_id },
        });
      }
      if (!pick.team_id) return [];
      return ((teamsQ.data?.schedules as any[]) || []).filter(
        (s) => s.team_id === pick.team_id,
      );
    },
    enabled: !!teamsQ.data,
  });

  const saveMut = useMutation({
    mutationFn: async (entries: any[]) => {
      if (pick.scope === "team") {
        if (!pick.team_id) throw new Error("Team wählen.");
        return upsertTeam({ data: { team_id: pick.team_id, entries } });
      }
      if (pick.scope === "group") {
        if (!pick.team_id || !pick.position_group)
          throw new Error("Team und Gruppe wählen.");
        return upsertGroup({
          data: {
            organization_id: orgId,
            team_id: pick.team_id,
            position_group: pick.position_group,
            entries,
          },
        });
      }
      if (!pick.athlete_user_id) throw new Error("Spieler wählen.");
      return upsertAthlete({
        data: {
          organization_id: orgId,
          user_id: pick.athlete_user_id,
          team_id: pick.team_id,
          entries,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-team-schedule", orgId] });
      qc.invalidateQueries({ queryKey: ["training-schedule"] });
      setMsg("Gespeichert.");
    },
    onError: (e: any) => setMsg(e?.message ?? "Fehler beim Speichern."),
  });
  const regenMut = useMutation({
    mutationFn: () => engine({ data: { organization_id: orgId, horizon_days: 14 } }),
    onSuccess: (r) => setMsg(`Task Engine: ${r.inserted}/${r.considered} neue Tasks erstellt.`),
  });

  if (teamsQ.isLoading || !teamsQ.data)
    return <div className="text-xs text-muted-foreground">Lädt…</div>;

  const entries = (scheduleQ.data as any[]) ?? [];
  const canEdit =
    (pick.scope === "team" && !!pick.team_id) ||
    (pick.scope === "group" && !!pick.team_id && !!pick.position_group) ||
    (pick.scope === "athlete" && !!pick.athlete_user_id);

  const cardTitle =
    pick.scope === "team"
      ? "Team Training Schedule (Wochenplan)"
      : pick.scope === "group"
      ? `Gruppen-Wochenplan · ${pick.position_group ?? ""}`
      : `Spieler-Wochenplan · ${pick.athlete_name ?? "Spieler wählen"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <TeamGroupAthletePicker
          orgId={orgId}
          teams={(teamsQ.data.teams as any[]) ?? []}
          value={pick}
          onChange={setPick}
        />
        <button
          onClick={() => regenMut.mutate()}
          disabled={regenMut.isPending}
          className="ml-auto rounded bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          title="Manueller Fallback. Die tägliche Synchronisierung läuft automatisch via pg_cron um 03:00 UTC."
        >
          {regenMut.isPending ? "Läuft…" : "Tasks jetzt synchronisieren"}
        </button>
      </div>
      {msg && <div className="text-xs text-green-500">{msg}</div>}

      <Card title={cardTitle}>
        {!canEdit ? (
          <Empty>
            {pick.scope === "group"
              ? "Positionsgruppe wählen, um den Wochenplan zu bearbeiten."
              : pick.scope === "athlete"
              ? "Spieler suchen und wählen, um einen individuellen Wochenplan anzulegen."
              : "Team wählen."}
          </Empty>
        ) : (
          <>
            <ScheduleEditor
              teamId={pick.team_id}
              entries={entries}
              onSave={(rows) => saveMut.mutate(rows)}
              saving={saveMut.isPending}
            />
            {pick.scope === "athlete" && pick.athlete_user_id && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/coach/training-builder/$userId"
                  params={{ userId: pick.athlete_user_id }}
                  className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-gold/20"
                >
                  Trainingsplan-Builder öffnen →
                </Link>
              </div>
            )}
            <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Änderungen synchronisieren sich beim nächsten Task-Engine-Lauf:{" "}
              <strong>zukünftige offene</strong> Tasks werden angepasst oder gelöscht.{" "}
              <strong>Abgeschlossene historische</strong> Tasks bleiben unverändert.
            </div>
          </>
        )}
      </Card>

      <NutritionScheduleCard orgId={orgId} teams={(teamsQ.data.teams as any[]) ?? []} />

      <Card title="Athletic Plans">
        <Empty>Athletic-Plan-Composer folgt. Plan-Sessions werden nach Anlage automatisch als Tasks erzeugt.</Empty>
      </Card>
    </div>
  );
}

function NutritionScheduleCard({ orgId, teams }: { orgId: string; teams: any[] }) {
  const qc = useQueryClient();
  const fetchTeam = useServerFn(getTeamNutritionSchedule);
  const upsertTeam = useServerFn(upsertTeamNutritionSchedule);
  const fetchGroup = useServerFn(getGroupNutritionSchedule);
  const upsertGroup = useServerFn(upsertGroupNutritionSchedule);
  const fetchAthlete = useServerFn(getAthleteNutritionSchedule);
  const upsertAthlete = useServerFn(upsertAthleteNutritionSchedule);

  const [pick, setPick] = useState<PickerValue>({
    scope: "team",
    team_id: teams[0]?.id ?? null,
    position_group: null,
    athlete_user_id: null,
    athlete_name: null,
  });
  const [msg, setMsg] = useState<string | null>(null);

  const schedQ = useQuery({
    queryKey: [
      "nutrition-schedule",
      pick.scope,
      pick.team_id,
      pick.position_group,
      pick.athlete_user_id,
    ],
    queryFn: async () => {
      if (pick.scope === "team") {
        if (!pick.team_id) return [];
        return fetchTeam({ data: { organization_id: orgId, team_id: pick.team_id } });
      }
      if (pick.scope === "group") {
        if (!pick.team_id || !pick.position_group) return [];
        return fetchGroup({
          data: {
            organization_id: orgId,
            team_id: pick.team_id,
            position_group: pick.position_group,
          },
        });
      }
      if (!pick.athlete_user_id) return [];
      return fetchAthlete({ data: { organization_id: orgId, user_id: pick.athlete_user_id } });
    },
  });

  const saveMut = useMutation({
    mutationFn: async (entries: any[]) => {
      const mapped = entries.map((e) => ({
        weekday: e.weekday,
        title: e.title,
        description: e.description ?? null,
        active: e.active,
      }));
      if (pick.scope === "team") {
        if (!pick.team_id) throw new Error("Team wählen.");
        return upsertTeam({ data: { organization_id: orgId, team_id: pick.team_id, entries: mapped } });
      }
      if (pick.scope === "group") {
        if (!pick.team_id || !pick.position_group)
          throw new Error("Team und Gruppe wählen.");
        return upsertGroup({
          data: {
            organization_id: orgId,
            team_id: pick.team_id,
            position_group: pick.position_group,
            entries: mapped,
          },
        });
      }
      if (!pick.athlete_user_id) throw new Error("Spieler wählen.");
      return upsertAthlete({
        data: {
          organization_id: orgId,
          user_id: pick.athlete_user_id,
          team_id: pick.team_id,
          entries: mapped,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition-schedule"] });
      setMsg("Gespeichert.");
    },
    onError: (e: any) => setMsg(e?.message ?? "Fehler beim Speichern."),
  });

  const canEdit =
    (pick.scope === "team" && !!pick.team_id) ||
    (pick.scope === "group" && !!pick.team_id && !!pick.position_group) ||
    (pick.scope === "athlete" && !!pick.athlete_user_id);

  const cardTitle =
    pick.scope === "team"
      ? "Ernährungsplan (Wochenplan)"
      : pick.scope === "group"
      ? `Gruppen-Ernährung · ${pick.position_group ?? ""}`
      : `Spieler-Ernährung · ${pick.athlete_name ?? "Spieler wählen"}`;

  return (
    <Card title={cardTitle}>
      <div className="mb-3">
        <TeamGroupAthletePicker orgId={orgId} teams={teams} value={pick} onChange={setPick} />
      </div>
      {msg && <div className="mb-2 text-xs text-green-500">{msg}</div>}
      {!canEdit ? (
        <Empty>
          {pick.scope === "group"
            ? "Positionsgruppe wählen."
            : pick.scope === "athlete"
            ? "Spieler suchen und wählen."
            : "Team wählen."}
        </Empty>
      ) : (
        <>
          <ScheduleEditor
            teamId={pick.team_id}
            entries={(schedQ.data as any[]) ?? []}
            onSave={(rows) => saveMut.mutate(rows)}
            saving={saveMut.isPending}
          />
          {pick.scope === "athlete" && pick.athlete_user_id && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/coach/plan-builder/$userId"
                params={{ userId: pick.athlete_user_id }}
                className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-gold/20"
              >
                Ernährungsplan-Builder öffnen →
              </Link>
            </div>
          )}
          <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Der Plan-Builder greift auf die vollständige Lebensmitteldatenbank zu.
            Änderungen wirken sich auf zukünftige Tasks aus.
          </div>
        </>
      )}
    </Card>
  );
}


function ScheduleEditor({
  teamId,
  entries,
  onSave,
  saving,
}: {
  teamId: string | null;
  entries: any[];
  onSave: (rows: any[]) => void;
  saving: boolean;
}) {
  type Row = { weekday: number; title: string; start_time: string; end_time: string; active: boolean };
  const initial = (): Row[] =>
    WEEKDAYS.map((_, w) => {
      const e = entries.find((s) => s.weekday === w);
      return {
        weekday: w,
        title: e?.title ?? "Team Training",
        start_time: (e?.start_time ?? "").slice(0, 5) || "",
        end_time: (e?.end_time ?? "").slice(0, 5) || "",
        active: !!e?.active,
      };
    });
  const [rows, setRows] = useState<Row[]>(initial);
  // Reset when teamId or entries change
  const key = `${teamId}::${entries.map((e) => `${e.id}:${e.start_time}:${e.end_time}:${e.title}:${e.active}`).join("|")}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setRows(initial());
  }
  const patch = (w: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.weekday === w ? { ...r, ...p } : r)));

  return (
    <div className="space-y-2">
      <div className="hidden gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-[80px_1fr_80px_80px_80px_60px]">
        <div>Tag</div>
        <div>Titel</div>
        <div>Start</div>
        <div>Ende</div>
        <div>Status</div>
        <div />
      </div>
      {rows.map((r) => (
        <div
          key={r.weekday}
          className="grid grid-cols-2 gap-2 border-b border-border py-2 text-sm sm:grid-cols-[80px_1fr_80px_80px_80px_60px] sm:items-center"
        >
          <div className="font-semibold sm:col-span-1">{WEEKDAYS[r.weekday]}</div>
          <input
            value={r.title}
            onChange={(e) => patch(r.weekday, { title: e.target.value })}
            className="col-span-2 rounded border border-border bg-background px-2 py-1 text-xs sm:col-span-1"
            placeholder="Team Training"
          />
          <input
            type="time"
            value={r.start_time}
            onChange={(e) => patch(r.weekday, { start_time: e.target.value })}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <input
            type="time"
            value={r.end_time}
            onChange={(e) => patch(r.weekday, { end_time: e.target.value })}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => patch(r.weekday, { active: !r.active })}
            className={`rounded px-2 py-1 text-[10px] uppercase tracking-wider ${
              r.active ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
            }`}
          >
            {r.active ? "aktiv" : "inaktiv"}
          </button>
          <div />
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <button
          disabled={saving || !teamId}
          onClick={() =>
            onSave(
              rows
                .filter((r) => r.active || entries.some((e) => e.weekday === r.weekday))
                .map((r) => ({
                  weekday: r.weekday,
                  title: r.title || "Team Training",
                  start_time: r.start_time || null,
                  end_time: r.end_time || null,
                  active: r.active,
                })),
            )
          }
          className="rounded bg-primary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Speichert…" : "Schedule speichern"}
        </button>
      </div>
    </div>
  );
}

function TasksTab({ orgId, teams }: { orgId: string; teams: any[] }) {
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listOrgTasksForDay);
  const createMut = useServerFn(createManualOrgTask);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data, isLoading } = useQuery({
    queryKey: ["org-tasks", orgId, date, teamFilter],
    queryFn: () =>
      fetchTasks({ data: { organization_id: orgId, date, team_id: teamFilter || null } }),
  });

  const [title, setTitle] = useState("");
  const [pick, setPick] = useState<PickerValue>({
    scope: "team",
    team_id: null,
    position_group: null,
    athlete_user_id: null,
    athlete_name: null,
  });
  const [orgWide, setOrgWide] = useState(false);
  const resolveAthletes = useServerFn(listTeamAthletesForAssign);

  const createTask = useMutation({
    mutationFn: async () => {
      // Ziel-User-Liste je nach Ebene auflösen
      let user_ids: string[] | null = null;
      let team_id: string | null = null;
      if (orgWide) {
        team_id = null;
        user_ids = null; // -> alle Org-Mitglieder
      } else if (pick.scope === "athlete") {
        if (!pick.athlete_user_id) throw new Error("Bitte Spieler auswählen.");
        team_id = pick.team_id;
        user_ids = [pick.athlete_user_id];
      } else if (pick.scope === "group") {
        if (!pick.team_id || !pick.position_group)
          throw new Error("Bitte Team und Positionsgruppe wählen.");
        const athletes = await resolveAthletes({
          data: {
            organization_id: orgId,
            team_id: pick.team_id,
            position_group: pick.position_group,
          },
        });
        if (!athletes.length) throw new Error("Keine Spieler in dieser Gruppe.");
        team_id = pick.team_id;
        user_ids = athletes.map((a: any) => a.user_id);
      } else {
        if (!pick.team_id) throw new Error("Bitte Team wählen.");
        team_id = pick.team_id;
        user_ids = null; // -> ganzes Team via team_id
      }
      return createMut({
        data: {
          organization_id: orgId,
          team_id,
          user_ids,
          task_type: "manual",
          title,
          scheduled_date: date,
        },
      });
    },
    onSuccess: () => {
      setTitle("");
      setPick((p: PickerValue) => ({ ...p, athlete_user_id: null, athlete_name: null }));
      qc.invalidateQueries({ queryKey: ["org-tasks", orgId] });
    },
  });

  const filtered = ((data as any[]) ?? []).filter((t) => !statusFilter || t.status === statusFilter);
  const isBuilderTitle = /training|ernähr|nutrit/i.test(title);
  const canOpenBuilder =
    pick.scope === "athlete" && !!pick.athlete_user_id && isBuilderTitle;
  const builderTarget = /ernähr|nutrit/i.test(title) ? "plan-builder" : "training-builder";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-border bg-background px-2 py-1" />
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="rounded border border-border bg-background px-2 py-1">
          <option value="">Alle Teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-border bg-background px-2 py-1">
          <option value="">Alle Status</option>
          <option value="open">Offen</option>
          <option value="done">Erledigt</option>
          <option value="skipped">Übersprungen</option>
        </select>
      </div>

      <Card title="Manuelle Aufgabe">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={orgWide}
              onChange={(e) => setOrgWide(e.target.checked)}
            />
            An gesamte Organisation (Team/Gruppe/Spieler ignorieren)
          </label>
          {!orgWide && (
            <TeamGroupAthletePicker
              orgId={orgId}
              teams={teams}
              value={pick}
              onChange={setPick}
            />
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel z.B. Mobility Routine"
              className="flex-1 min-w-[200px] rounded border border-border bg-background px-2 py-1"
            />
            <button
              onClick={() => createTask.mutate()}
              disabled={!title || createTask.isPending}
              className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {createTask.isPending ? "Legt an…" : "Anlegen"}
            </button>
            {canOpenBuilder && pick.athlete_user_id && (
              <Link
                to={
                  builderTarget === "plan-builder"
                    ? "/coach/plan-builder/$userId"
                    : "/coach/training-builder/$userId"
                }
                params={{ userId: pick.athlete_user_id }}
                className="rounded border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-foreground hover:bg-gold/20"
              >
                Plan-Builder öffnen →
              </Link>
            )}
          </div>
          {createTask.error && (
            <div className="text-xs text-destructive">
              {(createTask.error as Error).message}
            </div>
          )}
          {pick.scope === "athlete" && pick.athlete_name && (
            <div className="text-[11px] text-muted-foreground">
              Ziel: <strong>{pick.athlete_name}</strong>
            </div>
          )}
        </div>
      </Card>


      {isLoading ? (
        <div className="text-xs text-muted-foreground">Lädt…</div>
      ) : filtered.length === 0 ? (
        <Empty>Keine Tasks für {date}.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Zeit</th>
                <th className="px-3 py-2">Typ</th>
                <th className="px-3 py-2">Titel</th>
                <th className="px-3 py-2">Athlet</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t: any) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs">{new Date(t.scheduled_for).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-3 py-2 text-[10px] uppercase tracking-wider">{t.task_type}</td>
                  <td className="px-3 py-2">{t.title}</td>
                  <td className="px-3 py-2">{t.athlete_name}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      t.status === "done" ? "bg-green-500/20 text-green-500" :
                      t.status === "skipped" ? "bg-muted text-muted-foreground" :
                      "bg-yellow-500/20 text-yellow-500"
                    }`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StaffTab({ orgId, teams }: { orgId: string; teams: any[] }) {
  const qc = useQueryClient();
  const fetchStaff = useServerFn(listOrgStaffWithProfiles);
  const fetchInvites = useServerFn(listOrgStaffInvites);
  const addFn = useServerFn(addOrgStaff);
  const updateFn = useServerFn(updateOrgStaffPermissions);
  const removeFn = useServerFn(removeOrgStaff);
  const revokeFn = useServerFn(revokeOrgStaffInvite);

  const staffQ = useQuery({
    queryKey: ["org-staff", orgId],
    queryFn: () => fetchStaff({ data: { organization_id: orgId } }),
  });
  const invitesQ = useQuery({
    queryKey: ["org-staff-invites", orgId],
    queryFn: () => fetchInvites({ data: { organization_id: orgId } }),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["org-staff", orgId] });
    qc.invalidateQueries({ queryKey: ["org-staff-invites", orgId] });
  };

  const removeMut = useMutation({
    mutationFn: (v: { id: string; delete_account: boolean }) =>
      removeFn({ data: { id: v.id, delete_account: v.delete_account } }),
    onSuccess: (res: any) => {
      invalidate();
      setMsg(res?.deleted_account ? "Konto vollständig gelöscht." : "Aus Verein entfernt.");
    },
    onError: (err: any) => setMsg(err?.message ?? "Fehler beim Entfernen."),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => invalidate(),
  });

  const staff = (staffQ.data as any[]) ?? [];
  const invites = ((invitesQ.data as any[]) ?? []).filter((i) => i.status === "pending");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {staff.length} Trainer & Mitarbeiter · {invites.length} offene Einladungen
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
        >
          + Trainer / Mitarbeiter hinzufügen
        </button>
      </div>

      {msg && <div className="text-xs text-green-500">{msg}</div>}

      {staffQ.isLoading ? (
        <div className="text-xs text-muted-foreground">Lädt…</div>
      ) : staff.length === 0 ? (
        <Empty>Noch keine Trainer oder Mitarbeiter zugewiesen.</Empty>
      ) : (
        <ul className="space-y-2">
          {staff.map((s) => (
            <StaffRow
              key={s.id}
              row={s}
              teams={teams}
              onSave={async (patch) => {
                await updateFn({ data: { id: s.id, ...patch } });
                invalidate();
                setMsg("Aktualisiert.");
              }}
              onRemove={(deleteAccount) =>
                removeMut.mutate({ id: s.id, delete_account: deleteAccount })
              }
            />
          ))}
        </ul>
      )}

      <Card title="Offene Einladungen">
        {invites.length === 0 ? (
          <Empty>Keine offenen Einladungen.</Empty>
        ) : (
          <ul className="space-y-2">
            {invites.map((inv: any) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded border border-border bg-background p-2 text-sm"
              >
                <div>
                  <div className="font-mono text-xs">{inv.email}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {roleLabelFromDbRole(inv.assigned_role)} · läuft ab{" "}
                    {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString("de-DE") : "—"}
                  </div>
                </div>
                <button
                  onClick={() => revokeMut.mutate(inv.id)}
                  className="text-[10px] uppercase tracking-wider text-red-500"
                >
                  Zurückziehen
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showAdd && (
        <AddStaffModal
          teams={teams}
          onClose={() => setShowAdd(false)}
          onSubmit={async (payload) => {
            const res: any = await addFn({ data: { organization_id: orgId, ...payload } });
            invalidate();
            setShowAdd(false);
            setMsg(
              res?.invited
                ? `Einladung an ${payload.email} versendet.`
                : res?.existing_user
                  ? "Bestehender BODYFUEL User als Staff hinzugefügt."
                  : "Staff hinzugefügt.",
            );
          }}
        />
      )}
    </div>
  );
}

function StaffRow({
  row,
  teams,
  onSave,
  onRemove,
}: {
  row: any;
  teams: any[];
  onSave: (patch: { role?: string; permissions?: string[]; team_id?: string | null }) => Promise<void>;
  onRemove: (deleteAccount: boolean) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [perms, setPerms] = useState<string[]>(row.permissions ?? []);
  const [teamId, setTeamId] = useState<string | null>(row.team_id ?? null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [deleteAccount, setDeleteAccount] = useState(false);
  const toggle = (p: string) =>
    setPerms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  return (
    <li className="rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{row.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {roleLabelFromDbRole(row.role)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Zuständigkeit: {scopeLabel(row.team_name)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Berechtigungen: {row.permissions?.length ?? 0} Bereiche freigegeben
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setEdit((e) => !e)}
            className="text-[10px] uppercase tracking-wider text-primary"
          >
            {edit ? "Schließen" : "Berechtigungen ansehen"}
          </button>
          <button
            onClick={() => { setDeleteAccount(false); setRemoveOpen(true); }}
            className="text-[10px] uppercase tracking-wider text-red-500"
          >
            Entfernen
          </button>
        </div>
      </div>

      {removeOpen && (
        <div className="mt-3 rounded border border-red-500/40 bg-red-500/5 p-3 text-xs">
          <div className="font-semibold text-red-500">
            {row.name} entfernen?
          </div>
          <label className="mt-2 flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={deleteAccount}
              onChange={(e) => setDeleteAccount(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">BODYFUEL-Konto komplett löschen</span>
              <span className="block text-[10px] text-muted-foreground">
                Auth-Zugang, Profil und alle Zugehörigkeiten werden endgültig entfernt.
                Ohne Haken bleibt der Account bestehen und wird nur aus diesem Verein entfernt.
              </span>
            </span>
          </label>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setRemoveOpen(false)}
              className="rounded border border-border bg-background px-3 py-1 text-[10px] uppercase tracking-wider"
            >
              Abbrechen
            </button>
            <button
              onClick={() => { setRemoveOpen(false); onRemove(deleteAccount); }}
              className="rounded bg-red-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
            >
              {deleteAccount ? "Endgültig löschen" : "Aus Verein entfernen"}
            </button>
          </div>
        </div>
      )}

      {!edit && row.permissions?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {row.permissions.map((p: string) => (
            <span
              key={p}
              className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium"
            >
              {permissionLabel(p)}
            </span>
          ))}
        </div>
      ) : null}

      {edit && (
        <div className="mt-3 space-y-4 border-t border-border pt-3">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Zuständigkeit
            </div>
            <select
              value={teamId ?? ""}
              onChange={(e) => setTeamId(e.target.value || null)}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="">Gesamter Verein</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  Team: {t.name}
                </option>
              ))}
            </select>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Die Zuständigkeit legt fest, für welche Teams diese Person Zugriff erhält.
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Berechtigungen
            </div>
            <ul className="space-y-2">
              {(Object.keys(PERMISSION_LABELS) as (keyof typeof PERMISSION_LABELS)[]).map((p) => (
                <li key={p} className="rounded border border-border bg-background p-2">
                  <label className="flex cursor-pointer items-start gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={perms.includes(p)}
                      onChange={() => toggle(p)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-semibold">{PERMISSION_LABELS[p].label}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {PERMISSION_LABELS[p].description}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={async () => {
              await onSave({ permissions: perms, team_id: teamId });
              setEdit(false);
            }}
            className="rounded bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
          >
            Speichern
          </button>
        </div>
      )}
    </li>
  );
}

function AddStaffModal({
  teams,
  onClose,
  onSubmit,
}: {
  teams: any[];
  onClose: () => void;
  onSubmit: (p: {
    email: string;
    role: string;
    team_id: string | null;
    permissions: string[];
  }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [presetKey, setPresetKey] = useState<keyof typeof STAFF_PRESETS>("TEAM_COACH");
  const preset = STAFF_PRESETS[presetKey];
  const [perms, setPerms] = useState<string[]>(preset.permissions);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Sync perms when preset changes
  const applyPreset = (k: keyof typeof STAFF_PRESETS) => {
    setPresetKey(k);
    setPerms([...STAFF_PRESETS[k].permissions]);
  };

  const toggle = (p: string) =>
    setPerms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const submit = async () => {
    if (!email) {
      setErr("E-Mail erforderlich.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit({
        email: email.trim(),
        role: preset.role,
        team_id: teamId,
        permissions: perms,
      });
    } catch (e: any) {
      setErr(e?.message || "Fehler.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
      <div className="my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-lg border border-border bg-card text-sm">
        <div className="sticky top-0 flex items-center justify-between rounded-t-lg border-b border-border bg-card px-5 py-4">
          <h3 className="font-display text-lg font-bold">Trainer / Mitarbeiter hinzufügen</h3>
          <button onClick={onClose} className="text-xs text-muted-foreground">
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">


        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            E-Mail
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@example.com"
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1"
            autoFocus
          />
          <div className="mt-1 text-[10px] text-muted-foreground">
            Existiert bereits ein BODYFUEL Account, wird er sofort zugeordnet – keine Account-Duplikation. Sonst wird ein Invite-Token erstellt.
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Funktion im Verein
          </label>
          <select
            value={presetKey}
            onChange={(e) => applyPreset(e.target.value as any)}
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1"
          >
            {(Object.keys(STAFF_PRESETS) as PresetKey[]).map((k) => (
              <option key={k} value={k}>
                {PRESET_LABELS[k].label}
              </option>
            ))}
          </select>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {PRESET_LABELS[presetKey as PresetKey]?.description}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Zuständigkeit {preset.scope_hint === "team" ? "(empfohlen: einzelnes Team)" : "(optional)"}
          </label>
          <select
            value={teamId ?? ""}
            onChange={(e) => setTeamId(e.target.value || null)}
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1"
          >
            <option value="">Gesamter Verein</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                Team: {t.name}
              </option>
            ))}
          </select>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Die Zuständigkeit legt fest, für welche Teams diese Person Zugriff erhält.
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Berechtigungen
          </label>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Die Funktion schlägt passende Berechtigungen vor. Du kannst sie individuell anpassen.
          </div>
          <ul className="mt-2 space-y-2">
            {(Object.keys(PERMISSION_LABELS) as (keyof typeof PERMISSION_LABELS)[]).map((p) => (
              <li key={p} className="rounded border border-border bg-background p-2">
                <label className="flex cursor-pointer items-start gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={perms.includes(p)}
                    onChange={() => toggle(p)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-semibold">{PERMISSION_LABELS[p].label}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {PERMISSION_LABELS[p].description}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Zusammenfassung
          </div>
          <div className="mt-1 text-sm font-semibold">
            {PRESET_LABELS[presetKey as PresetKey]?.label}
          </div>
          <div className="mt-2 text-[11px]">
            <span className="text-muted-foreground">Zuständigkeit: </span>
            {teamId
              ? `Team: ${teams.find((t) => t.id === teamId)?.name ?? "—"}`
              : "Gesamter Verein"}
          </div>
          <div className="mt-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Zugriff
            </div>
            <ul className="mt-1 space-y-0.5 text-[11px]">
              {perms.length === 0 ? (
                <li className="text-muted-foreground">Keine Berechtigungen ausgewählt.</li>
              ) : (
                perms.map((p) => (
                  <li key={p}>✓ {permissionLabel(p)}</li>
                ))
              )}
            </ul>
          </div>
          {(() => {
            const missing = (Object.keys(PERMISSION_LABELS) as string[]).filter(
              (p) => !perms.includes(p),
            );
            if (!missing.length) return null;
            return (
              <div className="mt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Kein Zugriff
                </div>
                <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  {missing.map((p) => (
                    <li key={p}>– {permissionLabel(p)}</li>
                  ))}
                </ul>
              </div>
            );
          })()}
          <div className="mt-2 text-[10px] text-muted-foreground">
            Berechtigungen bleiben individuell anpassbar.
          </div>
        </div>


        {err && <div className="text-xs text-red-500">{err}</div>}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 rounded-b-lg border-t border-border bg-card px-5 py-3">
          <button onClick={onClose} className="rounded border border-border px-3 py-1 text-xs">
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded bg-primary px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Speichert…" : "Hinzufügen"}
          </button>
        </div>
      </div>
    </div>
  );
}


function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

// ============================================================
// CHALLENGES TAB
// ============================================================
function ChallengesTab({ orgId, teams }: { orgId: string; teams: any[] }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listOrgChallenges);
  const createFn = useServerFn(createOrgChallenge);
  const { data } = useQuery({
    queryKey: ["org-challenges", orgId],
    queryFn: () => listFn({ data: { organization_id: orgId } }),
  });
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState("");
  const [teamId, setTeamId] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          organization_id: orgId,
          name,
          description: desc || null,
          starts_at: new Date(`${start}T00:00:00Z`).toISOString(),
          ends_at: end ? new Date(`${end}T23:59:59Z`).toISOString() : null,
          team_id: teamId || null,
          visibility_scope: "organization",
        },
      }),
    onSuccess: () => {
      setShow(false);
      setName("");
      setDesc("");
      setEnd("");
      qc.invalidateQueries({ queryKey: ["org-challenges", orgId] });
    },
  });
  const challenges = ((data as any)?.challenges ?? []) as any[];
  const now = new Date();
  const active = challenges.filter((c) => c.status === "active" && (!c.ends_at || new Date(c.ends_at) >= now));
  const planned = challenges.filter((c) => c.status === "active" && new Date(c.starts_at) > now);
  const past = challenges.filter((c) => c.status === "archived" || (c.ends_at && new Date(c.ends_at) < now));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Organization Challenges</h3>
        <button
          onClick={() => setShow((v) => !v)}
          className="rounded bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
        >
          + Challenge erstellen
        </button>
      </div>
      {show && (
        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded border border-border bg-background px-2 py-1" />
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="rounded border border-border bg-background px-2 py-1">
              <option value="">Organisationsweit</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded border border-border bg-background px-2 py-1" />
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded border border-border bg-background px-2 py-1" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Beschreibung" rows={2} className="sm:col-span-2 rounded border border-border bg-background px-2 py-1" />
          </div>
          <button
            onClick={() => name.trim() && createMut.mutate()}
            disabled={!name.trim() || createMut.isPending}
            className="mt-2 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      )}
      <ChallengeSection title="AKTIV" items={active} onSelect={setSelected} />
      <ChallengeSection title="GEPLANT" items={planned} onSelect={setSelected} />
      <ChallengeSection title="ABGESCHLOSSEN" items={past} onSelect={setSelected} />
      {selected && <ChallengeRuleEditor challengeId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ChallengeSection({ title, items, onSelect }: { title: string; items: any[]; onSelect: (id: string) => void }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <Empty>Keine Einträge.</Empty>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {c.starts_at && new Date(c.starts_at).toLocaleDateString("de-DE")}
                  {c.ends_at && ` – ${new Date(c.ends_at).toLocaleDateString("de-DE")}`}
                </div>
              </div>
              <button onClick={() => onSelect(c.id)} className="rounded border border-border px-2 py-1 text-[10px] uppercase tracking-wider">
                Rules
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChallengeRuleEditor({ challengeId, onClose }: { challengeId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listChallengeRules);
  const saveFn = useServerFn(upsertChallengeRule);
  const bonusFn = useServerFn(awardChallengeBonus);
  const { data } = useQuery({
    queryKey: ["challenge-rules", challengeId],
    queryFn: () => listFn({ data: { challenge_id: challengeId } }),
  });
  const [ruleType, setRuleType] = useState("daily_checkin");
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState(2);
  const [frequency, setFrequency] = useState("daily");
  const [bonusUser, setBonusUser] = useState("");
  const [bonusPts, setBonusPts] = useState(5);
  const [bonusReason, setBonusReason] = useState("");
  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: { challenge_id: challengeId, rule_type: ruleType, title: title || ruleType, points, frequency },
      }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["challenge-rules", challengeId] });
    },
  });
  const bonusMut = useMutation({
    mutationFn: () => bonusFn({ data: { challenge_id: challengeId, user_id: bonusUser, points: bonusPts, reason: bonusReason || undefined } }),
    onSuccess: () => {
      setBonusUser("");
      setBonusReason("");
    },
  });
  return (
    <div className="rounded-lg border border-primary bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rules</div>
        <button onClick={onClose} className="text-xs text-muted-foreground">✕</button>
      </div>
      <ul className="mb-3 space-y-1 text-sm">
        {((data as any)?.rules ?? []).map((r: any) => (
          <li key={r.id} className="flex justify-between rounded border border-border bg-background px-2 py-1">
            <span>{r.title} <span className="text-muted-foreground">({r.rule_type})</span></span>
            <span className="font-semibold">+{r.points} · {r.frequency}</span>
          </li>
        ))}
        {(!(data as any)?.rules?.length) && <li className="text-xs text-muted-foreground">Noch keine Regeln.</li>}
      </ul>
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={ruleType} onChange={(e) => setRuleType(e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-sm">
          {["daily_task","daily_checkin","training_completed","athletic_training_completed","team_training_attendance","hydration","nutrition","recovery","manual_bonus","custom"].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-sm">
          <option value="daily">daily</option>
          <option value="per_completion">per_completion</option>
          <option value="once">once</option>
          <option value="weekly">weekly</option>
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel" className="rounded border border-border bg-background px-2 py-1 text-sm" />
        <input type="number" value={points} onChange={(e) => setPoints(parseInt(e.target.value, 10) || 0)} placeholder="Punkte" className="rounded border border-border bg-background px-2 py-1 text-sm" />
      </div>
      <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="mt-2 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">
        Rule speichern
      </button>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manual Bonus</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <input value={bonusUser} onChange={(e) => setBonusUser(e.target.value)} placeholder="User-ID" className="rounded border border-border bg-background px-2 py-1 text-xs" />
          <input type="number" value={bonusPts} onChange={(e) => setBonusPts(parseInt(e.target.value, 10) || 0)} placeholder="Punkte" className="rounded border border-border bg-background px-2 py-1 text-xs" />
          <input value={bonusReason} onChange={(e) => setBonusReason(e.target.value)} placeholder="Grund" className="rounded border border-border bg-background px-2 py-1 text-xs" />
        </div>
        <button onClick={() => bonusUser && bonusMut.mutate()} disabled={!bonusUser || bonusMut.isPending} className="mt-2 rounded border border-border px-3 py-1 text-xs disabled:opacity-50">
          Bonus vergeben
        </button>
      </div>
    </div>
  );
}

// ============================================================
// COMMUNITY TAB
// ============================================================
function CommunityTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listOrgCommunityPosts);
  const createFn = useServerFn(createOrgCommunityPost);
  // We need the slug — fetch via org-detail query already loaded; re-derive.
  const { data: detail } = useQuery({
    queryKey: ["coach-org-detail", orgId],
    queryFn: () => Promise.resolve(null), // uses cached data
    enabled: false,
  });
  const slug = ((detail as any)?.org?.slug as string) ?? "";
  const { data } = useQuery({
    queryKey: ["org-community-coach", orgId],
    queryFn: () => listFn({ data: { slug: slug || "" } }),
    enabled: !!slug,
  });
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState("staff_update");
  const mut = useMutation({
    mutationFn: () => createFn({ data: { organization_id: orgId, content, post_type: postType } }),
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["org-community-coach", orgId] });
    },
  });
  if (!slug) return <Empty>Community-Feed lädt…</Empty>;
  const posts = ((data as any)?.posts ?? []) as any[];
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Neuer Beitrag</div>
        <select value={postType} onChange={(e) => setPostType(e.target.value)} className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs">
          {["staff_update","announcement","training","challenge","achievement","general"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="w-full rounded border border-border bg-background px-2 py-1 text-sm" placeholder="Inhalt" />
        <button onClick={() => content.trim() && mut.mutate()} disabled={!content.trim() || mut.isPending} className="mt-2 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          Posten
        </button>
      </div>
      {posts.length === 0 ? (
        <Empty>Noch keine Beiträge.</Empty>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold">{p.author_name}</span>
                <span>{new Date(p.created_at).toLocaleString("de-DE")}</span>
              </div>
              <div className="mt-1 whitespace-pre-wrap">{p.content}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

