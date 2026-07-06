import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import {
  getOrgPerformanceFramework,
  createBattery,
  createTestDefinition,
  createMetricDefinition,
  upsertDomainMetricWeight,
  upsertPositionDomainWeight,
  listPerformanceSessions,
  createPerformanceSession,
  getPerformanceSession,
  addTestAttempt,
  invalidateAttempt,
  completePerformanceSession,
  getPerformanceTeamMatrix,
} from "@/lib/performance/performance.functions";
import { getOrgCoachDetail } from "@/lib/organizations/athlete.functions";
import { selectPerformanceResult, type Direction, type ResultSelectionMethod } from "@/lib/performance";

export const Route = createFileRoute("/coach/teams/$orgId/performance")({
  head: () => ({ meta: [{ title: "Performance — BODYFUEL Coach" }] }),
  component: () => (
    <AppLayout>
      <CoachPerformancePage />
    </AppLayout>
  ),
});

type Tab = "overview" | "matrix" | "sessions" | "framework";

function CoachPerformancePage() {
  const { orgId } = Route.useParams();
  const [tab, setTab] = useState<Tab>("overview");

  const fetchFramework = useServerFn(getOrgPerformanceFramework);
  const frameworkQ = useQuery({
    queryKey: ["perf-fw", orgId],
    queryFn: () => fetchFramework({ data: { organization_id: orgId } }),
  });

  const fetchDetail = useServerFn(getOrgCoachDetail);
  const detailQ = useQuery({
    queryKey: ["org-detail", orgId],
    queryFn: () => fetchDetail({ data: { organization_id: orgId } }),
  });

  const fw = frameworkQ.data;
  const readiness = useMemo(() => computeReadiness(fw), [fw]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            <Link to="/coach/teams/$orgId" params={{ orgId }}>← Organisation</Link>
          </div>
          <h1 className="font-display text-2xl font-bold">Performance</h1>
          <p className="text-sm text-muted-foreground">
            Generische Multi-Sport Performance Engine V1 · {detailQ.data?.organization?.name ?? ""}
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-border pb-2">
        {(["overview", "matrix", "sessions", "framework"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            {tabLabel(t)}
          </button>
        ))}
      </nav>

      {frameworkQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Laden…</div>
      ) : !fw?.framework ? (
        <EmptyFrameworkState orgId={orgId} />
      ) : (
        <>
          {tab === "overview" && <OverviewPanel readiness={readiness} fw={fw} orgId={orgId} />}
          {tab === "matrix" && <TeamMatrixPanel orgId={orgId} />}
          {tab === "sessions" && <SessionsPanel orgId={orgId} fw={fw} />}
          {tab === "framework" && <FrameworkBuilderPanel orgId={orgId} fw={fw} onChange={() => frameworkQ.refetch()} />}
        </>
      )}
    </div>
  );
}

function tabLabel(t: Tab) {
  return { overview: "Übersicht", matrix: "Team-Matrix", sessions: "Test-Sessions", framework: "Framework" }[t];
}

// ============================================================
// READINESS
// ============================================================

type FrameworkData = Awaited<ReturnType<typeof getOrgPerformanceFramework>>;

function computeReadiness(fw: FrameworkData | undefined) {
  if (!fw?.framework) return { state: "MISSING" as const, missing: ["framework"] };
  const missing: string[] = [];
  if (!fw.domains?.some((d) => d.active)) missing.push("Aktive Domains");
  if (!fw.batteries?.length) missing.push("Test-Battery");
  if (!fw.tests?.length) missing.push("Tests");
  if (!fw.metrics?.length) missing.push("Metriken");
  const hasActiveBenchmark = fw.benchmarks?.some((b) => b.status !== "draft") ?? false;
  if (!hasActiveBenchmark) missing.push("Benchmark-Modell (kein aktives Modell)");
  if (!fw.positions?.some((p) => p.status === "active")) missing.push("Aktives Position-Profile");
  const state = missing.length === 0 ? "READY" : fw.framework.status === "active" ? "ACTIVE" : "SETUP_REQUIRED";
  return { state, missing };
}

