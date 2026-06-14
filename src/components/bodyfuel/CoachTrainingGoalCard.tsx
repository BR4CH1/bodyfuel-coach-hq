import { labelForTrainingGoal, TRAINING_GOAL_DESCRIPTIONS } from "@/lib/training-goals";

type Targets = {
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  kcal_rest?: number | null;
  protein_g_rest?: number | null;
  carbs_g_rest?: number | null;
  fat_g_rest?: number | null;
} | null;

type Measurement = { measured_at: string; weight_kg: number | null };

export function CoachTrainingGoalCard({
  trainingGoal,
  targets,
  measurements,
}: {
  trainingGoal?: string | null;
  targets: Targets;
  measurements: Measurement[];
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

  // Plateau: latest weight differs <= 0.3 kg from any reading 10–21 days ago
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

  const adjustment =
    trainingGoal === "fat_loss" || trainingGoal === "aggressive_cut"
      ? "−100 bis −200 kcal"
      : trainingGoal === "lean_bulk"
        ? "+100 bis +200 kcal"
        : "±100 kcal nach Bedarf";

  const t = targets ?? {};
  const has = t.kcal != null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Trainingsziel & Makros</h2>
          <p className="text-sm text-muted-foreground">
            {labelForTrainingGoal(trainingGoal)}
          </p>
          {trainingGoal && TRAINING_GOAL_DESCRIPTIONS[trainingGoal] && (
            <p className="mt-1 text-xs text-muted-foreground">
              {TRAINING_GOAL_DESCRIPTIONS[trainingGoal]}
            </p>
          )}
        </div>
        {latest && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Aktuelles Gewicht
            </p>
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

      {!has ? (
        <p className="text-sm text-muted-foreground">
          Sobald Trainingsziel und ein aktuelles Gewicht hinterlegt sind, werden
          Kalorien und Makros automatisch berechnet.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <TargetBlock
            label="Trainingstag"
            kcal={t.kcal}
            p={t.protein_g}
            c={t.carbs_g}
            f={t.fat_g}
          />
          <TargetBlock
            label="Restday"
            kcal={t.kcal_rest ?? t.kcal}
            p={t.protein_g_rest ?? t.protein_g}
            c={t.carbs_g_rest ?? t.carbs_g}
            f={t.fat_g_rest ?? t.fat_g}
          />
        </div>
      )}

      {plateau && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            ⚠️ Gewichtsplateau
          </p>
          <p className="text-amber-900/90 dark:text-amber-200/90">
            Gewicht stagniert seit ~{plateauDays} Tagen. Empfehlung: Kalorien um{" "}
            {adjustment} anpassen.
          </p>
        </div>
      )}
    </div>
  );
}

function TargetBlock({
  label,
  kcal,
  p,
  c,
  f,
}: {
  label: string;
  kcal?: number | null;
  p?: number | null;
  c?: number | null;
  f?: number | null;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold">{kcal ?? "—"} kcal</p>
      <p className="text-xs text-muted-foreground">
        P {p ?? "—"} g · KH {c ?? "—"} g · F {f ?? "—"} g
      </p>
    </div>
  );
}
