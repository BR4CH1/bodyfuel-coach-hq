from pathlib import Path

ROOT = Path.cwd()


def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, got {count}\n--- needle ---\n{old}")
    p.write_text(text.replace(old, new, 1))


route = "src/routes/coach.customers.$userId.tsx"

# Remove the duplicate standalone nutrition-history surface. PlanManagement already owns active/next/archive.
replace_once(
    route,
    'import { CoachNutritionPlanHistoryCard } from "@/components/bodyfuel/CoachNutritionPlanHistoryCard";\n',
    '',
)

# Nutrition: one primary flow; fallback/plan-basis tools are secondary details.
replace_once(
    route,
    '''      {activeTab === "ernaehrung" && (
        <TabPanel title="Ernährung" subtitle="Targets, Ernährungsplan und Ernährungsverhalten an einem Ort.">
          <MacroTargetsCard userId={userId} />
          <NutritionTargetsEditor userId={userId} />
          <SmartNutritionInsightsCard userId={userId} />
          <PlanManagementCard userId={userId} />
          <Button variant="secondary" className="w-full" asChild>
            <Link to="/coach/plan-builder/$userId" params={{ userId }}>
              Plan manuell erstellen
            </Link>
          </Button>
          <CoachNutritionPlanHistoryCard userId={userId} />
          <CoachKitchenEquipmentCard userId={userId} />
          <MealWishesCard userId={userId} mode="coach" />
          <RecipeInsightsCard userId={userId} />
        </TabPanel>
      )}
''',
    '''      {activeTab === "ernaehrung" && (
        <TabPanel
          title="Ernährung"
          subtitle="Aktuelle Zielwerte, Planstatus und Adhärenz zuerst — Planungsdetails nur bei Bedarf."
        >
          <MacroTargetsCard userId={userId} />
          <SmartNutritionInsightsCard userId={userId} />
          <PlanManagementCard userId={userId} />

          <SubpointDetails
            title="Fallback-Ziele & Wasser"
            subtitle="Nur relevant, wenn kein aktiver Ernährungsplan den Tracker steuert."
          >
            <NutritionTargetsEditor userId={userId} />
          </SubpointDetails>

          <SubpointDetails
            title="Planungsgrundlagen"
            subtitle="Wunschgerichte, Küchenausstattung und Rezeptfeedback für die nächste Planrunde."
          >
            <div className="space-y-5">
              <MealWishesCard userId={userId} mode="coach" />
              <CoachKitchenEquipmentCard userId={userId} />
              <RecipeInsightsCard userId={userId} />
            </div>
          </SubpointDetails>
        </TabPanel>
      )}
''',
)

