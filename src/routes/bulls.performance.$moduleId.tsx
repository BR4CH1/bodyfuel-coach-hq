import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, XCircle, ChevronRight, PlayCircle } from "lucide-react";
import { getProfile, scoreTestValue, getPositionGroup, bestResultPerTest, effectiveValue } from "@/lib/performance-profiles";
import { listMyPerformanceTests } from "@/lib/bulls-performance.functions";
import { getBullsProfile } from "@/lib/bulls.functions";
import { useSession } from "@/lib/bodyfuel/session";
import type { TestResult } from "@/lib/performance-profiles/types";

export const Route = createFileRoute("/bulls/performance/$moduleId")({
  head: () => ({ meta: [{ title: "Modul — Bulls Performance" }] }),
  component: ModulePage,
});

function ModulePage() {
  const { moduleId } = Route.useParams();
  const navigate = useNavigate();
  const { supabaseUser } = useSession();
  const profile = getProfile("football_bulls")!;
  const mod = profile.modules.find((m) => m.id === moduleId);

  const bpFn = useServerFn(getBullsProfile);
  const testsFn = useServerFn(listMyPerformanceTests);
  const bpQ = useQuery({ queryKey: ["bulls-profile"], queryFn: () => bpFn(), enabled: !!supabaseUser });
  const testsQ = useQuery({ queryKey: ["bulls-perf-tests"], queryFn: () => testsFn(), enabled: !!supabaseUser });

  if (!mod) {
    return (
      <div className="space-y-4">
        <Link to="/bulls/performance" className="text-xs text-muted-foreground">← Performance</Link>
        <div className="rounded-xl border border-border bg-card p-6 text-sm">Unbekanntes Modul.</div>
      </div>
    );
  }

  const group = getPositionGroup(profile, bpQ.data?.position ?? null);
  const results = (testsQ.data ?? []) as TestResult[];
  const bestVerified = bestResultPerTest(profile, results, { requireVerified: true });
  const anyByTest: Record<string, TestResult> = {};
  for (const r of results) {
    if (r.module_id !== mod.id) continue;
    const cur = anyByTest[r.test_id];
    if (!cur || new Date(r.performed_at) > new Date(cur.performed_at)) anyByTest[r.test_id] = r;
  }

  return (
    <div className="space-y-6">
      <Link to="/bulls/performance" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red">
        ← Performance-Übersicht
      </Link>
      <header>
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-bulls-red">Modul</div>
        <h1 className="font-display text-3xl font-bold">{mod.name}</h1>
      </header>

      <div className="space-y-3">
        {mod.tests.map((t) => {
          const best = bestVerified[t.id];
          const latest = anyByTest[t.id];
          const score = best ? scoreTestValue(t, effectiveValue(best), group) : null;
          const status = latest?.verification_status;
          return (
            <button
              key={t.id}
              onClick={() => navigate({ to: "/bulls/performance/$moduleId/$testId", params: { moduleId: mod.id, testId: t.id } })}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-bulls-red/60"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.short}</div>
                <div className="font-display text-lg font-bold">{t.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {best ? (
                    <>
                      <span className="tabular-nums font-semibold">
                        {Number(effectiveValue(best)).toFixed(2)} {best.result_unit}
                      </span>
                      <StatusBadge status={best.verification_status} />
                      {score != null && (
                        <span className="rounded-md bg-bulls-red/15 px-2 py-0.5 font-semibold text-bulls-red">
                          Score {score}
                        </span>
                      )}
                    </>
                  ) : latest ? (
                    <>
                      <span className="tabular-nums">
                        {Number(latest.result_value).toFixed(2)} {latest.result_unit}
                      </span>
                      <StatusBadge status={latest.verification_status} />
                    </>
                  ) : (
                    <span className="text-muted-foreground">Noch nicht getestet</span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TestResult["verification_status"] }) {
  if (status === "verified" || status === "corrected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-green-500/15 px-2 py-0.5 text-green-300">
        <CheckCircle2 className="h-3 w-3" /> Coach verified
      </span>
    );
  }
  if (status === "submitted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300">
        <Clock className="h-3 w-3" /> Zur Prüfung
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-red-300">
        <XCircle className="h-3 w-3" /> Abgelehnt
      </span>
    );
  }
  return null;
}
