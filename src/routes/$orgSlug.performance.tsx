import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAthletePerformanceProfile } from "@/lib/performance/performance.functions";
import { getOrganizationBySlug } from "@/lib/organizations/organizations.functions";

export const Route = createFileRoute("/$orgSlug/performance")({
  head: () => ({ meta: [{ title: "Performance Profile" }] }),
  component: () => (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      <div className="mx-auto max-w-3xl p-4">
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

  const orgId = orgQ.data?.organization?.id;
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
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Performance Profile</h1>
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <div className="font-semibold">Noch kein Performance-Profil</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Dein erstes Performance-Testing wurde noch nicht vollständig abgeschlossen. Sobald ein Coach eine
            Test-Session mit dir abschließt, erscheint hier dein Profil.
          </p>
        </div>
      </div>
    );
  }

  const domains = profQ.data?.domains ?? [];
  const domainScores = profQ.data?.domainScores ?? [];
  const focus = profQ.data?.focusAreas ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Performance Profile</div>
        <h1 className="font-display text-2xl font-bold">Dein Gesamtprofil</h1>
      </header>

      <section className="rounded-lg border border-border bg-card p-5">
        {p.overall_score == null ? (
          <div className="text-sm">
            <div className="font-semibold">Performance-Setup läuft</div>
            <p className="mt-1 text-muted-foreground">
              Noch nicht genug Daten oder Setup unvollständig. Score wird erst angezeigt, wenn die Konfiguration valide ist.
            </p>
          </div>
        ) : (
          <>
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
          </>
        )}
      </section>

      <section>
        <div className="font-display font-bold mb-2">Performance Domains</div>
        {domainScores.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Keine Domain-Scores verfügbar.
          </div>
        ) : (
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
        )}
      </section>

      <section>
        <div className="font-display font-bold mb-2">Dein Fokus</div>
        {focus.filter((f) => f.status !== "dismissed").length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Noch keine Fokusbereiche.
          </div>
        ) : (
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
        )}
      </section>
    </div>
  );
}
