import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteOrgAthlete } from "@/lib/organizations/athlete-admin.functions";
import { Trash2 } from "lucide-react";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Activity,
  AlertTriangle,
  Dumbbell,
  Users,
  Scale,
  ListChecks,
  ClipboardList,
} from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { MacroTargetsCard } from "@/components/bodyfuel/MacroTargetsCard";
import { NutritionTargetsEditor } from "@/components/bodyfuel/NutritionTargetsEditor";
import { PlanManagementCard } from "@/components/bodyfuel/PlanManagementCard";
import { TrainingPlanManagementCard } from "@/components/bodyfuel/TrainingPlanManagementCard";
import {
  getCoachAthleteDetail,
  type CoachAthleteDetail,
} from "@/lib/organizations/coach-athlete-drilldown.functions";

export const Route = createFileRoute("/coach/teams/$orgId/athletes/$userId")({
  head: () => ({ meta: [{ title: "Athletenanalyse — BODYFUEL Coach" }] }),
  component: () => (
    <AppLayout>
      <AthleteDrilldown />
    </AppLayout>
  ),
});

function AthleteDrilldown() {
  const { orgId, userId } = Route.useParams();
  const fetch = useServerFn(getCoachAthleteDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["coach-athlete-detail", orgId, userId],
    queryFn: () => fetch({ data: { orgId, userId } }),
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Athletenanalyse wird geladen…</div>;
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-3">
      <BackLink orgId={orgId} />

      <Header data={data} />
      <BuilderActions orgId={orgId} userId={userId} />
      <CoachSummary data={data} />
      <AthleteNutritionBuilder userId={userId} />
      <AthleteTrainingBuilder userId={userId} />
      <AthletePulse data={data} />
      <RadarTriggers data={data} />
      <Development data={data} />
      <StrengthAnalysis data={data} />
      <TrainingActivity data={data} />
      <ComplianceBlock data={data} />
      <BodyData data={data} />
      <OpenItems data={data} />
      <CoachActions />
      <DangerZone orgId={orgId} userId={userId} displayName={data.athlete.display_name} />
    </div>
  );
}

// ---------- back link ----------
function BackLink({ orgId }: { orgId: string }) {
  return (
    <Link
      to="/coach/teams/$orgId"
      params={{ orgId }}
      className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Zurück zur Teamanalyse
    </Link>
  );
}

// ---------- header ----------
function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-lg font-bold text-primary">
      {initials || "?"}
    </div>
  );
}

const STATUS_TONE: Record<CoachAthleteDetail["status"]["key"], string> = {
  critical: "bg-red-500/15 text-red-500 border-red-500/30",
  attention: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  watch: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  stable: "bg-muted text-muted-foreground border-border",
  positive: "bg-green-500/15 text-green-500 border-green-500/30",
};

