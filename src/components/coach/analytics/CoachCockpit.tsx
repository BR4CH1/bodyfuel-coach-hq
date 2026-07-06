import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  AlertTriangle,
  Eye,
  TrendingUp,
  Users,
  Dumbbell,
} from "lucide-react";
import { getOrgCoachAnalytics, type CoachAnalytics } from "@/lib/organizations/coach-analytics.functions";
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
      <CoachRadar data={data} />
      <PositionGroupsAnalysis data={data} />
      <AttentionList data={data} />
      {data.data_sparse && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          Datengrundlage ist noch dünn. Sobald mehr Trainings, Tasks und Check-ins vorliegen,
          werden Trend- und Vergleichswerte belastbarer.
        </div>
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

function CoachRadar({ data }: { data: CoachAnalytics }) {
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
          <RadarBucket title="Kritisch" tone="red" items={critical} />
          <RadarBucket title="Beobachten" tone="yellow" items={watch} />
          <RadarBucket title="Positiv" tone="green" items={positive} />
        </div>
      )}
    </section>
  );
}

function RadarBucket({
  title, tone, items,
}: { title: string; tone: "red" | "yellow" | "green"; items: CoachAnalytics["radar"]["critical"] }) {
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
              <div className="font-semibold">{it.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {it.position ?? "—"} · {it.reason}
              </div>
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
      <div className="overflow-hidden rounded-lg border border-border bg-card">
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

function AttentionList({ data }: { data: CoachAnalytics }) {
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
            <li key={a.user_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
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
