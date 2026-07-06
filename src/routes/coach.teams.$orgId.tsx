import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { getOrgCoachDetail } from "@/lib/organizations/athlete.functions";

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
  { key: "challenges", label: "Challenges", feature: "challenges" },
  { key: "ranking", label: "Ranking", feature: "ranking" },
  { key: "community", label: "Community", feature: "community" },
  { key: "staff", label: "Staff", feature: null },
  { key: "settings", label: "Einstellungen", feature: null },
];

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

      {/* Tabs */}
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
                <Empty>Keine aktive Challenge.</Empty>
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
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Position</th>
                  <th className="px-3 py-2">Onboarding</th>
                  <th className="px-3 py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {(data.athletes as any[]).map((a) => (
                  <tr key={a.user_id} className="border-t border-border">
                    <td className="px-3 py-2 font-semibold">{a.name}</td>
                    <td className="px-3 py-2">{a.team_name ?? "—"}</td>
                    <td className="px-3 py-2">{a.position ?? "—"}</td>
                    <td className="px-3 py-2">
                      {a.onboarding_completed ? (
                        <span className="text-green-500">✓</span>
                      ) : (
                        <span className="text-yellow-500">offen</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(a.joined_at).toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                ))}
                {data.athletes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Noch keine Athleten.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-border bg-muted/40 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Nur COESFELD BULLS Organization Data — persönliche BODYFUEL Daten sind hier nicht sichtbar.
            </div>
          </div>
        )}

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

        {tab === "staff" && (
          <ul className="space-y-2">
            {(data.staff as any[]).map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <span className="font-mono text-xs">{s.user_id.slice(0, 8)}…</span>
                <span className="text-[10px] uppercase tracking-wider">{s.role}</span>
              </li>
            ))}
            {data.staff.length === 0 && <Empty>Noch kein Staff zugewiesen.</Empty>}
          </ul>
        )}

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

        {(tab === "training" || tab === "challenges" || tab === "ranking" || tab === "community") && (
          <Empty>
            {tab === "training" && "Athletic Training Verwaltung folgt."}
            {tab === "challenges" && "Challenges Verwaltung folgt."}
            {tab === "ranking" && "Ranking-Verwaltung folgt."}
            {tab === "community" && "Community-Moderation folgt."}
          </Empty>
        )}
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
