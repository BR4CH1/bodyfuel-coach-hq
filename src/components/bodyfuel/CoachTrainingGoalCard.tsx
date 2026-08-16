import { labelForTrainingGoal, TRAINING_GOAL_DESCRIPTIONS, weeklyRate } from "@/lib/training-goals";

type Measurement = { measured_at: string; weight_kg: number | null };

export function CoachTrainingGoalCard({
  trainingGoal,
  measurements,
  goalWeight,
  goalTargetDate,
}: {
  trainingGoal?: string | null;
  measurements: Measurement[];
  goalWeight?: number | null;
  goalTargetDate?: string | null;
}) {
  const weights = (measurements ?? [])
    .filter((m) => m.weight_kg != null)
    .slice(0, 30);
  const latest = weights[0];
  const prev = weights[1];
  const delta =
    latest && prev && latest.weight_kg != null && prev.weight_kg != null
      ? Number((latest.weight_kg - prev.weight_kg).toFixed(1))
      : null;

  const now = Date.now();
  const olderRef = weights.find((m) => {
    const ageDays = (now - new Date(m.measured_at).getTime()) / 86400000;
    return ageDays >= 10 && ageDays <= 21;
  });
  const plateau =
    latest && olderRef && latest.weight_kg != null && olderRef.weight_kg != null
      ? Math.abs(latest.weight_kg - olderRef.weight_kg) <= 0.3
      : false;
  const plateauDays = plateau && olderRef
    ? Math.round((now - new Date(olderRef.measured_at).getTime()) / 86400000)
    : 0;

  const rate = weeklyRate(latest?.weight_kg ?? null, goalWeight ?? null, goalTargetDate ?? null);
  const intensityLabel: Record<string, string> = {
    moderate: "moderat",
    ambitious: "ambitioniert",
    aggressive: "aggressiv",
    capped: "auf Sicherheitslimit begrenzt",
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Trainingsziel & Entwicklung</h2>
          <p className="text-sm text-muted-foreground">{labelForTrainingGoal(trainingGoal)}</p>
          {trainingGoal && TRAINING_GOAL_DESCRIPTIONS[trainingGoal] && (
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              {TRAINING_GOAL_DESCRIPTIONS[trainingGoal]}
            </p>
          )}
        </div>
        {latest && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Aktuelles Gewicht</p>
            <p className="text-base font-semibold">{latest.weight_kg} kg</p>
            {delta !== null && (
              <p
                className={`text-xs ${
                  delta < 0
                    ? "text-emerald-600"
                    : delta > 0
                      ? "text-amber-600"
                      : "text-muted-foreground"
                }`}
              >
                {delta > 0 ? "+" : ""}
                {delta} kg seit letztem Eintrag
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Aktuell" value={latest?.weight_kg != null ? `${latest.weight_kg} kg` : "—"} />
        <Metric label="Zielgewicht" value={goalWeight != null ? `${goalWeight} kg` : "—"} />
        <Metric
          label="Erforderlicher Trend"
          value={rate ? `${rate.kgPerWeek > 0 ? "+" : ""}${rate.kgPerWeek} kg/Woche` : "—"}
        />
      </div>

      {(goalWeight != null || goalTargetDate) && (
        <div className="rounded-lg border border-border bg-background p-3 text-sm">
          <p className="font-semibold">Zielpfad</p>
          <p className="text-muted-foreground">
            Wunschgewicht: {goalWeight != null ? `${goalWeight} kg` : "—"}
            {goalTargetDate ? ` bis ${new Date(goalTargetDate).toLocaleDateString("de-DE")}` : ""}
          </p>
          {rate ? (
            <p className="mt-1 text-muted-foreground">
              Erforderlich: {rate.kgPerWeek > 0 ? "+" : ""}
              {rate.kgPerWeek} kg/Woche ({rate.kcalPerDay > 0 ? "+" : ""}
              {rate.kcalPerDay} kcal/Tag, {intensityLabel[rate.intensity]}).
            </p>
          ) : goalTargetDate ? null : (
            <p className="mt-1 text-xs text-muted-foreground">
              Kein Zieldatum gesetzt – Standardberechnung nach Trainingsziel aktiv.
            </p>
          )}
        </div>
      )}

      {plateau && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-semibold text-amber-900 dark:text-amber-200">⚠️ Gewichtsplateau</p>
          <p className="text-amber-900/90 dark:text-amber-200/90">
            Gewicht stagniert seit etwa {plateauDays} Tagen. Ursache im Check-in prüfen, bevor Ernährung oder Trainingsvolumen angepasst werden.
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  );
}
