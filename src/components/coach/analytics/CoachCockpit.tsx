import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  AlertTriangle,
  Eye,
  Users,
  HeartPulse,
  ShieldAlert,
} from "lucide-react";

import { getOrgCoachAnalytics, type CoachAnalytics } from "@/lib/organizations/coach-analytics.functions";
import {
  getOrgReadinessGateSummary,
  type OrgReadinessGateSummary,
} from "@/lib/organizations/readiness-gates.functions";
import { STATUS_LABEL } from "@/lib/organizations/coach-analytics.rules";

export function CoachCockpit({ orgId }: { orgId: string }) {
  const fetch = useServerFn(getOrgCoachAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["coach-analytics", orgId],
    queryFn: () => fetch({ data: { orgId } }),
  });

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Cockpit wird geladen…</div>;
  }

  return (
    <div className="space-y-8">
      <TeamPulse data={data} />
      <TeamReadinessSection data={data} orgId={orgId} />
      <CoachRadar data={data} orgId={orgId} />
      <PositionGroupsAnalysis data={data} />
      <AttentionList data={data} orgId={orgId} />
      {data.data_sparse && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          Datengrundlage ist noch dünn. Sobald mehr Trainings, Tasks und Check-ins vorliegen,
          werden Trend- und Vergleichswerte belastbarer.
        </div>
      )}
    </div>
  );
}

// -------------------------- Team Readiness --------------------------

