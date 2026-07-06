import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAthletePerformanceProfile } from "@/lib/performance/performance.functions";
import { getOrganizationBySlug } from "@/lib/organizations/organizations.functions";

export const Route = createFileRoute("/$orgSlug/performance")({
  head: () => ({ meta: [{ title: "Performance Profile" }] }),
  component: () => (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <AthletePerformancePage />
      </div>
    </div>
  ),
});

function AthletePerformancePage() {
  const { orgSlug } = Route.useParams();
  const fetchOrg = useServerFn(getOrganizationBySlug);
  const orgQ = useQuery({ queryKey: ["org", orgSlug], queryFn: () => fetchOrg({ data: { slug: orgSlug } }) });
  const orgId = orgQ.data?.id;

  const fetchProfile = useServerFn(getAthletePerformanceProfile);
  const profQ = useQuery({
    queryKey: ["perf-athlete", orgId],
    queryFn: () => fetchProfile({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  if (orgQ.isLoading || profQ.isLoading) return <div className="text-sm text-muted-foreground">Laden…</div>;

  const p = profQ.data?.profile;

  if (!p) {
    return (
      <div className="space-y-4">
        <Link to="/$orgSlug/home" params={{ orgSlug }} className="text-xs uppercase tracking-widest text-muted-foreground">← Home</Link>
        <h1 className="font-display text-2xl font-bold">Performance</h1>
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <div className="font-semibold">Noch keine Performance-Baseline</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Sobald ein Coach die erste Test-Session mit dir abschließt, erscheinen hier deine Werte.
          </p>
        </div>
      </div>
    );
  }

  const domains = profQ.data?.metricDefinitions ? (profQ.data?.domains ?? []) : [];
  const domainScores = profQ.data?.domainScores ?? [];
  const metricScores = profQ.data?.metricScores ?? [];
  const metricDefs = profQ.data?.metricDefinitions ?? [];
  const focus = profQ.data?.focusAreas ?? [];
  const nextRetest = profQ.data?.nextRetest ?? null;

  const availableResults = metricScores.filter((s) => s.selected_value != null);
  const missingMetrics = metricDefs
    .filter((d) => d.active !== false)
    .filter((d) => !metricScores.find((s) => s.metric_definition_id === d.id && s.selected_value != null));

  const hasOverall = p.overall_score != null;

  return (
    <div className="space-y-6">
      <Link to="/$orgSlug/home" params={{ orgSlug }} className="text-xs uppercase tracking-widest text-muted-foreground">← Home</Link>
      <header>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Performance</div>
        <h1 className="font-display text-2xl font-bold">
          {hasOverall ? "Dein Gesamtprofil" : "Performance Baseline aufgezeichnet"}
        </h1>
        {!hasOverall && (
          <p className="mt-1 text-sm text-muted-foreground">
            Deine ersten Performance-Werte wurden gespeichert. Ein Gesamtprofil steht noch nicht zur Verfügung.
          </p>
        )}
      </header>

      {hasOverall && (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-baseline gap-4">
            <div className="text-5xl font-bold tabular-nums">{Number(p.overall_score).toFixed(0)}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Profil-Score</div>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>Coverage: {p.data_coverage != null ? `${Math.round(Number(p.data_coverage) * 100)} %` : "—"}</span>
            <span>Confidence: {p.confidence ?? "—"}</span>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Interner strukturierter Profilwert. Keine prozentuale Leistungsfähigkeit.
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <Stat label="Coverage" value={p.data_coverage != null ? `${Math.round(Number(p.data_coverage) * 100)} %` : "—"} />
        <Stat label="Nächster Retest" value={nextRetest?.next_retest_due ? formatDaysUntil(nextRetest.next_retest_due) : "—"} />
      </section>

      <section>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Available Results</div>
        {availableResults.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Noch keine Ergebnisse.
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {availableResults.map((s) => {
              const def = metricDefs.find((d) => d.id === s.metric_definition_id);
              return (
                <li key={s.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{def?.name ?? "Metric"}</div>
                  <div className="mt-1 text-xl font-bold tabular-nums">
                    {Number(s.selected_value).toFixed(2)} <span className="text-xs text-muted-foreground">{def?.unit ?? ""}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {hasOverall && domainScores.length > 0 && (
        <section>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Performance Domains</div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {domains.filter((d) => d.active).map((d) => {
              const ds = domainScores.find((s) => s.domain_id === d.id);
              return (
                <li key={d.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{d.name}</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{ds?.score != null ? Number(ds.score).toFixed(0) : "—"}</div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {missingMetrics.length > 0 && (
        <section>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Missing</div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {missingMetrics.map((m) => (<li key={m.id}>· {m.name}</li>))}
          </ul>
        </section>
      )}

      {focus.filter((f) => f.status !== "dismissed").length > 0 && (
        <section>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Fokus</div>
          <ol className="space-y-2">
            {focus.filter((f) => f.status !== "dismissed").map((f) => (
              <li key={f.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                <div className="font-semibold">{f.label}</div>
                <div className="text-xs text-muted-foreground">
                  Quelle: {f.source === "coach" ? "Coach" : "BodyFuel Engine"}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function formatDaysUntil(dateStr: string): string {
  const days = Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Retest fällig";
  return `${days} Tage`;
}
