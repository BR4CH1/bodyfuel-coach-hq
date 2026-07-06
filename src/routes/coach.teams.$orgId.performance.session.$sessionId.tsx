import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import {
  getPerformanceSession,
  getPerformanceSessionProgress,
  addTestAttempt,
  invalidateAttempt,
  completePerformanceSession,
  startPerformanceSession,
  cancelPerformanceSession,
  updatePerformanceSession,
} from "@/lib/performance/performance.functions";
import { computeTestResult, type Direction, type ResultSelectionMethod, type TestConfig } from "@/lib/performance";

export const Route = createFileRoute("/coach/teams/$orgId/performance/session/$sessionId")({
  head: () => ({ meta: [{ title: "Performance Test Session — BODYFUEL Coach" }] }),
  component: () => (
    <AppLayout>
      <div className="mx-auto max-w-md">
        <SessionPage />
      </div>
    </AppLayout>
  ),
});

type Mode = "by_test" | "by_athlete";
type View = "entry" | "protocol" | "review";

function SessionPage() {
  const { orgId, sessionId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchSession = useServerFn(getPerformanceSession);
  const fetchProgress = useServerFn(getPerformanceSessionProgress);
  const startFn = useServerFn(startPerformanceSession);
  const cancelFn = useServerFn(cancelPerformanceSession);
  const patchFn = useServerFn(updatePerformanceSession);
  const addFn = useServerFn(addTestAttempt);
  const invFn = useServerFn(invalidateAttempt);
  const completeFn = useServerFn(completePerformanceSession);

  const sessQ = useQuery({ queryKey: ["perf-session", sessionId], queryFn: () => fetchSession({ data: { session_id: sessionId } }) });
  const progQ = useQuery({ queryKey: ["perf-session-progress", sessionId], queryFn: () => fetchProgress({ data: { session_id: sessionId } }) });

  const [athleteIdx, setAthleteIdx] = useState(0);
  const [testIdx, setTestIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("by_test");
  const [view, setView] = useState<View>("entry");
  const [value, setValue] = useState("");
  const [showProtocol, setShowProtocol] = useState(false);
  const [showOpenList, setShowOpenList] = useState(false);

  const sess = sessQ.data;
  const prog = progQ.data;

  const testsAll = sess?.tests ?? [];
  const testDay = (sess?.session as any)?.test_day as string | null;

  // Filter tests by test_day if configured on the test.protocol.testing_day_group
  const tests = useMemo(() => {
    if (!testDay || testDay === "full") return testsAll;
    return testsAll.filter((t) => {
      const grp = (t.protocol as any)?.testing_day_group;
      return !grp || grp === testDay;
    });
  }, [testsAll, testDay]);

  const athletes = sess?.athletes ?? [];
  const attempts = sess?.attempts ?? [];

  if (sessQ.isLoading || !sess) return <div className="p-4 text-sm text-muted-foreground">Laden…</div>;

  const status = (sess.session as any).status as string;
  const isCompleted = status === "completed";
  const isPlanned = status === "planned";
  const currentAthlete = athletes[athleteIdx];
  const currentTest = tests[testIdx];
  const attemptsForCombo = attempts.filter((a) => currentAthlete && currentTest && a.user_id === currentAthlete.user_id && a.test_definition_id === currentTest.id);

  const selected = currentTest && attemptsForCombo.length > 0
    ? computeTestResult({
        attempts: attemptsForCombo.map((a) => ({ id: a.id, raw_value: Number(a.raw_value), unit_snapshot: a.unit_snapshot, valid: a.valid, measured_at: a.measured_at })),
        method: (currentTest.result_selection as ResultSelectionMethod) ?? "best",
        direction: (currentTest.direction as Direction) ?? "higher_is_better",
        unit: currentTest.unit,
        config: (currentTest.config as TestConfig) ?? null,
      })
    : null;

  const recommendedAttempts = ((currentTest?.config as any)?.recommended_attempts ?? null) as number | null;
  const required = ((currentTest?.config as any)?.required_valid_attempts ?? null) as number | null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["perf-session", sessionId] });
    qc.invalidateQueries({ queryKey: ["perf-session-progress", sessionId] });
  };

  const saveAttempt = async () => {
    if (!currentAthlete || !currentTest || !value) return;
    await addFn({
      data: {
        session_id: sessionId,
        user_id: currentAthlete.user_id,
        test_definition_id: currentTest.id,
        raw_value: Number(value),
        unit_snapshot: currentTest.unit,
        attempt_number: attemptsForCombo.length + 1,
        organization_id: (sess.session as any).organization_id,
      },
    });
    setValue("");
    refresh();
  };

  const invalidate = async (id: string) => {
    const reason = prompt("Grund für Invalidierung?") ?? "";
    if (!reason) return;
    await invFn({ data: { attempt_id: id, reason } });
    refresh();
  };

  const nextAthlete = () => setAthleteIdx((i) => Math.min(i + 1, athletes.length - 1));
  const prevAthlete = () => setAthleteIdx((i) => Math.max(i - 1, 0));
  const nextTest = () => setTestIdx((i) => Math.min(i + 1, tests.length - 1));
  const prevTest = () => setTestIdx((i) => Math.max(i - 1, 0));

  return (
    <div className="min-h-screen space-y-3 pb-32">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <Link to="/coach/teams/$orgId/performance" params={{ orgId }} className="text-[10px] uppercase tracking-widest text-muted-foreground">← Sessions</Link>
          <StatusBadge status={status} mode={(sess.session as any).mode} />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-display text-base font-bold">{(sess.session as any).name}</div>
            <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
              {testDay === "field" ? "Field Test Day" : testDay === "strength" ? "Strength Test Day" : "Full Battery"} · {prog?.progress.cells_complete ?? 0} / {prog?.progress.cells_total ?? 0} Results
            </div>
          </div>
          <div className="flex gap-1">
            {isPlanned && (
              <button onClick={async () => { await startFn({ data: { session_id: sessionId } }); refresh(); }} className="rounded bg-primary px-2 py-1 text-[10px] font-bold uppercase text-primary-foreground">Start</button>
            )}
            {!isCompleted && (
              <button onClick={() => setView("review")} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold uppercase text-white">Abschließen</button>
            )}
          </div>
        </div>
      </header>

      {view === "review" ? (
        <CompletionReview
          progress={prog}
          onCancel={() => setView("entry")}
          onConfirm={async (force: boolean) => {
            if (!force && prog && prog.progress.athletes_complete < prog.progress.athletes_total) {
              if (!confirm(`${prog.progress.athletes_total - prog.progress.athletes_complete} Athleten haben unvollständige Ergebnisse. Trotzdem abschließen?`)) return;
            }
            const r = await completeFn({ data: { session_id: sessionId } });
            alert(`Session abgeschlossen. Profile aktualisiert: ${r.profiles_updated}. ${r.notes.join(" ")}`);
            navigate({ to: "/coach/teams/$orgId/performance", params: { orgId } });
          }}
        />
      ) : (
        <>
          <div className="px-3">
            <div className="mb-2 flex rounded-md bg-secondary p-0.5 text-xs">
              <button
                onClick={() => {
                  setMode("by_test");
                  patchFn({ data: { session_id: sessionId, patch: { entry_mode: "by_test" } } }).catch(() => {});
                }}
                className={`flex-1 rounded px-2 py-1 font-semibold ${mode === "by_test" ? "bg-background" : ""}`}
              >BY TEST</button>
              <button
                onClick={() => {
                  setMode("by_athlete");
                  patchFn({ data: { session_id: sessionId, patch: { entry_mode: "by_athlete" } } }).catch(() => {});
                }}
                className={`flex-1 rounded px-2 py-1 font-semibold ${mode === "by_athlete" ? "bg-background" : ""}`}
              >BY ATHLETE</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs">
                <span className="text-muted-foreground">Athlete</span>
                <select
                  value={currentAthlete?.user_id ?? ""}
                  onChange={(e) => setAthleteIdx(athletes.findIndex((a) => a.user_id === e.target.value))}
                  className="mt-0.5 w-full rounded border border-border bg-background p-2 text-sm"
                >
                  {athletes.map((a) => <option key={a.user_id} value={a.user_id}>{a.user_id.slice(0, 8)}</option>)}
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-muted-foreground">Test</span>
                <select
                  value={currentTest?.id ?? ""}
                  onChange={(e) => setTestIdx(tests.findIndex((t) => t.id === e.target.value))}
                  className="mt-0.5 w-full rounded border border-border bg-background p-2 text-sm"
                >
                  {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            </div>

            <button onClick={() => setShowOpenList((v) => !v)} className="mt-2 text-xs text-primary underline">
              {showOpenList ? "Schließen" : "Offene Results anzeigen"}
            </button>
            {showOpenList && prog && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded border border-border p-2 text-xs">
                {prog.cells.filter((c) => c.status !== "OK").slice(0, 50).map((c, i) => {
                  const t = tests.find((x) => x.id === c.test_definition_id);
                  return (
                    <li key={i} className="flex justify-between gap-2 py-0.5">
                      <span className="truncate">{c.user_id.slice(0, 8)} · {t?.name ?? "?"}</span>
                      <span className="text-muted-foreground">{c.status}</span>
                    </li>
                  );
                })}
                {prog.cells.filter((c) => c.status !== "OK").length === 0 && <li className="text-muted-foreground">Alle Results vollständig.</li>}
              </ul>
            )}
          </div>

          {currentTest && currentAthlete && (
            <section className="mx-3 rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">{currentAthlete.user_id.slice(0, 8)}</div>
                  <div className="truncate font-display text-lg font-bold">{currentTest.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {currentTest.unit} · Selection: {currentTest.result_selection}
                    {recommendedAttempts && ` · Recomm. ${recommendedAttempts}`}
                    {required && ` · Required ${required}`}
                  </div>
                </div>
                <button onClick={() => setShowProtocol(true)} className="rounded bg-secondary px-2 py-1 text-[10px] font-bold uppercase">Protokoll</button>
              </div>

              <ul className="mt-3 space-y-1 text-sm">
                {attemptsForCombo.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded border border-border bg-background p-2">
                    <div className={`${!a.valid ? "line-through text-muted-foreground" : ""}`}>
                      <span className="text-[10px] uppercase text-muted-foreground">V{a.attempt_number}</span>{" "}
                      <span className="font-bold tabular-nums">{a.raw_value}</span>{" "}
                      <span className="text-xs text-muted-foreground">{a.unit_snapshot}</span>
                    </div>
                    {a.valid ? (
                      <button onClick={() => invalidate(a.id)} className="text-[10px] uppercase text-destructive underline">Ungültig</button>
                    ) : (
                      <span className="text-[10px] uppercase text-destructive">Invalid</span>
                    )}
                  </li>
                ))}
                {attemptsForCombo.length === 0 && <li className="text-xs text-muted-foreground">Noch keine Versuche.</li>}
              </ul>

              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={`Wert in ${currentTest.unit}`}
                  className="flex-1 rounded border border-border bg-background p-3 text-base tabular-nums"
                />
                <button onClick={saveAttempt} disabled={!value} className="rounded bg-primary px-4 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50">+ Versuch</button>
              </div>

              {selected && (
                <div className="mt-3 rounded-md border border-border bg-background p-2 text-sm">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Selected Result</div>
                  {selected.test_status === "OK" ? (
                    <>
                      <div className="mt-1 text-2xl font-bold tabular-nums">
                        {Number(selected.selected_value).toFixed(currentTest.decimal_places ?? 2)} <span className="text-sm text-muted-foreground">{selected.unit}</span>
                      </div>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {selected.selection_method === "best" ? `BEST OF ${selected.valid_count} VALID` : `${(selected.selection_method ?? "").toString().toUpperCase()} OF ${selected.valid_count} VALID`}
                      </div>
                    </>
                  ) : selected.test_status === "PROVISIONAL" ? (
                    <>
                      <div className="mt-1 text-xl font-bold tabular-nums text-amber-600">
                        {selected.selected_value != null ? Number(selected.selected_value).toFixed(2) : "—"}
                      </div>
                      <div className="text-[10px] uppercase text-amber-600">PROVISIONAL — {selected.incomplete_reason}</div>
                    </>
                  ) : selected.test_status === "REVIEW_REQUIRED" ? (
                    <div className="text-xs font-bold uppercase text-destructive">REVIEW REQUIRED — {selected.incomplete_reason}</div>
                  ) : selected.test_status === "NO_VALID_ATTEMPTS" ? (
                    <div className="text-xs uppercase text-muted-foreground">NO VALID RESULT</div>
                  ) : (
                    <div className="text-xs uppercase text-muted-foreground">{selected.test_status}</div>
                  )}
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {selected.valid_count} / {required ?? recommendedAttempts ?? "?"} {required ? "REQUIRED" : "RECOMMENDED"}
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 p-2 backdrop-blur">
            <div className="mx-auto flex max-w-md gap-2">
              {mode === "by_test" ? (
                <>
                  <button onClick={prevAthlete} disabled={athleteIdx === 0} className="flex-1 rounded bg-secondary py-2 text-xs font-bold uppercase disabled:opacity-40">◀ Athlete</button>
                  <button onClick={nextAthlete} disabled={athleteIdx >= athletes.length - 1} className="flex-1 rounded bg-primary py-2 text-xs font-bold uppercase text-primary-foreground disabled:opacity-40">Athlete ▶</button>
                </>
              ) : (
                <>
                  <button onClick={prevTest} disabled={testIdx === 0} className="flex-1 rounded bg-secondary py-2 text-xs font-bold uppercase disabled:opacity-40">◀ Test</button>
                  <button onClick={nextTest} disabled={testIdx >= tests.length - 1} className="flex-1 rounded bg-primary py-2 text-xs font-bold uppercase text-primary-foreground disabled:opacity-40">Test ▶</button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {showProtocol && currentTest && (
        <ProtocolModal test={currentTest} onClose={() => setShowProtocol(false)} />
      )}
    </div>
  );
}

function StatusBadge({ status, mode }: { status: string; mode?: string | null }) {
  const color = status === "completed" ? "bg-emerald-500/20 text-emerald-700" : status === "in_progress" ? "bg-blue-500/20 text-blue-700" : status === "canceled" ? "bg-destructive/20 text-destructive" : "bg-secondary";
  return (
    <div className="flex gap-1">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}>{status}</span>
      {mode === "test" && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">TEST MODE</span>}
    </div>
  );
}

function ProtocolModal({ test, onClose }: { test: any; onClose: () => void }) {
  const proto = (test.protocol ?? {}) as Record<string, any>;
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{test.name}</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground">✕</button>
        </div>
        {test.description && <p className="mt-2 text-sm">{test.description}</p>}
        <dl className="mt-3 space-y-1 text-xs">
          {Object.entries(proto).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-40 shrink-0 uppercase text-muted-foreground">{k}</dt>
              <dd className="min-w-0 flex-1">{typeof v === "string" || typeof v === "number" ? String(v) : JSON.stringify(v)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function CompletionReview({ progress, onCancel, onConfirm }: { progress: any; onCancel: () => void; onConfirm: (force: boolean) => void }) {
  if (!progress) return null;
  const missing = progress.cells.filter((c: any) => c.status !== "OK");
  const byUser = new Map<string, any[]>();
  for (const m of missing) {
    const arr = byUser.get(m.user_id) ?? [];
    arr.push(m);
    byUser.set(m.user_id, arr);
  }
  return (
    <div className="px-3">
      <h2 className="font-display text-lg font-bold">Completion Review</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Athletes" value={`${progress.progress.athletes_complete} / ${progress.progress.athletes_total}`} />
        <Stat label="Results" value={`${progress.progress.cells_complete} / ${progress.progress.cells_total}`} />
      </div>
      {missing.length > 0 && (
        <div className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <div className="font-bold uppercase text-amber-700">Missing / Incomplete</div>
          <ul className="mt-1 max-h-64 space-y-0.5 overflow-y-auto">
            {Array.from(byUser.entries()).map(([uid, arr]) => (
              <li key={uid}>
                <b>{uid.slice(0, 8)}</b>: {arr.map((c) => c.test_definition_id.slice(0, 6)).join(", ")}
              </li>
            ))}
          </ul>
          <div className="mt-2 text-muted-foreground">
            Unvollständige Ergebnisse führen zu fehlenden Metrics und geringerer Data Coverage. Keine Werte werden als 0 behandelt.
          </div>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded bg-secondary py-2 text-xs font-bold uppercase">Zurück</button>
        <button onClick={() => onConfirm(missing.length === 0)} className="flex-1 rounded bg-emerald-600 py-2 text-xs font-bold uppercase text-white">{missing.length === 0 ? "Abschließen" : "Trotzdem abschließen"}</button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-card p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