function TeamReadinessSection({ data, orgId }: { data: CoachAnalytics; orgId: string }) {
  const r = data.readiness;
  const rate = r.total > 0 ? Math.round((r.submitted / r.total) * 100) : 0;
  return (
    <section>
      <SectionTitle icon={<HeartPulse className="h-4 w-4" />}>Team Readiness · heute</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Check-in Quote</div>
          <div className="mt-2 font-display text-2xl font-bold">{r.submitted}/{r.total}</div>
          <div className="text-[11px] text-muted-foreground">{rate}% eingereicht</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Ø Readiness</div>
          <div className="mt-2 font-display text-2xl font-bold">{r.avg_score != null ? `${r.avg_score}` : "—"}</div>
          <div className="text-[11px] text-muted-foreground">0–100</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Verteilung</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />{r.green}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" />{r.yellow}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />{r.red}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">grün ≥70 · gelb ≥45 · rot &lt;45</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Schmerz-Signale</div>
          <div className="mt-2 font-display text-2xl font-bold">{r.pain_flags.length}</div>
          <div className="text-[11px] text-muted-foreground">Athleten mit Schmerz ≥3</div>
        </div>
      </div>
      {(r.pain_flags.length > 0 || r.missing.length > 0) && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {r.pain_flags.length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">Schmerz-Meldungen</div>
              <ul className="space-y-1.5">
                {r.pain_flags.slice(0, 6).map((f) => (
                  <li key={f.user_id} className="text-sm">
                    <AthleteRowLink orgId={orgId} userId={f.user_id} className="block rounded hover:underline">
                      <span className="font-semibold">{f.name}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">Level {f.pain_level}/5{f.pain_note ? ` · ${f.pain_note}` : ""}</span>
                    </AthleteRowLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.missing.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Kein Check-in heute ({r.missing.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.missing.slice(0, 12).map((m) => (
                  <span key={m.user_id} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{m.name}</span>
                ))}
                {r.missing.length > 12 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">+{r.missing.length - 12}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <ReadinessGateTile orgId={orgId} />
    </section>
  );
}

function ReadinessGateTile({ orgId }: { orgId: string }) {
  const fetchFn = useServerFn(getOrgReadinessGateSummary);
  const { data } = useQuery({
    queryKey: ["org-readiness-gates", orgId],
    queryFn: () =>
      fetchFn({ data: { orgId, days: 14 } }) as Promise<OrgReadinessGateSummary>,
  });
  if (!data || data.events_total === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400">
        <ShieldAlert className="h-3.5 w-3.5" /> Readiness bremst Progression · 14 Tage
      </div>
      <div className="text-[12px] text-muted-foreground">
        {data.athletes_flagged}{" "}
        {data.athletes_flagged === 1 ? "Athlet" : "Athleten"} · {data.events_total} Events
        (Hart {data.hard} · Weich {data.soft}). Der Plan wurde konservativ gehalten, keine
        parallele Reduktion.
      </div>
      {data.top.length > 0 && (
        <ul className="mt-2 space-y-1">
          {data.top.map((t) => (
            <li key={t.user_id} className="text-sm">
              <AthleteRowLink orgId={orgId} userId={t.user_id} className="block rounded hover:underline">
                <span className="font-semibold">{t.name ?? "Unbekannt"}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {t.events} Events{t.hard > 0 ? ` · Hart ${t.hard}` : ""}
                  {t.last_reason ? ` · ${t.last_reason}` : ""}
                </span>
              </AthleteRowLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


// -------------------------- Team Pulse --------------------------

function TeamPulse({ data }: { data: CoachAnalytics }) {
  const p = data.pulse;
  return (
    <section>
      <SectionTitle icon={<Activity className="h-4 w-4" />}>Team Pulse · letzte 7 Tage</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PulseCard
          label="Weekly Compliance"
          value={p.weekly_compliance != null ? `${p.weekly_compliance}%` : "—"}
          delta={p.weekly_compliance_delta}
          suffix="%"
        />
        <PulseCard
          label="Aktive Athleten"
          value={`${p.active_athletes} / ${p.total_athletes}`}
          delta={p.active_athletes_delta}
          suffix=""
        />
        <PulseCard
          label="Abgeschlossene Trainings"
          value={String(p.training_sessions)}
          delta={p.training_sessions_delta}
          suffix=""
        />
        <PulseCard
          label="Athleten gesamt"
          value={String(p.total_athletes)}
          delta={null}
          suffix=""
        />
      </div>
    </section>
  );
}

function PulseCard({
  label, value, delta, suffix,
}: { label: string; value: string; delta: number | null; suffix: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div className="font-display text-2xl font-bold">{value}</div>
        <TrendChip delta={delta} suffix={suffix} />
      </div>
    </div>
  );
}

function TrendChip({ delta, suffix }: { delta: number | null; suffix: string }) {
  if (delta == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        <Minus className="h-3 w-3" /> keine Vergleichsdaten
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        <Minus className="h-3 w-3" /> ±0{suffix}
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        up ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
      }`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}{delta}{suffix}
    </span>
  );
}

// -------------------------- Coach Radar --------------------------

function CoachRadar({ data, orgId }: { data: CoachAnalytics; orgId: string }) {
  const { critical, watch, positive } = data.radar;
  const isEmpty = critical.length === 0 && watch.length === 0 && positive.length === 0;
  return (
    <section>
      <SectionTitle icon={<AlertTriangle className="h-4 w-4" />}>Coach Radar</SectionTitle>
      {isEmpty ? (
        <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          Aktuell keine Auffälligkeiten. Sobald sich Compliance oder Aktivität deutlich ändern,
          erscheinen hier priorisierte Hinweise.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <RadarBucket title="Kritisch" tone="red" items={critical} orgId={orgId} />
          <RadarBucket title="Beobachten" tone="yellow" items={watch} orgId={orgId} />
          <RadarBucket title="Positiv" tone="green" items={positive} orgId={orgId} />
        </div>
      )}
    </section>
  );
}

function RadarBucket({
  title, tone, items, orgId,
}: { title: string; tone: "red" | "yellow" | "green"; items: CoachAnalytics["radar"]["critical"]; orgId: string }) {
  const toneCls =
    tone === "red" ? "border-red-500/30 bg-red-500/5" :
    tone === "yellow" ? "border-yellow-500/30 bg-yellow-500/5" :
    "border-green-500/30 bg-green-500/5";
  const dotCls =
    tone === "red" ? "bg-red-500" : tone === "yellow" ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className={`rounded-lg border p-3 ${toneCls}`}>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]">
        <span className={`h-2 w-2 rounded-full ${dotCls}`} />
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">—</div>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 5).map((it) => (
            <li key={it.user_id} className="text-sm">
              <AthleteRowLink orgId={orgId} userId={it.user_id} className="block touch-manipulation rounded hover:underline active:bg-muted/40">
                <div className="font-semibold">{it.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {it.position ?? "—"} · {it.reason}
                </div>
              </AthleteRowLink>
            </li>
          ))}
          {items.length > 5 && (
            <li className="text-[10px] uppercase tracking-wider text-muted-foreground">
              +{items.length - 5} weitere
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// -------------------------- Position Groups --------------------------

function PositionGroupsAnalysis({ data }: { data: CoachAnalytics }) {
  if (data.position_groups.length === 0) return null;
  const teamAvg = data.pulse.weekly_compliance;
  return (
    <section>
      <SectionTitle icon={<Users className="h-4 w-4" />}>Positionsgruppen</SectionTitle>

      {/* Mobile: compact cards */}
      <div className="grid gap-2 sm:hidden">
        {data.position_groups.map((g) => {
          const diff =
            g.weekly_compliance != null && teamAvg != null
              ? g.weekly_compliance - teamAvg
              : null;
          return (
            <div key={g.position} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{g.position}</div>
                <div className="text-sm font-bold">
                  {g.weekly_compliance != null ? `${g.weekly_compliance}%` : "—"}
                  {diff != null && (
                    <span className={`ml-1.5 text-xs font-semibold ${diff >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {diff > 0 ? "+" : ""}{diff}%
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{g.athletes} Athleten</span>
                <span>·</span>
                <span>{g.active} aktiv</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Position</th>
              <th className="px-3 py-2">Athleten</th>
              <th className="px-3 py-2">Aktiv</th>
              <th className="px-3 py-2">Compliance</th>
              <th className="px-3 py-2">vs. Team</th>
            </tr>
          </thead>
          <tbody>
            {data.position_groups.map((g) => {
              const diff =
                g.weekly_compliance != null && teamAvg != null
                  ? g.weekly_compliance - teamAvg
                  : null;
              return (
                <tr key={g.position} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-semibold">{g.position}</td>
                  <td className="px-3 py-2">{g.athletes}</td>
                  <td className="px-3 py-2">{g.active}</td>
                  <td className="px-3 py-2">
                    {g.weekly_compliance != null ? `${g.weekly_compliance}%` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {diff == null ? "—" : (
                      <span className={diff >= 0 ? "text-green-500" : "text-red-500"}>
                        {diff > 0 ? "+" : ""}{diff}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// -------------------------- Attention List --------------------------

function AttentionList({ data, orgId }: { data: CoachAnalytics; orgId: string }) {
  const items = data.attention_list;
  return (
    <section>
      <SectionTitle icon={<Eye className="h-4 w-4" />}>Aufmerksamkeitsliste</SectionTitle>
      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          Noch keine Athleten mit auswertbarer Datenbasis.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {items.slice(0, 25).map((a) => (
            <li key={a.user_id}>
              <AthleteRowLink
                orgId={orgId}
                userId={a.user_id}
                className="flex touch-manipulation items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/40 active:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusDot status={a.status} />
                    <div className="truncate font-semibold">{a.name}</div>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {a.position ?? "—"}{a.team_name ? ` · ${a.team_name}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    {a.compliance != null ? `${a.compliance}%` : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {a.compliance_delta == null
                      ? "—"
                      : a.compliance_delta > 0
                      ? `+${a.compliance_delta}%`
                      : `${a.compliance_delta}%`}
                    {a.last_active_days != null && a.last_active_days >= 3 && (
                      <> · {a.last_active_days}d inaktiv</>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {STATUS_LABEL[a.status]}
                </span>
              </AthleteRowLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusDot({ status }: { status: CoachAnalytics["attention_list"][number]["status"] }) {
  const cls =
    status === "critical" ? "bg-red-500" :
    status === "attention" ? "bg-orange-500" :
    status === "watch" ? "bg-yellow-500" :
    status === "positive" ? "bg-green-500" :
    "bg-muted-foreground";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
      {icon}
      {children}
    </h2>
  );
}

function AthleteRowLink({
  orgId,
  userId,
  className,
  children,
}: {
  orgId: string;
  userId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <Link
      to="/coach/teams/$orgId/athletes/$userId"
      params={{ orgId, userId }}
      preload="intent"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate({ to: "/coach/teams/$orgId/athletes/$userId", params: { orgId, userId } });
      }}
      className={className}
    >
      {children}
    </Link>
  );
}
