import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  STAFF_PRESETS,
} from "@/lib/organizations/operating-loop.functions";

export const Route = createFileRoute("/coach/teams/$orgId")({
  head: () => ({ meta: [{ title: "Organisation — BODYFUEL Coach" }] }),
  component: () => (
    <AppLayout>
      <CoachOrgDetail />
    </AppLayout>
  ),
});

const ALL_TABS = [
  { key: "overview", label: "Übersicht", feature: null },
  { key: "athletes", label: "Athleten", feature: null },
  { key: "teams", label: "Teams", feature: null },
  { key: "training", label: "Training", feature: "athletic_training" },
  { key: "tasks", label: "Tasks", feature: null },
  { key: "challenges", label: "Challenges", feature: "challenges" },
  { key: "ranking", label: "Ranking", feature: "ranking" },
  { key: "community", label: "Community", feature: "community" },
  { key: "staff", label: "Staff", feature: null },
  { key: "settings", label: "Einstellungen", feature: null },
];

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function CoachOrgDetail() {
  const { orgId } = Route.useParams();
  const fetch = useServerFn(getOrgCoachDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["coach-org-detail", orgId],
    queryFn: () => fetch({ data: { orgId } }),
  });
  const [tab, setTab] = useState("overview");

  if (isLoading || !data || !data.org) {
    return <div className="text-sm text-muted-foreground">Lädt…</div>;
  }
  const org: any = data.org;
  const features = data.features as { feature: string; enabled: boolean }[];
  const featureOn = (k: string) => features.some((f) => f.feature === k && f.enabled);
  const visibleTabs = ALL_TABS.filter((t) => t.feature === null || featureOn(t.feature));

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

      <section className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Stat label="Athleten" value={data.athletes.length} />
        <Stat label="Staff" value={data.staff.length} />
        <Stat label="Teams" value={data.teams.length} />
        <Stat
          label="Weekly Compliance"
          value={data.weekly_compliance != null ? `${data.weekly_compliance}%` : "—"}
        />
      </section>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-border">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
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

        {tab === "athletes" && <AthletesTab orgId={orgId} />}
        {tab === "teams" && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(data.teams as any[]).map((t) => (
              <li key={t.id} className="rounded-lg border border-border bg-card p-4">
                <div className="font-semibold">{t.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t.sport ?? "—"} {t.age_group ? `· ${t.age_group}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
        {tab === "training" && <TrainingTab orgId={orgId} />}
        {tab === "tasks" && <TasksTab orgId={orgId} teams={data.teams as any[]} />}
        {tab === "challenges" && <ChallengesTab orgId={orgId} teams={data.teams as any[]} />}
        {tab === "ranking" && (
          <Empty>Ranking spiegelt Punkte aus aktiven Org-Challenges (Ledger `organization_challenge_point_events`). Ohne aktive Challenge leer.</Empty>
        )}
        {tab === "community" && <CommunityTab orgId={orgId} />}
        {tab === "staff" && <StaffTab orgId={orgId} />}

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

function AthletesTab({ orgId }: { orgId: string }) {
  const fetchAudit = useServerFn(getOrgAthletesOnboardingAudit);
  const { data, isLoading } = useQuery({
    queryKey: ["org-onboarding-audit", orgId],
    queryFn: () => fetchAudit({ data: { organization_id: orgId } }),
  });
  if (isLoading || !data) return <div className="text-xs text-muted-foreground">Lädt…</div>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-left text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Onboarding</th>
            <th className="px-3 py-2">Fehlende Organization-Daten</th>
          </tr>
        </thead>
        <tbody>
          {(data.athletes as any[]).map((a) => (
            <tr key={a.user_id} className="border-t border-border">
              <td className="px-3 py-2 font-semibold">{a.name}</td>
              <td className="px-3 py-2">
                {a.derived_complete ? (
                  <span className="text-green-500">ABGESCHLOSSEN</span>
                ) : (
                  <span className="text-yellow-500">OFFEN</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {a.missing.length === 0 ? "—" : a.missing.join(", ")}
              </td>
            </tr>
          ))}
          {data.athletes.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                Noch keine Athleten.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TrainingTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const fetchSched = useServerFn(getTeamTrainingSchedule);
  const upsert = useServerFn(upsertTeamTrainingSchedule);
  const engine = useServerFn(runOrgTaskEngine);
  const { data, isLoading } = useQuery({
    queryKey: ["org-team-schedule", orgId],
    queryFn: () => fetchSched({ data: { organization_id: orgId } }),
  });

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: async (entries: any[]) =>
      upsert({ data: { team_id: selectedTeamId!, entries } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-team-schedule", orgId] });
      setMsg("Gespeichert.");
    },
  });
  const regenMut = useMutation({
    mutationFn: () => engine({ data: { organization_id: orgId, horizon_days: 14 } }),
    onSuccess: (r) => setMsg(`Task Engine: ${r.inserted}/${r.considered} neue Tasks erstellt.`),
  });

  if (isLoading || !data) return <div className="text-xs text-muted-foreground">Lädt…</div>;
  const teamId = selectedTeamId ?? (data.teams as any[])[0]?.id ?? null;
  const teamSchedules = ((data.schedules as any[]) || []).filter((s) => s.team_id === teamId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Team:</label>
        <select
          value={teamId ?? ""}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-sm"
        >
          {(data.teams as any[]).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
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
      <Card title="Team Training Schedule (Wochenplan)">
        <div className="space-y-2">
          {WEEKDAYS.map((label, weekday) => {
            const existing = teamSchedules.find((s) => s.weekday === weekday);
            const active = !!existing?.active;
            return (
              <div key={weekday} className="flex items-center justify-between gap-3 border-b border-border py-1 text-sm">
                <div className="font-semibold">{label}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    defaultValue={existing?.start_time ?? "19:30"}
                    id={`start-${weekday}`}
                    className="rounded border border-border bg-background px-2 py-0.5 text-xs"
                  />
                  <button
                    onClick={() => {
                      const start = (document.getElementById(`start-${weekday}`) as HTMLInputElement).value;
                      const next = teamSchedules
                        .filter((s) => s.weekday !== weekday)
                        .map((s) => ({ weekday: s.weekday, start_time: s.start_time, end_time: s.end_time, title: s.title, active: s.active }));
                      next.push({ weekday, start_time: start, end_time: null, title: "Team Training", active: !active });
                      saveMut.mutate(next);
                    }}
                    className={`rounded px-3 py-1 text-[10px] uppercase tracking-wider ${
                      active ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {active ? "aktiv" : "inaktiv"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Athletic Plans">
        <Empty>Athletic-Plan-Composer folgt. Plan-Sessions werden nach Anlage automatisch als Tasks erzeugt.</Empty>
      </Card>
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
  const [scope, setScope] = useState<"org" | "team">("org");
  const [teamForCreate, setTeamForCreate] = useState<string>("");
  const createTask = useMutation({
    mutationFn: async () =>
      createMut({
        data: {
          organization_id: orgId,
          team_id: scope === "team" ? teamForCreate || null : null,
          task_type: "manual",
          title,
          scheduled_date: date,
        },
      }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["org-tasks", orgId] });
    },
  });

  const filtered = ((data as any[]) ?? []).filter((t) => !statusFilter || t.status === statusFilter);

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
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="rounded border border-border bg-background px-2 py-1">
            <option value="org">Ganze Organization</option>
            <option value="team">Bestimmtes Team</option>
          </select>
          {scope === "team" && (
            <select value={teamForCreate} onChange={(e) => setTeamForCreate(e.target.value)} className="rounded border border-border bg-background px-2 py-1">
              <option value="">Team wählen…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel z.B. Mobility Routine" className="flex-1 rounded border border-border bg-background px-2 py-1" />
          <button
            onClick={() => createTask.mutate()}
            disabled={!title || createTask.isPending || (scope === "team" && !teamForCreate)}
            className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Anlegen
          </button>
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

function StaffTab({ orgId }: { orgId: string }) {
  const fetchStaff = useServerFn(listOrgStaffWithProfiles);
  const { data, isLoading } = useQuery({
    queryKey: ["org-staff", orgId],
    queryFn: () => fetchStaff({ data: { organization_id: orgId } }),
  });
  if (isLoading || !data) return <div className="text-xs text-muted-foreground">Lädt…</div>;
  if ((data as any[]).length === 0) return <Empty>Noch kein Staff zugewiesen.</Empty>;
  return (
    <ul className="space-y-2">
      {(data as any[]).map((s) => (
        <li key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
          <div>
            <div className="font-semibold">{s.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {s.role}{s.team_name ? ` · ${s.team_name}` : " · Organisationsweit"}
            </div>
          </div>
          {s.permissions?.length ? (
            <div className="hidden gap-1 sm:flex">
              {s.permissions.slice(0, 3).map((p: string) => (
                <span key={p} className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider">{p}</span>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
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

