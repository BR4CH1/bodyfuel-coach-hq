import { useState } from "react";
import { Trophy, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { StrengthScoreDonut } from "./StrengthScoreDonut";

type GroupScore = { key: string; label: string; val: number | null };

export function StrengthSummaryCard({
  total,
  groups,
  performedAt,
  bodyweightKg,
}: {
  total: number | null;
  groups: GroupScore[];
  performedAt: string;
  bodyweightKg: number | null;
}) {
  const scores = groups
    .map((g) => ({ ...g, val: g.val ?? 0 }))
    .filter((g) => g.val != null && typeof g.val === "number");

  const strongest = scores.length ? scores.reduce((a, b) => (a.val >= b.val ? a : b)) : null;
  const weakest = scores.length ? scores.reduce((a, b) => (a.val <= b.val ? a : b)) : null;
  const dysbalance = strongest && weakest ? strongest.val - weakest.val : 0;

  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Strength Check</h2>
        <div className="text-xs text-muted-foreground">
          {new Date(performedAt).toLocaleDateString("de-DE")}
          {bodyweightKg ? ` · ${bodyweightKg} kg KG` : ""}
        </div>
      </div>

      {/* Gesamt-Score */}
      <div className="flex items-center gap-5">
        <StrengthScoreDonut value={total} size={140} stroke={12} />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gesamt-Score</div>
          <div className="font-display text-3xl font-bold">
            {total ?? "—"}<span className="text-base text-muted-foreground">/100</span>
          </div>
        </div>
      </div>

      {/* Stärkste / Schwächste / Dysbalance */}
      <div className="space-y-2 text-sm">
        {strongest && (
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Stärkste Gruppe: <strong>{strongest.label}</strong> ({strongest.val})</span>
          </div>
        )}
        {weakest && weakest.key !== strongest?.key && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400 shrink-0" />
            <span>Schwächste Gruppe: <strong>{weakest.label}</strong> ({weakest.val})</span>
          </div>
        )}
        {dysbalance > 20 && (
          <div className="flex items-start gap-2 text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
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

        {/* Dysbalance Erklärung */}
        {showExplanation && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs space-y-2">
            <p>
              <strong className="text-amber-300">Dysbalance</strong> bedeutet ein <strong>muskuläres Ungleichgewicht</strong> zwischen deinen Körperregionen. 
              Der Wert Δ {dysbalance} zeigt den Unterschied zwischen deiner stärksten Gruppe ({strongest?.label}, {strongest?.val}) 
              und deiner schwächsten Gruppe ({weakest?.label}, {weakest?.val}).
            </p>
            <p className="text-muted-foreground">
              Je größer die Differenz, desto stärker ist das Ungleichgewicht. Dein Trainingsplan wird gezielt darauf ausgelegt, 
              die schwächeren Bereiche stärker zu fordern und so eine ausgewogene Kraftentwicklung zu fördern. 
              Das schützt vor Verletzungen und sorgt für bessere Gesamtleistung.
            </p>
            {dysbalance > 30 && (
              <p className="text-red-300">
                <strong>Hinweis:</strong> Bei einer Differenz über 30 Punkten empfehlen wir, die schwächere Gruppe 
                gezielt zu priorisieren – z. B. durch zusätzliche Sätze oder ein zusätzliches Trainingstag für {weakest?.label}.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Gruppen-Scores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {groups.map((g) => (
          <div
            key={g.key}
            className={`flex flex-col items-center gap-1 rounded-xl border p-3 ${
              g.key === strongest?.key
                ? "border-emerald-500/30 bg-emerald-500/5"
                : g.key === weakest?.key
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-border/50"
            }`}
          >
            <StrengthScoreDonut value={g.val} size={80} stroke={9} />
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
