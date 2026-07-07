import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, XCircle, AlertCircle, ChevronRight, Activity, Zap, Rocket, Dumbbell } from "lucide-react";
import { BullsHero } from "@/components/bodyfuel/BullsHero";
import { getProfile, computeOverallScore } from "@/lib/performance-profiles";
import { getBullsProfile } from "@/lib/bulls.functions";
import { listMyPerformanceTests } from "@/lib/bulls-performance.functions";
import { useSession } from "@/lib/bodyfuel/session";
import type { TestResult } from "@/lib/performance-profiles/types";

export const Route = createFileRoute("/bulls/performance/")({
  head: () => ({ meta: [{ title: "Performance Check — Bulls Hub" }] }),
  component: PerformanceIndex,
});

const MODULE_ICONS: Record<string, any> = {
  speed: Rocket,
  agility: Zap,
  power: Activity,
  strength: Dumbbell,
};

function PerformanceIndex() {
  const { supabaseUser } = useSession();
  const profile = getProfile("football_bulls")!;
  const bpFn = useServerFn(getBullsProfile);
  const testsFn = useServerFn(listMyPerformanceTests);
  const bpQ = useQuery({ queryKey: ["bulls-profile"], queryFn: () => bpFn(), enabled: !!supabaseUser });
  const testsQ = useQuery({ queryKey: ["bulls-perf-tests"], queryFn: () => testsFn(), enabled: !!supabaseUser });

  const position = bpQ.data?.position ?? null;
  const results = (testsQ.data ?? []) as TestResult[];
  const overall = computeOverallScore(profile, position, results);

  return (
    <div className="space-y-6">
      <Link to="/bulls" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red">
        ← Zurück zum Hub
      </Link>

      <BullsHero
        eyebrow="Bulls Performance Check"
        title="Deine Football Performance"
        subtitle="Führe die Tests gemeinsam mit einem Coach oder Teampartner durch, dokumentiere deine Versuche und lass deine Ergebnisse bestätigen."
      />

      {/* Overall */}
      <section className="rounded-2xl border border-bulls-red/30 bg-gradient-to-br from-black via-[oklch(0.12_0.005_250)] to-background p-6">
        <div className="flex items-baseline gap-4">
          <div className="text-6xl font-bold text-white tabular-nums">
            {overall.overall ?? "—"}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-bulls-red">
              Bulls Performance Score
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {position ? `Position: ${position}` : "Position noch nicht gesetzt"}
              {overall.positionGroup && ` · ${overall.positionGroup}`}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Confidence: {overall.confidence}
            </div>
          </div>
        </div>
        {!position && (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            Setze zuerst deine Position im{" "}
            <Link to="/bulls/onboarding" className="underline">Bulls-Onboarding</Link>, damit dein Score berechnet werden kann.
          </div>
        )}
      </section>

      {/* Modules */}
      <section className="grid gap-3 sm:grid-cols-2">
        {profile.modules.map((mod) => {
          const s = overall.modules.find((m) => m.moduleId === mod.id)!;
          const Icon = MODULE_ICONS[mod.id] ?? Activity;
          return (
            <Link
              key={mod.id}
              to="/bulls/performance/$moduleId"
              params={{ moduleId: mod.id }}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 transition hover:border-bulls-red/60"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-bulls-red/15 text-bulls-red">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-bulls-red">
                    {mod.name}
                  </div>
                  <div className="font-display text-2xl font-bold tabular-nums">
                    {s.score ?? "—"}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {s.testsDone}/{s.testsTotal} Tests
                    </span>
                  </div>
                  {s.testsDone < s.testsTotal && s.score != null && (
                    <div className="text-[11px] text-amber-300">Vorläufige Bewertung</div>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </section>

      {/* Pending items */}
      <PendingList results={results} />
    </div>
  );
}

function PendingList({ results }: { results: TestResult[] }) {
  const pending = results.filter((r) => r.verification_status === "submitted");
  const rejected = results.filter((r) => r.verification_status === "rejected");
  if (pending.length === 0 && rejected.length === 0) return null;
  const profile = getProfile("football_bulls")!;
  return (
    <section className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
        Deine offenen Ergebnisse
      </div>
      <div className="space-y-2">
        {pending.map((r) => {
          const test = profile.modules.flatMap((m) => m.tests).find((t) => t.id === r.test_id);
          return (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-300" />
                <div>
                  <div className="font-semibold">{test?.name ?? r.test_id}</div>
                  <div className="text-xs text-muted-foreground">Wartet auf Coach-Prüfung</div>
                </div>
              </div>
              <div className="text-sm font-bold tabular-nums">
                {Number(r.result_value).toFixed(2)} <span className="text-xs text-muted-foreground">{r.result_unit}</span>
              </div>
            </div>
          );
        })}
        {rejected.map((r) => {
          const test = profile.modules.flatMap((m) => m.tests).find((t) => t.id === r.test_id);
          return (
            <div key={r.id} className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-sm">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-400" />
                <div className="font-semibold">{test?.name ?? r.test_id} · abgelehnt</div>
              </div>
              {r.rejection_reason && (
                <div className="mt-1 pl-6 text-xs text-red-200">{r.rejection_reason}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