# Training: plan + alerts + development first; deep diagnostics secondary. No nutrition macros in this tab.
replace_once(
    route,
    '''      {activeTab === "training" && (
        <TabPanel title="Training" subtitle="Planung, Belastung, Strength Check und freie Einheiten.">
          <StepGoalEditor userId={userId} initial={profile.daily_step_goal ?? 10000} />
          <CoachTrainingGoalCard
            trainingGoal={profile.training_goal ?? null}
            targets={(data as any).targets ?? null}
            measurements={(data.measurements ?? []) as any}
            goalWeight={profile.goal_weight_kg ?? null}
            goalTargetDate={profile.goal_target_date ?? null}
          />
          <GoalProjectionCard profile={profile} currentWeight={currentWeight} />
          <TrainingPlanManagementCard userId={userId} />
          <CoachStrengthCheckCard userId={userId} />
          <CoachTrainingAlertsCard userId={userId} />
          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-display text-base font-bold">Freie Trainingseinheiten</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Kurse, Sport, Mobility und andere Einheiten, die der Kunde außerhalb des Plans geloggt hat.
            </p>
            <div className="mt-3">
              <TrainingSessionsList clientId={userId} days={30} />
            </div>
          </section>
          <TrainingBonusCard userId={userId} isCoach />
          <CoachTrainingSummary clientId={userId} />
        </TabPanel>
      )}
''',
    '''      {activeTab === "training" && (
        <TabPanel
          title="Training"
          subtitle="Aktiver Plan, Auffälligkeiten und Entwicklung zuerst — Detaildiagnostik nur bei Bedarf."
        >
          <TrainingPlanManagementCard userId={userId} />
          <CoachTrainingAlertsCard userId={userId} />
          <CoachTrainingSummary clientId={userId} />
          <CoachTrainingGoalCard
            trainingGoal={profile.training_goal ?? null}
            measurements={(data.measurements ?? []) as any}
            goalWeight={profile.goal_weight_kg ?? null}
            goalTargetDate={profile.goal_target_date ?? null}
          />
          <GoalProjectionCard profile={profile} currentWeight={currentWeight} />

          <SubpointDetails
            title="Alltag & Schrittziel"
            subtitle="NEAT-Vorgabe separat anpassen, ohne die Trainingsanalyse zu überladen."
          >
            <StepGoalEditor userId={userId} initial={profile.daily_step_goal ?? 10000} />
          </SubpointDetails>

          <SubpointDetails
            title="Strength Check"
            subtitle="Kraftprofil, Dysbalancen, Einzelwerte und Verlauf."
          >
            <CoachStrengthCheckCard userId={userId} />
          </SubpointDetails>

          <SubpointDetails
            title="Freie Einheiten & Trainingsbonus"
            subtitle="Sport, Kurse, Mobility sowie PR- und Bonusdaten außerhalb des Plan-Kernflows."
          >
            <div className="space-y-5">
              <section className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-display text-base font-bold">Freie Trainingseinheiten</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Kurse, Sport, Mobility und andere Einheiten, die der Kunde außerhalb des Plans geloggt hat.
                </p>
                <div className="mt-3">
                  <TrainingSessionsList clientId={userId} days={30} />
                </div>
              </section>
              <TrainingBonusCard userId={userId} isCoach />
            </div>
          </SubpointDetails>
        </TabPanel>
      )}
''',
)

# Progress: turn separate widgets into a clear check-in workflow, then historic evidence.
replace_once(
    route,
    '''      {activeTab === "fortschritt" && (
        <TabPanel
          title="Fortschritt & Check-ins"
          subtitle="Gewicht, Maße, Fotos, Check-ins und Plananpassungen."
        >
          <SectionErrorBoundary label="Gewichtsentwicklung">
            <WeightProgressChart
              measurements={(data.measurements ?? []) as any}
              goalWeight={profile.goal_weight_kg ?? null}
              title="Gewichtsentwicklung"
              emptyHint="Sobald der Kunde sein erstes Gewicht einträgt, erscheint hier sein Verlauf."
            />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="Maße & Gewicht">
            <MeasurementsCard measurements={data.measurements ?? []} />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="Fortschrittsfotos">
            <ProgressPhotosCard userId={userId} readOnly />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="Foto-Auswertung">
            <PhotoAssessmentCard userId={userId} isCoach />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="AI Check-in Entwurf">
            <AiCheckinDraftCard userId={userId} />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="Plan-Anpassungen">
            <PlanAdjustmentsCard userId={userId} />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="Check-ins">
            <CustomerCheckinsCard userId={userId} />
          </SectionErrorBoundary>
        </TabPanel>
      )}
''',
    '''      {activeTab === "fortschritt" && (
        <TabPanel
          title="Fortschritt & Check-ins"
          subtitle="Check-in lesen → Entwurf prüfen → Maßnahmen entscheiden → Verlauf kontrollieren."
        >
          <SectionErrorBoundary label="Check-ins">
            <CustomerCheckinsCard userId={userId} />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="AI Check-in Entwurf">
            <AiCheckinDraftCard userId={userId} />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="Plan-Anpassungen">
            <PlanAdjustmentsCard userId={userId} />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="Gewichtsentwicklung">
            <WeightProgressChart
              measurements={(data.measurements ?? []) as any}
              goalWeight={profile.goal_weight_kg ?? null}
              title="Gewichtsentwicklung"
              emptyHint="Sobald der Kunde sein erstes Gewicht einträgt, erscheint hier sein Verlauf."
            />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="Maße & Gewicht">
            <MeasurementsCard measurements={data.measurements ?? []} />
          </SectionErrorBoundary>

          <SubpointDetails
            title="Fortschrittsfotos & Vergleich"
            subtitle="Foto-Sets und Coach-Auswertung zusammen an einem Ort."
          >
            <div className="space-y-5">
              <SectionErrorBoundary label="Fortschrittsfotos">
                <ProgressPhotosCard userId={userId} readOnly />
              </SectionErrorBoundary>
              <SectionErrorBoundary label="Foto-Auswertung">
                <PhotoAssessmentCard userId={userId} isCoach />
              </SectionErrorBoundary>
            </div>
          </SubpointDetails>
        </TabPanel>
      )}
''',
)

