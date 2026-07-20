import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  getPerformanceTeamMatrix,
  listOrgAthletesForPerformance,
} from "@/lib/performance/performance.functions";

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
            Generische Multi-Sport Performance Engine V1
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Performance-Test-Sessions dieser Organisation.</div>
        <button
          onClick={() => setWizardOpen((v) => !v)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold uppercase tracking-widest text-primary-foreground"
        >
          {wizardOpen ? "Abbrechen" : "+ Performance Test Session"}
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
              <div className="min-w-0">
                <div className="truncate font-semibold">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.test_date} · {s.status}</div>
              </div>
              <Link
                to="/coach/teams/$orgId/performance/session/$sessionId"
                params={{ orgId, sessionId: s.id }}
                className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
              >Öffnen</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type WizStep = "battery" | "day" | "athletes" | "basics" | "snapshot" | "confirm";

function SessionWizard({ orgId, fw, onDone }: { orgId: string; fw: FrameworkData; onDone: () => void }) {
  const navigate = useNavigate();
  const create = useServerFn(createPerformanceSession);
  const fetchAthletes = useServerFn(listOrgAthletesForPerformance);

  const [step, setStep] = useState<WizStep>("battery");
  const [batteryId, setBatteryId] = useState(fw?.batteries?.[0]?.id ?? "");
  const [testDay, setTestDay] = useState<"field" | "strength" | "full">("field");
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [measurementDefault, setMeasurementDefault] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [snapshots, setSnapshots] = useState<Record<string, string>>({});

  const battery = fw?.batteries?.find((b) => b.id === batteryId);
  const battStatus = battery?.status ?? "draft";
  const testMode = battStatus === "draft";

  const rosterQ = useQuery({
    queryKey: ["perf-roster", orgId],
    queryFn: () => fetchAthletes({ data: { organization_id: orgId } }),
    enabled: step !== "battery" && step !== "day",
  });

  const athletes = rosterQ.data?.athletes ?? [];

  const defaultName = useMemo(() => {
    if (name) return name;
    const label = testDay === "field" ? "Field Testing" : testDay === "strength" ? "Strength Testing" : "Full Battery";
    return `${battery?.name ?? "Session"} – ${label} – ${testDate}`;
  }, [name, battery, testDay, testDate]);

  const m = useMutation({
    mutationFn: () =>
      create({
        data: {
          organization_id: orgId,
          battery_id: batteryId,
          name: defaultName,
          test_date: testDate,
          test_day: testDay,
          entry_mode: "by_test",
          location: location || null,
          measurement_method_default: measurementDefault || null,
          notes: notes || null,
          mode: testMode ? "test" : "production",
          athlete_user_ids: Array.from(selectedIds),
          bodyweight_snapshots: Object.entries(snapshots)
            .filter(([, v]) => v && !isNaN(Number(v)))
            .map(([user_id, v]) => ({ user_id, weight_kg: Number(v), source: "manual" })),
        },
      }),
    onSuccess: (session: any) => {
      onDone();
      navigate({ to: "/coach/teams/$orgId/performance/session/$sessionId", params: { orgId, sessionId: session.id } });
    },
  });

  const strengthOrFull = testDay === "strength" || testDay === "full";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <b>Neue Session</b>
        <span>·</span>
        <span>{step.toUpperCase()}</span>
        {testMode && <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 font-bold text-amber-700">DRAFT FRAMEWORK · TEST MODE</span>}
      </div>

      {step === "battery" && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">1. Test-Battery wählen</div>
          <select value={batteryId} onChange={(e) => setBatteryId(e.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">
            <option value="">— wählen —</option>
            {(fw?.batteries ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.status})</option>
            ))}
          </select>
          {testMode && (
            <div className="rounded bg-amber-500/10 border border-amber-500/40 p-2 text-xs">
              Diese Battery ist <b>DRAFT</b>. Nutzung im <b>TEST MODE</b> — Ergebnisse gehen nicht in produktive Peer-Vergleiche ein.
            </div>
          )}
          <div className="flex justify-end">
            <button disabled={!batteryId} onClick={() => setStep("day")} className="rounded bg-primary px-3 py-1.5 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50">Weiter</button>
          </div>
        </div>
      )}

      {step === "day" && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">2. Test-Tag</div>
          <div className="grid grid-cols-3 gap-2">
            {(["field", "strength", "full"] as const).map((d) => (
              <button key={d} onClick={() => setTestDay(d)} className={`rounded border p-3 text-xs font-bold uppercase ${testDay === d ? "border-primary bg-primary/10" : "border-border bg-secondary"}`}>
                {d === "field" ? "Field Test Day" : d === "strength" ? "Strength Test Day" : "Full Battery"}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Field Test Day: Sprints, Jumps, A505, RAST · Strength Test Day: Bodyweight Snapshot, Trap Bar, Bench · Full Battery: alle Tests (nur mit manage_performance).
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep("battery")} className="text-xs uppercase text-muted-foreground">◀ Zurück</button>
            <button onClick={() => setStep("athletes")} className="rounded bg-primary px-3 py-1.5 text-sm font-bold uppercase text-primary-foreground">Weiter</button>
          </div>
        </div>
      )}

      {step === "athletes" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">3. Athleten</div>
            <div className="flex gap-2 text-[10px] uppercase">
              <button onClick={() => setSelectedIds(new Set(athletes.map((a) => a.user_id)))} className="rounded bg-secondary px-2 py-1 font-bold">Alle</button>
              <button onClick={() => setSelectedIds(new Set())} className="rounded bg-secondary px-2 py-1 font-bold">Keine</button>
            </div>
          </div>
          {rosterQ.isLoading ? (
            <div className="text-xs text-muted-foreground">Roster lädt…</div>
          ) : athletes.length === 0 ? (
            <div className="text-xs text-muted-foreground">Keine aktiven Athlete-Members.</div>
          ) : (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded border border-border">
              {athletes.map((a) => {
                const sel = selectedIds.has(a.user_id);
                return (
                  <li key={a.user_id}>
                    <label className="flex items-center gap-2 p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={(e) => {
                          const n = new Set(selectedIds);
                          if (e.target.checked) n.add(a.user_id); else n.delete(a.user_id);
                          setSelectedIds(n);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold">{a.name || a.user_id.slice(0, 8)}</div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {a.team_name ?? "kein Team"} · {a.position ?? "keine Position"} · {a.profile_status}
                          {!a.onboarding_completed && " · Onboarding offen"}
                        </div>
                      </div>
                    </label>
                    {!a.position && sel && (
                      <div className="border-t border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] uppercase text-amber-700">
                        Position required for position-weighted overall profile
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex justify-between">
            <button onClick={() => setStep("day")} className="text-xs uppercase text-muted-foreground">◀ Zurück</button>
            <button disabled={selectedIds.size === 0} onClick={() => setStep("basics")} className="rounded bg-primary px-3 py-1.5 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50">Weiter ({selectedIds.size})</button>
          </div>
        </div>
      )}

      {step === "basics" && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">4. Session-Basisdaten</div>
          <label className="block text-sm">
            <span className="text-xs uppercase text-muted-foreground">Session Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName} className="mt-1 w-full rounded border border-border bg-background p-2" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              <span className="text-xs uppercase text-muted-foreground">Test Date</span>
              <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="mt-1 w-full rounded border border-border bg-background p-2" />
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase text-muted-foreground">Location (opt.)</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded border border-border bg-background p-2" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-xs uppercase text-muted-foreground">Measurement Method Default (opt.)</span>
            <input value={measurementDefault} onChange={(e) => setMeasurementDefault(e.target.value)} placeholder="z. B. Photocells, Kraftmessplatte…" className="mt-1 w-full rounded border border-border bg-background p-2" />
          </label>
          <label className="block text-sm">
            <span className="text-xs uppercase text-muted-foreground">Notes (opt.)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded border border-border bg-background p-2" rows={2} />
          </label>
          <div className="flex justify-between">
            <button onClick={() => setStep("athletes")} className="text-xs uppercase text-muted-foreground">◀ Zurück</button>
            <button onClick={() => setStep(strengthOrFull ? "snapshot" : "confirm")} className="rounded bg-primary px-3 py-1.5 text-sm font-bold uppercase text-primary-foreground">Weiter</button>
          </div>
        </div>
      )}

      {step === "snapshot" && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">5. Bodyweight Snapshots</div>
          <div className="text-xs text-muted-foreground">
            Für Strength-Tests (Trap Bar, Bench) wird ein Session-Bodyweight-Snapshot benötigt. Er wird ausschließlich für diese Performance-Session gespeichert und verändert keine persönlichen BodyFuel-Daten.
          </div>
          <ul className="divide-y divide-border rounded border border-border">
            {Array.from(selectedIds).map((uid) => {
              const a = athletes.find((x) => x.user_id === uid);
              const last = a?.last_bodyweight_kg;
              return (
                <li key={uid} className="grid grid-cols-[1fr_auto] items-center gap-2 p-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{a?.name || uid.slice(0, 8)}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">
                      {last ? `Letzter Wert: ${last} kg` : "REQUIRED"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {last != null && (
                      <button
                        onClick={() => setSnapshots((s) => ({ ...s, [uid]: String(last) }))}
                        className="rounded bg-secondary px-2 py-1 text-[10px] font-bold uppercase"
                      >Übernehmen</button>
                    )}
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={snapshots[uid] ?? ""}
                      onChange={(e) => setSnapshots((s) => ({ ...s, [uid]: e.target.value }))}
                      placeholder="kg"
                      className="w-20 rounded border border-border bg-background p-1 text-sm tabular-nums"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between">
            <button onClick={() => setStep("basics")} className="text-xs uppercase text-muted-foreground">◀ Zurück</button>
            <button onClick={() => setStep("confirm")} className="rounded bg-primary px-3 py-1.5 text-sm font-bold uppercase text-primary-foreground">Weiter</button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">6. Session anlegen</div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Line k="Battery" v={battery?.name ?? ""} />
            <Line k="Test Day" v={testDay} />
            <Line k="Datum" v={testDate} />
            <Line k="Athleten" v={String(selectedIds.size)} />
            <Line k="Location" v={location || "—"} />
            <Line k="Measurement Default" v={measurementDefault || "—"} />
            <Line k="Snapshots" v={String(Object.values(snapshots).filter(Boolean).length)} />
            <Line k="Modus" v={testMode ? "TEST MODE" : "PRODUCTION"} />
          </dl>
          <div className="flex justify-between">
            <button onClick={() => setStep(strengthOrFull ? "snapshot" : "basics")} className="text-xs uppercase text-muted-foreground">◀ Zurück</button>
            <button disabled={m.isPending} onClick={() => m.mutate()} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-bold uppercase text-white disabled:opacity-50">
              {m.isPending ? "Erstelle…" : "Session erstellen"}
            </button>
          </div>
          {m.error && <div className="text-xs text-destructive">{(m.error as Error).message}</div>}
        </div>
      )}
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
      <div className="font-semibold">{v}</div>
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