function EmptyFrameworkState({ orgId }: { orgId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <div className="font-display text-lg font-bold">Kein Performance-Framework</div>
      <p className="mt-2 text-sm text-muted-foreground">
        Für diese Organisation ist noch kein Framework konfiguriert. Frage einen Super-Admin an, ein Draft-Framework
        anzulegen. Organization ID: <code className="rounded bg-secondary px-1">{orgId}</code>
      </p>
    </div>
  );
}

// ============================================================
// OVERVIEW
// ============================================================

function OverviewPanel({ readiness, fw, orgId }: { readiness: ReturnType<typeof computeReadiness>; fw: FrameworkData; orgId: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Framework</div>
            <div className="font-display text-lg font-bold">{fw?.framework?.name}</div>
            <div className="text-xs text-muted-foreground">Sport: {fw?.framework?.sport} · Version {fw?.framework?.version} · Status {fw?.framework?.status}</div>
          </div>
          <ReadinessBadge state={readiness.state} />
        </div>
        {readiness.missing.length > 0 && (
          <div className="mt-4 rounded-md bg-secondary p-3 text-sm">
            <div className="font-semibold">Setup erforderlich</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {readiness.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Domains" value={fw?.domains?.filter((d) => d.active).length ?? 0} />
        <Stat label="Batteries" value={fw?.batteries?.length ?? 0} />
        <Stat label="Tests" value={fw?.tests?.length ?? 0} />
        <Stat label="Metriken" value={fw?.metrics?.length ?? 0} />
        <Stat label="Positions (Draft)" value={fw?.positions?.filter((p) => p.status === "draft").length ?? 0} />
        <Stat label="Positions (Aktiv)" value={fw?.positions?.filter((p) => p.status === "active").length ?? 0} />
        <Stat label="Benchmarks" value={fw?.benchmarks?.length ?? 0} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Der Performance-Profile-Score ist ein interner strukturierter Profilwert (0–100) und keine prozentuale
        Leistungsfähigkeit. Keine medizinischen Aussagen. Keine erfundenen Normwerte. Position-Weightings werden erst
        aktiv nach fachlicher Freigabe.
      </div>
    </div>
  );
}

function ReadinessBadge({ state }: { state: string }) {
  const color = state === "READY" || state === "ACTIVE" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/20 text-amber-700 dark:text-amber-300";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-widest ${color}`}>{state === "READY" ? "READY FOR TESTING" : state === "ACTIVE" ? "ACTIVE" : "SETUP REQUIRED"}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

// ============================================================
// TEAM MATRIX
// ============================================================

function TeamMatrixPanel({ orgId }: { orgId: string }) {
  const fetchMatrix = useServerFn(getPerformanceTeamMatrix);
  const q = useQuery({ queryKey: ["perf-matrix", orgId], queryFn: () => fetchMatrix({ data: { organization_id: orgId } }) });
  const fetchFw = useServerFn(getOrgPerformanceFramework);
  const fwQ = useQuery({ queryKey: ["perf-fw", orgId], queryFn: () => fetchFw({ data: { organization_id: orgId } }) });

  const domains = fwQ.data?.domains?.filter((d) => d.active) ?? [];
  const profiles = q.data?.profiles ?? [];
  const users = q.data?.users ?? [];
  const domainScores = q.data?.domainScores ?? [];
  const memberships = q.data?.memberships ?? [];

  const userName = (id: string) => users.find((u) => u.user_id === id)?.name ?? id.slice(0, 8);
  const positionOf = (id: string) => memberships.find((m) => m.user_id === id)?.position ?? "–";
  const scoreFor = (profileId: string, domainId: string) => domainScores.find((s) => s.profile_id === profileId && s.domain_id === domainId)?.score ?? null;

  if (q.isLoading) return <div className="text-sm text-muted-foreground">Laden…</div>;
  if (profiles.length === 0) return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Noch keine Performance-Profile. Nach dem ersten abgeschlossenen Test erscheinen hier Athleten.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="min-w-full text-sm">
        <thead className="bg-secondary text-xs uppercase tracking-widest">
          <tr>
            <th className="px-3 py-2 text-left">Athlet</th>
            <th className="px-3 py-2 text-left">Pos</th>
            <th className="px-3 py-2 text-right">Overall</th>
            <th className="px-3 py-2 text-right">Coverage</th>
            <th className="px-3 py-2 text-left">Conf.</th>
            {domains.map((d) => (
              <th key={d.id} className="px-3 py-2 text-right">{d.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <td className="px-3 py-2">{userName(p.user_id)}</td>
              <td className="px-3 py-2">{positionOf(p.user_id)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{p.overall_score != null ? Number(p.overall_score).toFixed(0) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{p.data_coverage != null ? `${Math.round(Number(p.data_coverage) * 100)} %` : "—"}</td>
              <td className="px-3 py-2">{p.confidence ?? "—"}</td>
              {domains.map((d) => {
                const s = scoreFor(p.id, d.id);
                return <td key={d.id} className="px-3 py-2 text-right tabular-nums">{s != null ? Number(s).toFixed(0) : "—"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// SESSIONS
// ============================================================

function SessionsPanel({ orgId, fw }: { orgId: string; fw: FrameworkData }) {
  const fetchList = useServerFn(listPerformanceSessions);
  const q = useQuery({ queryKey: ["perf-sessions", orgId], queryFn: () => fetchList({ data: { organization_id: orgId } }) });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Performance-Test-Sessions dieser Organisation.</div>
        <button
          onClick={() => setWizardOpen((v) => !v)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
        >
          {wizardOpen ? "Abbrechen" : "+ Session"}
        </button>
      </div>

      {wizardOpen && <SessionWizard orgId={orgId} fw={fw} onDone={() => { setWizardOpen(false); q.refetch(); }} />}

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Laden…</div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Noch keine Sessions.</div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {(q.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.test_date} · {s.status}</div>
              </div>
              <button onClick={() => setOpenId(openId === s.id ? null : s.id)} className="text-sm text-primary underline">
                {openId === s.id ? "Schließen" : "Öffnen"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {openId && <SessionLiveEntry sessionId={openId} onCompleted={() => { setOpenId(null); q.refetch(); }} />}
    </div>
  );
}

function SessionWizard({ orgId, fw, onDone }: { orgId: string; fw: FrameworkData; onDone: () => void }) {
  const [name, setName] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [batteryId, setBatteryId] = useState(fw?.batteries?.[0]?.id ?? "");
  const [athleteIds, setAthleteIds] = useState("");
  const create = useServerFn(createPerformanceSession);
  const m = useMutation({
    mutationFn: () =>
      create({
        data: {
          organization_id: orgId,
          battery_id: batteryId,
          name,
          test_date: testDate,
          athlete_user_ids: athleteIds.split(",").map((s) => s.trim()).filter(Boolean),
        },
      }),
    onSuccess: onDone,
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="font-semibold">Neue Test-Session</div>
      <label className="block text-sm">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background p-2" placeholder="z. B. Bulls Preseason 2026" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Datum
          <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background p-2" />
        </label>
        <label className="block text-sm">
          Test-Battery
          <select value={batteryId} onChange={(e) => setBatteryId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background p-2">
            <option value="">— wählen —</option>
            {(fw?.batteries ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.status})</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        Athlet-User-IDs (kommagetrennt)
        <textarea value={athleteIds} onChange={(e) => setAthleteIds(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background p-2 h-20 font-mono text-xs" placeholder="uuid1, uuid2, …" />
      </label>
      <button
        disabled={!name || !batteryId || m.isPending}
        onClick={() => m.mutate()}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {m.isPending ? "Erstelle…" : "Session anlegen"}
      </button>
      {m.error && <div className="text-xs text-destructive">{(m.error as Error).message}</div>}
    </div>
  );
}

function SessionLiveEntry({ sessionId, onCompleted }: { sessionId: string; onCompleted: () => void }) {
  const fetchSession = useServerFn(getPerformanceSession);
  const q = useQuery({ queryKey: ["perf-session", sessionId], queryFn: () => fetchSession({ data: { session_id: sessionId } }) });
  const qc = useQueryClient();
  const addFn = useServerFn(addTestAttempt);
  const invFn = useServerFn(invalidateAttempt);
  const completeFn = useServerFn(completePerformanceSession);

  const [selectedAthlete, setSelectedAthlete] = useState<string>("");
  const [selectedTest, setSelectedTest] = useState<string>("");
  const [value, setValue] = useState<string>("");

  if (q.isLoading) return <div className="text-sm text-muted-foreground">Laden…</div>;
  if (!q.data) return null;
  const { session, tests, athletes, attempts } = q.data;

  const test = tests.find((t) => t.id === selectedTest);
  const attemptsForCombo = attempts.filter((a) => a.user_id === selectedAthlete && a.test_definition_id === selectedTest);
  const selected = test && attemptsForCombo.length > 0
    ? selectPerformanceResult({
        attempts: attemptsForCombo.map((a) => ({ id: a.id, raw_value: Number(a.raw_value), unit_snapshot: a.unit_snapshot, valid: a.valid, measured_at: a.measured_at })),
        method: (test.result_selection as ResultSelectionMethod) ?? "best",
        direction: (test.direction as Direction) ?? "higher_is_better",
        unit: test.unit,
      })
    : null;

  return (
    <div className="mt-3 rounded-lg border border-primary/40 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-lg font-bold">{session.name}</div>
          <div className="text-xs text-muted-foreground">{session.test_date} · Status: {session.status}</div>
        </div>
        {session.status !== "completed" && (
          <button
            onClick={async () => {
              const r = await completeFn({ data: { session_id: sessionId } });
              alert(`Fertig. Profile aktualisiert: ${r.profiles_updated}`);
              onCompleted();
            }}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white"
          >
            Session abschließen
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Athlet
          <select value={selectedAthlete} onChange={(e) => setSelectedAthlete(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background p-2">
            <option value="">—</option>
            {athletes.map((a) => (
              <option key={a.user_id} value={a.user_id}>{a.user_id.slice(0, 8)}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Test
          <select value={selectedTest} onChange={(e) => setSelectedTest(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background p-2">
            <option value="">—</option>
            {tests.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.unit})</option>
            ))}
          </select>
        </label>
      </div>

      {test && selectedAthlete && (
        <>
          <div className="rounded-md bg-secondary p-3 text-sm">
            <div className="font-semibold">Versuche</div>
            <ul className="mt-2 space-y-1">
              {attemptsForCombo.map((a) => (
                <li key={a.id} className={`flex items-center justify-between ${!a.valid ? "text-muted-foreground line-through" : ""}`}>
                  <span>#{a.attempt_number} · {a.raw_value} {a.unit_snapshot} · {new Date(a.measured_at).toLocaleTimeString()}</span>
                  {a.valid && (
                    <button
                      onClick={async () => {
                        const reason = prompt("Grund für Invalidierung?") ?? "";
                        if (!reason) return;
                        await invFn({ data: { attempt_id: a.id, reason } });
                        qc.invalidateQueries({ queryKey: ["perf-session", sessionId] });
                      }}
                      className="text-xs text-destructive underline"
                    >
                      Invalid markieren
                    </button>
                  )}
                </li>
              ))}
              {attemptsForCombo.length === 0 && <li className="text-muted-foreground">Noch keine Versuche.</li>}
            </ul>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`Wert in ${test.unit}`}
                className="flex-1 rounded-md border border-border bg-background p-2 text-sm"
              />
              <button
                disabled={!value}
                onClick={async () => {
                  await addFn({
                    data: {
                      session_id: sessionId,
                      user_id: selectedAthlete,
                      test_definition_id: selectedTest,
                      raw_value: Number(value),
                      unit_snapshot: test.unit,
                      attempt_number: attemptsForCombo.length + 1,
                      organization_id: session.organization_id,
                    },
                  });
                  setValue("");
                  qc.invalidateQueries({ queryKey: ["perf-session", sessionId] });
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                + Versuch
              </button>
            </div>
          </div>

          {selected && (
            <div className="rounded-md border border-border p-3 text-sm">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Selected Result</div>
              <div className="mt-1 font-bold">
                {selected.status === "OK" ? `${selected.selected_value} ${selected.unit}` : selected.status}
              </div>
              <div className="text-xs text-muted-foreground">Methode: {selected.selection_method}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// FRAMEWORK BUILDER
// ============================================================

function FrameworkBuilderPanel({ orgId, fw, onChange }: { orgId: string; fw: FrameworkData; onChange: () => void }) {
  const frameworkId = fw?.framework?.id ?? "";
  return (
    <div className="space-y-6">
      <DomainsBlock fw={fw} />
      <BatteriesBlock frameworkId={frameworkId} orgId={orgId} fw={fw} onChange={onChange} />
      <MetricsBlock frameworkId={frameworkId} fw={fw} onChange={onChange} />
      <DomainMetricWeightsBlock frameworkId={frameworkId} fw={fw} onChange={onChange} />
      <PositionsBlock fw={fw} onChange={onChange} />
      <BenchmarksBlock fw={fw} />
    </div>
  );
}

function DomainsBlock({ fw }: { fw: FrameworkData }) {
  return (
    <Section title="Domains" hint="Struktureller Rahmen. Änderungen an bereits verwendeten Frameworks nur über eine neue Version.">
      <ul className="divide-y divide-border">
        {(fw?.domains ?? []).map((d) => (
          <li key={d.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <div className="font-semibold">{d.name}</div>
              <div className="text-xs text-muted-foreground">key: {d.key} · order {d.order_index}</div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs ${d.active ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-secondary"}`}>{d.active ? "aktiv" : "inaktiv"}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function BatteriesBlock({ frameworkId, orgId, fw, onChange }: { frameworkId: string; orgId: string; fw: FrameworkData; onChange: () => void }) {
  const [name, setName] = useState("");
  const [batteryId, setBatteryId] = useState<string | null>(null);
  const createFn = useServerFn(createBattery);
  const m = useMutation({
    mutationFn: () => createFn({ data: { framework_id: frameworkId, organization_id: orgId, name } }),
    onSuccess: () => { setName(""); onChange(); },
  });

  return (
    <Section title="Test-Batteries" hint="Sammlungen von Tests. Nur nicht-draft Batteries lassen sich für Sessions verwenden (Draft nur für Super-Admin-Test).">
      <div className="flex items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Neue Battery" className="rounded-md border border-border bg-background p-2 text-sm flex-1" />
        <button onClick={() => m.mutate()} disabled={!name || m.isPending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">+ Battery</button>
      </div>

      <ul className="mt-3 divide-y divide-border">
        {(fw?.batteries ?? []).map((b) => (
          <li key={b.id} className="py-2 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{b.name}</div>
                <div className="text-xs text-muted-foreground">v{b.version} · {b.status} · {(fw?.tests ?? []).filter((t) => t.battery_id === b.id).length} Tests</div>
              </div>
              <button className="text-xs text-primary underline" onClick={() => setBatteryId(batteryId === b.id ? null : b.id)}>
                {batteryId === b.id ? "Schließen" : "Tests"}
              </button>
            </div>
            {batteryId === b.id && <TestsForBattery batteryId={b.id} fw={fw} onChange={onChange} />}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TestsForBattery({ batteryId, fw, onChange }: { batteryId: string; fw: FrameworkData; onChange: () => void }) {
  const tests = (fw?.tests ?? []).filter((t) => t.battery_id === batteryId);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("s");
  const [direction, setDirection] = useState<"higher_is_better" | "lower_is_better" | "target_range">("lower_is_better");
  const [domainId, setDomainId] = useState<string>("");
  const createFn = useServerFn(createTestDefinition);
  const m = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          battery_id: batteryId,
          key,
          name,
          unit,
          value_type: "number",
          direction,
          domain_id: domainId || null,
        },
      }),
    onSuccess: () => { setKey(""); setName(""); onChange(); },
  });
  return (
    <div className="mt-2 rounded-md bg-secondary p-3">
      <ul className="text-xs space-y-1">
        {tests.map((t) => (
          <li key={t.id}>· <b>{t.name}</b> ({t.key}) — {t.unit}, {t.direction}, selection: {t.result_selection}{t.required ? ", required" : ""}</li>
        ))}
        {tests.length === 0 && <li className="text-muted-foreground">Noch keine Tests.</li>}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" className="rounded border border-border bg-background p-1.5 text-xs" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded border border-border bg-background p-1.5 text-xs" />
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit" className="rounded border border-border bg-background p-1.5 text-xs" />
        <select value={direction} onChange={(e) => setDirection(e.target.value as never)} className="rounded border border-border bg-background p-1.5 text-xs">
          <option value="higher_is_better">higher_is_better</option>
          <option value="lower_is_better">lower_is_better</option>
          <option value="target_range">target_range</option>
        </select>
        <select value={domainId} onChange={(e) => setDomainId(e.target.value)} className="rounded border border-border bg-background p-1.5 text-xs">
          <option value="">Domain…</option>
          {(fw?.domains ?? []).map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <button disabled={!key || !name || m.isPending} onClick={() => m.mutate()} className="mt-2 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">
        + Test
      </button>
    </div>
  );
}

function MetricsBlock({ frameworkId, fw, onChange }: { frameworkId: string; fw: FrameworkData; onChange: () => void }) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [calcType, setCalcType] = useState<"direct" | "ratio" | "percentage_difference" | "asymmetry" | "bodyweight_relative">("direct");
  const [inputKey, setInputKey] = useState("");
  const [domainId, setDomainId] = useState("");
  const create = useServerFn(createMetricDefinition);
  const m = useMutation({
    mutationFn: () => {
      const cfg: Record<string, string> = {};
      if (calcType === "direct") cfg.input_metric_key = inputKey || key;
      if (calcType === "bodyweight_relative") { cfg.performance_metric_key = inputKey; cfg.context_key = "bodyweight_kg"; }
      return create({ data: { framework_id: frameworkId, key, name, domain_id: domainId || null, calculation_type: calcType, config: cfg } });
    },
    onSuccess: () => { setKey(""); setName(""); onChange(); },
  });
  return (
    <Section title="Metrics" hint="raw_test = direkter Testwert. Derived = kontrollierte Berechnung (kein freies Formel-Eval).">
      <ul className="text-xs space-y-1 mb-3">
        {(fw?.metrics ?? []).map((mt) => (
          <li key={mt.id}>· <b>{mt.name}</b> ({mt.key}) — {mt.metric_type}/{mt.calculation_type}</li>
        ))}
        {(fw?.metrics ?? []).length === 0 && <li className="text-muted-foreground">Noch keine Metriken.</li>}
      </ul>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" className="rounded border border-border bg-background p-1.5 text-xs" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded border border-border bg-background p-1.5 text-xs" />
        <select value={calcType} onChange={(e) => setCalcType(e.target.value as never)} className="rounded border border-border bg-background p-1.5 text-xs">
          <option value="direct">direct</option>
          <option value="ratio">ratio</option>
          <option value="percentage_difference">percentage_difference</option>
          <option value="asymmetry">asymmetry</option>
          <option value="bodyweight_relative">bodyweight_relative</option>
        </select>
        <input value={inputKey} onChange={(e) => setInputKey(e.target.value)} placeholder="input_metric_key" className="rounded border border-border bg-background p-1.5 text-xs" />
        <select value={domainId} onChange={(e) => setDomainId(e.target.value)} className="rounded border border-border bg-background p-1.5 text-xs">
          <option value="">Domain…</option>
          {(fw?.domains ?? []).map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <button disabled={!key || !name || m.isPending} onClick={() => m.mutate()} className="mt-2 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">+ Metric</button>
    </Section>
  );
}

function DomainMetricWeightsBlock({ frameworkId, fw, onChange }: { frameworkId: string; fw: FrameworkData; onChange: () => void }) {
  const upsert = useServerFn(upsertDomainMetricWeight);
  return (
    <Section title="Domain × Metric Weights" hint="Contribution einer Metrik zur Domain-Score-Berechnung. Warnung wenn Summe pro Domain ≠ 100.">
      <div className="space-y-4">
        {(fw?.domains ?? []).filter((d) => d.active).map((d) => {
          const metricsForDomain = (fw?.metrics ?? []).filter((m) => m.domain_id === d.id);
          return (
            <div key={d.id} className="rounded-md border border-border p-3">
              <div className="font-semibold text-sm">{d.name}</div>
              {metricsForDomain.length === 0 ? (
                <div className="mt-1 text-xs text-muted-foreground">Keine Metriken zugeordnet.</div>
              ) : (
                <ul className="mt-2 space-y-1">
                  {metricsForDomain.map((m) => (
                    <WeightRow key={m.id} label={m.name} onSave={(w) => upsert({ data: { framework_id: frameworkId, domain_id: d.id, metric_definition_id: m.id, weight: w } }).then(onChange)} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function PositionsBlock({ fw, onChange }: { fw: FrameworkData; onChange: () => void }) {
  const upsert = useServerFn(upsertPositionDomainWeight);
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Section title="Position Profiles" hint="Domain-Weights pro Position. Position wird erst aktiv, wenn Summe = 100 und Framework valide.">
      <ul className="divide-y divide-border">
        {(fw?.positions ?? []).map((p) => (
          <li key={p.id} className="py-2 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{p.position_key} — {p.position_name}</div>
                <div className="text-xs text-muted-foreground">v{p.version} · {p.status}</div>
              </div>
              <button className="text-xs text-primary underline" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                {openId === p.id ? "Schließen" : "Domain-Weights"}
              </button>
            </div>
            {openId === p.id && (
              <div className="mt-2 rounded-md bg-secondary p-3">
                {(fw?.domains ?? []).filter((d) => d.active).map((d) => (
                  <WeightRow key={d.id} label={d.name} onSave={(w) => upsert({ data: { position_profile_id: p.id, domain_id: d.id, weight: w } }).then(onChange)} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function BenchmarksBlock({ fw }: { fw: FrameworkData }) {
  return (
    <Section title="Benchmarks" hint="V1: organization_internal, longitudinal_self_comparison. External nur mit dokumentierter Quelle.">
      <ul className="text-sm space-y-1">
        {(fw?.benchmarks ?? []).map((b) => (
          <li key={b.id}>· <b>{b.name}</b> — {b.benchmark_type} · min_sample: {b.minimum_sample_size} · {b.status}</li>
        ))}
      </ul>
      <div className="mt-2 text-xs text-muted-foreground">
        Bearbeitung: bei minimum_sample_size = 0 bleibt das Modell im Draft. Aktivierung erst nach fachlicher Freigabe.
      </div>
    </Section>
  );
}

function WeightRow({ label, onSave }: { label: string; onSave: (w: number) => void }) {
  const [v, setV] = useState("");
  return (
    <li className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" step="any" value={v} onChange={(e) => setV(e.target.value)} placeholder="Weight" className="w-24 rounded border border-border bg-background p-1 text-xs" />
        <button onClick={() => v && onSave(Number(v))} className="rounded bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground disabled:opacity-50" disabled={!v}>
          Set
        </button>
      </div>
    </li>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3">
        <div className="font-display font-bold">{title}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </section>
  );
}