# Administration: summaries stay visible, edit-heavy forms only open on demand.
replace_once(
    route,
    '''            <CoachBaseDataEditor
              userId={userId}
              currentWeightKg={currentWeight}
              initial={{
                height_cm: profile.height_cm ?? null,
                birthdate: profile.birthdate ?? null,
                gender: profile.gender ?? null,
                goal_weight_kg: profile.goal_weight_kg ?? null,
                goal_target_date: profile.goal_target_date ?? null,
                activity_level: profile.activity_level ?? null,
                training_goal: profile.training_goal ?? null,
              }}
            />

            <AthleteProfileEditor
              userId={userId}
              mode="coach"
              initial={{
                sport: profile.sport ?? null,
                sport_position: profile.sport_position ?? null,
                sport_level: profile.sport_level ?? null,
                team_sport: profile.team_sport ?? false,
                match_days_per_week: profile.match_days_per_week ?? null,
                practice_days_per_week: profile.practice_days_per_week ?? null,
                season_phase: profile.season_phase ?? null,
                class_types: profile.class_types ?? [],
                class_days_per_week: profile.class_days_per_week ?? null,
                mobility_frequency: profile.mobility_frequency ?? null,
                mobility_focus: profile.mobility_focus ?? null,
                cardio_outside_gym: profile.cardio_outside_gym ?? null,
                injuries: profile.injuries ?? null,
                training_experience: profile.training_experience ?? null,
              }}
            />
''',
    '''            <SubpointDetails
              title="Stammdaten bearbeiten"
              subtitle="Größe, Zielgewicht, Aktivitätslevel und Trainingsziel ändern."
            >
              <CoachBaseDataEditor
                userId={userId}
                currentWeightKg={currentWeight}
                initial={{
                  height_cm: profile.height_cm ?? null,
                  birthdate: profile.birthdate ?? null,
                  gender: profile.gender ?? null,
                  goal_weight_kg: profile.goal_weight_kg ?? null,
                  goal_target_date: profile.goal_target_date ?? null,
                  activity_level: profile.activity_level ?? null,
                  training_goal: profile.training_goal ?? null,
                }}
              />
            </SubpointDetails>

            <SubpointDetails
              title="Trainings- & Sportprofil bearbeiten"
              subtitle="Sportart, Trainingswoche, Verletzungen, Mobility und Leistungskontext."
            >
              <AthleteProfileEditor
                userId={userId}
                mode="coach"
                initial={{
                  sport: profile.sport ?? null,
                  sport_position: profile.sport_position ?? null,
                  sport_level: profile.sport_level ?? null,
                  team_sport: profile.team_sport ?? false,
                  match_days_per_week: profile.match_days_per_week ?? null,
                  practice_days_per_week: profile.practice_days_per_week ?? null,
                  season_phase: profile.season_phase ?? null,
                  class_types: profile.class_types ?? [],
                  class_days_per_week: profile.class_days_per_week ?? null,
                  mobility_frequency: profile.mobility_frequency ?? null,
                  mobility_focus: profile.mobility_focus ?? null,
                  cardio_outside_gym: profile.cardio_outside_gym ?? null,
                  injuries: profile.injuries ?? null,
                  training_experience: profile.training_experience ?? null,
                }}
              />
            </SubpointDetails>
''',
)

# Shared secondary-detail shell.
replace_once(
    route,
    '''function AdminSection({
  title,
  subtitle,
  children,
}: {
''',
    '''function SubpointDetails({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-border bg-secondary/10">
      <summary className="cursor-pointer list-none px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold">{title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-muted-foreground group-open:hidden">
            Öffnen
          </span>
          <span className="hidden shrink-0 text-xs font-semibold text-muted-foreground group-open:inline">
            Schließen
          </span>
        </div>
      </summary>
      <div className="border-t border-border p-4 sm:p-5">{children}</div>
    </details>
  );
}

function AdminSection({
  title,
  subtitle,
  children,
}: {
''',
)