function Header({ data }: { data: CoachAthleteDetail }) {
  const a = data.athlete;
  const jersey = a.jersey_number != null ? `#${a.jersey_number}` : null;
  const pos = [a.position, a.secondary_position].filter(Boolean).join(" · ");
  const base: string[] = [];
  if (a.age != null) base.push(`${a.age} Jahre`);
  if (a.height_cm != null) base.push(`${a.height_cm} cm`);
  if (a.current_weight_kg != null) base.push(`${a.current_weight_kg.toFixed(1)} kg`);
  return (
    <section>
      <div className="flex items-start gap-3">
        <Initials name={a.display_name} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold uppercase leading-tight tracking-tight">
            {a.display_name}
          </h1>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {[pos || "—", jersey, a.team_name].filter(Boolean).join(" · ")}
          </div>
          {base.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {base.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${
            STATUS_TONE[data.status.key]
          }`}
        >
          {data.status.label}
        </span>
      </div>
    </section>
  );
}

// ---------- coach summary ----------
function CoachSummary({ data }: { data: CoachAthleteDetail }) {
  return (
    <Section title="Coach Summary" icon={<ClipboardList className="h-4 w-4" />}>
      <div className="rounded-lg border border-border bg-card p-4">
        {data.summary.data_sparse ? (
          <p className="text-sm text-muted-foreground">
            Noch nicht genügend Daten für eine vollständige Analyse.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm leading-relaxed">
            {data.summary.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

// ---------- pulse ----------
function AthletePulse({ data }: { data: CoachAthleteDetail }) {
  const p = data.pulse;
  return (
    <Section title="Athleten-Pulse" icon={<Activity className="h-4 w-4" />}>
      <div className="grid grid-cols-2 gap-2.5">
        <PulseCell
          label="Compliance"
          value={p.compliance != null ? `${p.compliance} %` : "—"}
          delta={p.compliance_delta}
          suffix=" Pp"
        />
        <PulseCell
          label="Trainingsaktivität"
          value={p.training_activity != null ? `${p.training_activity} %` : "—"}
          delta={p.training_activity_delta}
          suffix=" %"
        />
        <PulseCell
          label="Athletik"
          value={p.strength_score != null ? String(p.strength_score) : "—"}
          delta={p.strength_score_delta}
          suffix={
            p.strength_score_span_weeks != null
              ? ` Pkt / ${p.strength_score_span_weeks} Wo`
              : " Pkt"
          }
        />
        <PulseCell
          label="Aktivität"
          value={
            p.last_active_days == null
              ? "—"
              : p.last_active_days === 0
              ? "heute"
              : p.last_active_days === 1
              ? "gestern"
              : `vor ${p.last_active_days} Tagen`
          }
          delta={null}
          suffix=""
        />
      </div>
    </Section>
  );
}

function PulseCell({
  label,
  value,
  delta,
  suffix,
}: {
  label: string;
  value: string;
  delta: number | null;
  suffix: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 font-display text-lg font-bold">{value}</div>
      {delta != null && <TrendChip delta={delta} suffix={suffix} />}
    </div>
  );
}

function TrendChip({ delta, suffix }: { delta: number; suffix: string }) {
  if (delta === 0) {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        <Minus className="h-3 w-3" /> ±0{suffix}
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        up ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
      }`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}
      {delta}
      {suffix}
    </span>
  );
}

// ---------- radar triggers ----------
function RadarTriggers({ data }: { data: CoachAthleteDetail }) {
  return (
    <Section title="Coach Radar · Warum sehe ich diesen Spieler?" icon={<AlertTriangle className="h-4 w-4" />}>
      {data.radar_triggers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          Aktuell keine ausgelösten Regeln. Der Athlet ist analytisch unauffällig.
        </div>
      ) : (
        <ul className="space-y-2">
          {data.radar_triggers.map((t, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
            >
              <span className="mt-0.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {t.label}
              </span>
              <span className="text-sm">{t.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---------- development / sparklines ----------
function Development({ data }: { data: CoachAthleteDetail }) {
  const [range, setRange] = useState<"30d" | "12w" | "saison">("30d");
  const series = useMemo(() => {
    const cutoff = new Date();
    const days = range === "30d" ? 30 : range === "12w" ? 84 : 365;
    cutoff.setDate(cutoff.getDate() - days);
    return data.weight_series.filter((w) => new Date(w.measured_at) >= cutoff);
  }, [data.weight_series, range]);

  return (
    <Section title="Entwicklung" icon={<Activity className="h-4 w-4" />}>
      <div className="mb-2 flex gap-1.5">
        {(["30d", "12w", "saison"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              range === r
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {r === "30d" ? "30 Tage" : r === "12w" ? "12 Wochen" : "Saison"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <MiniLine
          label="Gewicht"
          unit="kg"
          points={series.map((w) => ({ t: new Date(w.measured_at).getTime(), v: w.weight_kg }))}
          trend={data.weight_trend_kg_30d}
          trendLabel="30 Tage"
        />
        <MetricRow
          label="Wochen-Compliance"
          value={data.compliance.current_week != null ? `${data.compliance.current_week} %` : "—"}
          sub={
            data.compliance.four_week_avg != null
              ? `Ø 4 Wochen: ${data.compliance.four_week_avg} %`
              : "keine Vergleichsdaten"
          }
        />
        <MetricRow
          label="Trainingsaktivität"
          value={
            data.pulse.training_activity != null ? `${data.pulse.training_activity} %` : "—"
          }
          sub={
            data.pulse.training_activity_delta != null
              ? `${data.pulse.training_activity_delta > 0 ? "+" : ""}${data.pulse.training_activity_delta} % ggü. Vorwoche`
              : "keine Vergleichsdaten"
          }
        />
        {data.pulse.strength_score != null && (
          <MetricRow
            label="Strength Score"
            value={String(data.pulse.strength_score)}
            sub={
              data.pulse.strength_score_delta != null && data.pulse.strength_score_span_weeks != null
                ? `${data.pulse.strength_score_delta > 0 ? "+" : ""}${data.pulse.strength_score_delta} Pkt / ${data.pulse.strength_score_span_weeks} Wo`
                : "eine Testung vorhanden"
            }
          />
        )}
      </div>
    </Section>
  );
}

function MetricRow({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </div>
      <div className="font-display text-lg font-bold">{value}</div>
    </div>
  );
}

function MiniLine({
  label,
  unit,
  points,
  trend,
  trendLabel,
}: {
  label: string;
  unit: string;
  points: Array<{ t: number; v: number }>;
  trend: number | null;
  trendLabel: string;
}) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Keine Daten im Zeitraum.</div>
      </div>
    );
  }
  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const spread = Math.max(0.1, max - min);
  const W = 300;
  const H = 60;
  const xFor = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const yFor = (v: number) => H - ((v - min) / spread) * (H - 4) - 2;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(p.v).toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </div>
          <div className="font-display text-lg font-bold">
            {last.v.toFixed(1)} {unit}
          </div>
        </div>
        {trend != null && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Trend {trendLabel}
            </div>
            <div
              className={`text-sm font-bold ${
                trend === 0
                  ? "text-muted-foreground"
                  : trend > 0
                  ? "text-foreground"
                  : "text-foreground"
              }`}
            >
              {trend > 0 ? "↑ +" : trend < 0 ? "↓ " : "→ "}
              {Math.abs(trend).toFixed(1)} {unit}
            </div>
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.v)}
            r={i === 0 || i === points.length - 1 ? 2.5 : 1.5}
            className="fill-primary"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>
          {new Date(first.t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ·{" "}
          {first.v.toFixed(1)} {unit}
        </span>
        <span>
          {new Date(last.t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ·{" "}
          {last.v.toFixed(1)} {unit}
        </span>
      </div>
    </div>
  );
}

// ---------- strength ----------
function StrengthAnalysis({ data }: { data: CoachAthleteDetail }) {
  const s = data.strength;
  if (!s) return null;
  return (
    <Section title="Athletik" icon={<Dumbbell className="h-4 w-4" />}>
      <div className="space-y-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Overall
              </div>
              <div className="font-display text-2xl font-bold">{s.overall ?? "—"}</div>
              {s.last_test_at && (
                <div className="text-[11px] text-muted-foreground">
                  letzte Testung:{" "}
                  {new Date(s.last_test_at).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </div>
              )}
            </div>
            {s.overall_delta != null && (
              <TrendChip delta={s.overall_delta} suffix=" Pkt" />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {s.categories.map((c) => (
            <div key={c.key} className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {c.label}
              </div>
              <div className="mt-1 flex items-end justify-between">
                <div className="font-display text-xl font-bold">{c.score ?? "—"}</div>
                {c.delta != null ? <TrendChip delta={c.delta} suffix="" /> : null}
              </div>
              {c.confidence != null && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Confidence: {Math.round(c.confidence * 100)} %
                </div>
              )}
            </div>
          ))}
        </div>
        {(s.biggest_gain || s.biggest_loss) && (
          <div className="grid grid-cols-2 gap-2">
            {s.biggest_gain && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-green-600">
                  Stärkste Entwicklung
                </div>
                <div className="mt-0.5 text-sm font-semibold">
                  {s.biggest_gain.label} · +{s.biggest_gain.delta}
                </div>
              </div>
            )}
            {s.biggest_loss && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                  Geringste Entwicklung
                </div>
                <div className="mt-0.5 text-sm font-semibold">
                  {s.biggest_loss.label} · {s.biggest_loss.delta}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

// ---------- training ----------
function TrainingActivity({ data }: { data: CoachAthleteDetail }) {
  const t = data.training;
  return (
    <Section title="Training · letzte 30 Tage" icon={<Dumbbell className="h-4 w-4" />}>
      <div className="grid grid-cols-4 gap-2">
        <TinyStat label="Zugewiesen" value={t.assigned} />
        <TinyStat label="Abgeschl." value={t.done} tone="green" />
        <TinyStat label="Offen" value={t.open} tone="yellow" />
        <TinyStat label="Ausgel." value={t.missed} tone="red" />
      </div>
      <div className="mt-2 rounded-lg border border-border bg-card p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Abschlussquote
        </div>
        <div className="mt-0.5 font-display text-xl font-bold">
          {t.completion_rate != null ? `${t.completion_rate} %` : "—"}
        </div>
      </div>
      {t.timeline.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {t.timeline.map((item) => {
            const dateStr = new Date(item.date).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
            });
            const statusLabel =
              item.status === "done"
                ? "Abgeschlossen"
                : item.status === "missed"
                ? "Ausgelassen"
                : item.status === "open"
                ? "Offen"
                : "—";
            const statusCls =
              item.status === "done"
                ? "text-green-500"
                : item.status === "missed"
                ? "text-red-500"
                : "text-yellow-600";
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {dateStr}
                  </div>
                  <div className="truncate text-sm font-semibold">{item.title}</div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${statusCls}`}>
                  {statusLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function TinyStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "yellow" | "red";
}) {
  const cls =
    tone === "green"
      ? "text-green-500"
      : tone === "yellow"
      ? "text-yellow-600"
      : tone === "red"
      ? "text-red-500"
      : "";
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 text-center">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`font-display text-lg font-bold ${cls}`}>{value}</div>
    </div>
  );
}

// ---------- compliance ----------
function ComplianceBlock({ data }: { data: CoachAthleteDetail }) {
  const c = data.compliance;
  return (
    <Section title="Compliance" icon={<Users className="h-4 w-4" />}>
      <div className="grid grid-cols-2 gap-2">
        <TinyMetric label="Aktuelle Woche" value={fmtPct(c.current_week)} />
        <TinyMetric label="Vorwoche" value={fmtPct(c.prev_week)} />
        <TinyMetric label="Ø 4 Wochen" value={fmtPct(c.four_week_avg)} />
        <TinyMetric label="Team" value={fmtPct(c.team_avg)} />
      </div>
      {c.diff_to_team != null && (
        <div className="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {c.diff_to_team === 0
            ? "Auf Teamdurchschnitt."
            : c.diff_to_team > 0
            ? `${c.diff_to_team} Prozentpunkte über Teamdurchschnitt.`
            : `${Math.abs(c.diff_to_team)} Prozentpunkte unter Teamdurchschnitt.`}
        </div>
      )}
    </Section>
  );
}

function TinyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-display text-lg font-bold">{value}</div>
    </div>
  );
}

function fmtPct(v: number | null) {
  return v == null ? "—" : `${v} %`;
}

// ---------- body data ----------
function BodyData({ data }: { data: CoachAthleteDetail }) {
  const a = data.athlete;
  if (a.height_cm == null && a.current_weight_kg == null && data.weight_series.length === 0) {
    return null;
  }
  return (
    <Section title="Körperdaten" icon={<Scale className="h-4 w-4" />}>
      <div className="grid grid-cols-2 gap-2">
        <TinyMetric
          label="Körpergröße"
          value={a.height_cm != null ? `${a.height_cm} cm` : "—"}
        />
        <TinyMetric
          label="Aktuelles Gewicht"
          value={a.current_weight_kg != null ? `${a.current_weight_kg.toFixed(1)} kg` : "—"}
        />
      </div>
      {a.weight_measured_at && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          zuletzt aktualisiert:{" "}
          {new Date(a.weight_measured_at).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </div>
      )}
      {data.weight_trend_kg_30d != null && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          Trend 30 Tage:{" "}
          {data.weight_trend_kg_30d > 0 ? "↑ +" : data.weight_trend_kg_30d < 0 ? "↓ " : "→ "}
          {Math.abs(data.weight_trend_kg_30d).toFixed(1)} kg
        </div>
      )}
    </Section>
  );
}

// ---------- open items ----------
function OpenItems({ data }: { data: CoachAthleteDetail }) {
  if (data.open_items.length === 0) return null;
  return (
    <Section title="Offene Punkte" icon={<ListChecks className="h-4 w-4" />}>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {data.open_items.map((i) => (
          <li key={i.label} className="flex items-center justify-between px-3 py-2.5">
            <span className="text-sm">{i.label}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">
              {i.count}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ---------- coach actions ----------
function BuilderActions({ orgId, userId }: { orgId: string; userId: string }) {
  return (
    <Section title="Builder" icon={<ClipboardList className="h-4 w-4" />}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          to="/coach/plan-builder/$userId"
          params={{ userId }}
          search={{ orgId }}
          className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40"
        >
          <div className="text-sm font-semibold">Ernährungsplan erstellen</div>
          <div className="mt-1 text-[11px] text-muted-foreground">BODYFUEL Plan-Builder mit allen Gerichten.</div>
        </Link>
        <Link
          to="/coach/training-builder/$userId"
          params={{ userId }}
          search={{ orgId }}
          className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40"
        >
          <div className="text-sm font-semibold">Trainingsplan erstellen</div>
          <div className="mt-1 text-[11px] text-muted-foreground">BODYFUEL Trainings-Builder mit allen Übungen.</div>
        </Link>
      </div>
    </Section>
  );
}

function AthleteNutritionBuilder({ userId }: { userId: string }) {
  return (
    <Section title="Ernährung" icon={<ListChecks className="h-4 w-4" />}>
      <div className="space-y-3">
        <MacroTargetsCard userId={userId} />
        <NutritionTargetsEditor userId={userId} />
        <PlanManagementCard userId={userId} returnOrgId={Route.useParams().orgId} />
      </div>
    </Section>
  );
}

function AthleteTrainingBuilder({ userId }: { userId: string }) {
  return (
    <Section title="Training" icon={<Dumbbell className="h-4 w-4" />}>
      <TrainingPlanManagementCard userId={userId} returnOrgId={Route.useParams().orgId} />
    </Section>
  );
}

function CoachActions() {
  return (
    <Section title="Coach Aktionen" icon={<ClipboardList className="h-4 w-4" />}>
      <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
        Aufgaben wie Check-ins oder manuelle Team-To-dos werden weiterhin im Team-Bereich geplant.
      </div>
    </Section>
  );
}

// ---------- shared ----------
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
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
        Löscht {displayName} vollständig aus der Plattform: Profil, Zugang, alle
        Trainings-, Ernährungs- und Vereinsdaten. Diese Aktion kann nicht rückgängig
        gemacht werden.
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
