import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { getCustomerStrengthOverview, STRENGTH_TESTS, type StrengthTestKey } from "@/lib/strength-check.functions";
import { StrengthScoreDonut } from "./StrengthScoreDonut";

const TEST_LABELS: Record<StrengthTestKey, string> = Object.fromEntries(
  STRENGTH_TESTS.map((t) => [t.key, t.label]),
) as Record<StrengthTestKey, string>;

export function CoachStrengthCheckCard({ userId }: { userId: string }) {
  const fn = useServerFn(getCustomerStrengthOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["coach-strength-overview", userId],
    queryFn: () => fn({ data: { user_id: userId } }),
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Lade Strength Check…
      </div>
    );
  }

  const last = data?.last;
  const history = data?.history ?? [];

  if (!last) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Strength Check</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Dieser Kunde hat noch keinen Strength Check absolviert.
        </p>
      </div>
    );
  }

  const groups = [
    { key: "score_lower" as const, label: "Unterkörper" },
    { key: "score_push" as const, label: "Push" },
    { key: "score_pull" as const, label: "Pull" },
    { key: "score_core" as const, label: "Core" },
  ];
  const scores = groups
    .map((g) => ({ ...g, val: last[g.key] }))
    .filter((g): g is { key: typeof g.key; label: string; val: number } => typeof g.val === "number");
  const strongest = scores.length ? scores.reduce((a, b) => (a.val >= b.val ? a : b)) : null;
  const weakest = scores.length ? scores.reduce((a, b) => (a.val <= b.val ? a : b)) : null;
  const dysbalance = strongest && weakest ? strongest.val - weakest.val : 0;
  const [showExplanation, setShowExplanation] = useState(false);

  const prev = history.length >= 2 ? history[history.length - 2] : null;
  const totalDelta =
    prev?.score_total != null && last.score_total != null ? last.score_total - prev.score_total : null;

  const pains = (last.results ?? []).filter((r) => r.pain_note && r.pain_note.trim().length > 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Strength Check</h2>
        <div className="text-xs text-muted-foreground">
          {new Date(last.performed_at).toLocaleDateString("de-DE")}
          {last.bodyweight_kg ? ` · ${last.bodyweight_kg} kg KG` : ""}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <StrengthScoreDonut value={last.score_total} size={120} stroke={12} />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gesamt-Score</div>
            <div className="font-display text-2xl font-bold">
              {last.score_total ?? "—"}<span className="text-sm text-muted-foreground">/100</span>
            </div>
            {totalDelta != null && (
              <div className={`text-xs ${totalDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalDelta >= 0 ? "+" : ""}{totalDelta} ggü. letztem Check
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-[200px] space-y-1 text-xs">
          {strongest && (
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-gold" />
              Stärkste Gruppe: <strong>{strongest.label}</strong> ({strongest.val})
            </div>
          )}
          {weakest && weakest.key !== strongest?.key && (
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
              Schwächste Gruppe: <strong>{weakest.label}</strong> ({weakest.val})
            </div>
          )}
          {dysbalance > 20 && (
            <div className="flex items-start gap-2 text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>Dysbalance erkannt (Δ {dysbalance})</span>
                <button
                  type="button"
                  onClick={() => setShowExplanation((v) => !v)}
                  className="ml-2 inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground underline"
                >
                  <Info className="h-3 w-3" />
                  Was bedeutet das?
                  {showExplanation ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
            </div>
          )}
          {showExplanation && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs space-y-2 mt-2">
              <p>
                <strong className="text-amber-300">Dysbalance</strong> = muskuläres Ungleichgewicht. 
                Δ {dysbalance} ist die Differenz zwischen der stärksten Gruppe ({strongest?.label}, {strongest?.val}) 
                und der schwächsten Gruppe ({weakest?.label}, {weakest?.val}).
              </p>
              <p className="text-muted-foreground">
                <strong>Coaching-Hinweis:</strong> Plane für die schwächere Gruppe ({weakest?.label}) 
                gezielte Priorisierung ein — z. B. mehr Sätze, höhere Frequenz oder eine isolierte Übung mehr pro Woche. 
                Das reduziert Verletzungsrisiken und beschleunigt den Kraftzuwachs insgesamt.
              </p>
              {dysbalance > 30 && (
                <p className="text-red-300">
                  <strong>Achtung:</strong> Differenz &gt; 30 Punkte — hier empfiehlt sich eine deutliche 
                  Schwerpunktsetzung auf {weakest?.label}, evtl. auch ein zusätzlicher Trainingstag oder 
                  eine Modifikation des Splits zugunsten der schwächeren Kette.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col items-center gap-1 rounded-xl border border-border/50 p-3">
            <StrengthScoreDonut value={last[g.key]} size={72} stroke={8} />
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Einzelwerte</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/50">
                <th className="px-2 py-1 text-left font-medium">Übung</th>
                <th className="px-2 py-1 text-right font-medium">Gewicht</th>
                <th className="px-2 py-1 text-right font-medium">Wdh / Zeit</th>
                <th className="px-2 py-1 text-right font-medium">RPE</th>
                <th className="px-2 py-1 text-right font-medium">e1RM</th>
              </tr>
            </thead>
            <tbody>
              {(last.results ?? []).map((r) => (
                <tr key={r.test_key} className="border-b border-border/30">
                  <td className="px-2 py-1.5">{TEST_LABELS[r.test_key] ?? r.test_key}</td>
                  <td className="px-2 py-1.5 text-right">{r.weight_kg != null ? `${r.weight_kg} kg` : "—"}</td>
                  <td className="px-2 py-1.5 text-right">
                    {r.duration_seconds != null ? `${r.duration_seconds}s` : r.reps != null ? `${r.reps}×` : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right">{r.rpe ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{r.e1rm_kg != null ? `${Number(r.e1rm_kg).toFixed(1)} kg` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pains.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Schmerz-Hinweise
          </div>
          <ul className="ml-4 list-disc space-y-0.5 text-xs text-foreground/80">
            {pains.map((p) => (
              <li key={p.test_key}>
                <span className="font-medium">{TEST_LABELS[p.test_key] ?? p.test_key}:</span> {p.pain_note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {history.length >= 2 && (
        <div className="mt-5">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Verlauf Gesamt-Score</div>
          <TrendSparkline points={history.map((h) => ({ x: h.performed_at, y: h.score_total ?? 0 }))} />
        </div>
      )}
    </div>
  );
}

function TrendSparkline({ points }: { points: { x: string; y: number }[] }) {
  if (points.length < 2) return null;
  const w = 320;
  const h = 60;
  const pad = 4;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys, 0);
  const max = Math.max(...ys, 100);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((p.y - min) / range) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full">
      <path d={path} fill="none" stroke="var(--gold, #d4a82e)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const x = pad + i * stepX;
        const y = h - pad - ((p.y - min) / range) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r={2.5} fill="var(--gold, #d4a82e)" />;
      })}
    </svg>
  );
}