# Smart Nutrition: auto-publish has one owner in Plan Management, not a duplicate toggle here.
smart = "src/components/bodyfuel/SmartNutritionInsightsCard.tsx"
replace_once(
    smart,
    'import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";',
    'import { useQuery } from "@tanstack/react-query";',
)
replace_once(smart, 'import { toast } from "sonner";\n', '')
replace_once(
    smart,
    '''  getCustomerSkipBreakdown,
  setCustomerAutoPublish,
} from "@/lib/coach-smart-insights.functions";''',
    '''  getCustomerSkipBreakdown,
} from "@/lib/coach-smart-insights.functions";''',
)
replace_once(
    smart,
    '''  const qc = useQueryClient();
  const profileFn = useServerFn(getCustomerSmartProfile);
  const riskFn = useServerFn(getCustomerRiskFlags);
  const skipFn = useServerFn(getCustomerSkipBreakdown);
  const autoFn = useServerFn(setCustomerAutoPublish);
  
''',
    '''  const profileFn = useServerFn(getCustomerSmartProfile);
  const riskFn = useServerFn(getCustomerRiskFlags);
  const skipFn = useServerFn(getCustomerSkipBreakdown);

''',
)
replace_once(
    smart,
    '''  const toggleAuto = useMutation({
    mutationFn: (val: boolean) => autoFn({ data: { user_id: userId, auto_publish: val } }),
    onSuccess: () => {
      toast.success("Gespeichert.");
      qc.invalidateQueries({ queryKey: ["smart-profile", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

''',
    '',
)
replace_once(
    smart,
    '''            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id={`auto-${userId}`}
                checked={!!p.auto_publish}
                disabled={toggleAuto.isPending}
                onChange={(e) => toggleAuto.mutate(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor={`auto-${userId}`} className="text-xs">
                Auto-Publish: Pläne automatisch aktivieren (sonst Coach-Freigabe nötig)
              </label>
            </div>
''',
    '',
)

# Training goal card: training context only; nutrition macros belong in Nutrition.
(ROOT / "src/components/bodyfuel/CoachTrainingGoalCard.tsx").write_text(r'''import { labelForTrainingGoal, TRAINING_GOAL_DESCRIPTIONS, weeklyRate } from "@/lib/training-goals";

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
''')

# Layout regression guard.
(ROOT / "src/lib/__tests__/customer-subpoints-layout.test.ts").write_text(r'''import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

describe("coach customer subpoint information architecture", () => {
  const route = read("src/routes/coach.customers.$userId.tsx");

  it("uses one primary nutrition plan-management surface", () => {
    expect(route).toContain("<PlanManagementCard userId={userId} />");
    expect(route).not.toContain("<CoachNutritionPlanHistoryCard");
    expect(route).not.toContain("Plan manuell erstellen");
  });

  it("orders the progress tab as a check-in workflow", () => {
    const checkins = route.indexOf("<CustomerCheckinsCard userId={userId} />");
    const draft = route.indexOf("<AiCheckinDraftCard userId={userId} />");
    const adjustments = route.indexOf("<PlanAdjustmentsCard userId={userId} />");
    const weight = route.indexOf("<WeightProgressChart");
    expect(checkins).toBeGreaterThan(0);
    expect(checkins).toBeLessThan(draft);
    expect(draft).toBeLessThan(adjustments);
    expect(adjustments).toBeLessThan(weight);
  });

  it("keeps nutrition macros out of the training-goal card", () => {
    const trainingGoal = read("src/components/bodyfuel/CoachTrainingGoalCard.tsx");
    expect(trainingGoal).not.toContain("protein_g");
    expect(trainingGoal).not.toContain("carbs_g");
    expect(trainingGoal).not.toContain("fat_g");
  });

  it("has only one visible auto-publish owner", () => {
    const smart = read("src/components/bodyfuel/SmartNutritionInsightsCard.tsx");
    expect(smart).not.toContain("setCustomerAutoPublish");
    expect(smart).not.toContain("Auto-Publish:");
  });
});
''')

print("Customer subpoint layout patch applied.")
