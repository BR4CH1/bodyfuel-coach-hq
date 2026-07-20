/**
 * BodyFuel Performance — Auto Plan Pipeline V1
 *
 * Purpose: keep every Bulls/Performance athlete's nutrition plan in sync with
 * what the coach plans without the athlete ever touching a "Plan erstellen"
 * button. All logic here is scoped to (organization_id, performance_context)
 * and is completely isolated from the personal BodyFuel flow.
 *
 * Public entrypoints:
 *   - `enqueuePerformancePlanJob` (server fn) — creates a job row for a
 *     team-wide or single-athlete week regen. Called from coach-side
 *     mutations (team training save, athletic plan changes, etc.) and from
 *     athlete-side profile completion.
 *   - `generateOrUpdatePerformanceNutritionWeekAdmin` — worker-visible fn
 *     that regenerates a full 7-day week for one athlete using the
 *     Performance engine + coach_meal_library pool.
 *
 * The pure decision layer lives in `./plan-builder.ts`; this module only
 * orchestrates I/O.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  pickMealsForDay,
  reoptimizeExistingDay,
  type PoolMeal,
  type PickedMeal,
  type ExistingMeal,
  type MacroTarget,
  type AthletePreferences,
  type SlotKind,
} from "./plan-builder";
import { collectPerformanceDayTypeSignals } from "./day-type-resolver.functions";
import {
  resolvePerformanceDayTypeFromSignals,
  type PerformanceDayTypeKey,
} from "./day-type-resolver";
import { calculatePerformanceNutritionTarget } from "./engine";
import type {
  PerformanceDayType,
  BaselineDailyActivity,
  EnergySex,
  PerformanceGoal,
} from "./constants";
import { PERFORMANCE_NUTRITION_ENGINE_VERSION } from "./constants";

const RESOLVER_TO_ENGINE: Record<PerformanceDayTypeKey, PerformanceDayType> = {
  rest: "REST",
  strength: "STRENGTH",
  football_training: "FOOTBALL_TRAINING",
  game_day: "GAME_DAY",
  double_session: "DOUBLE_SESSION",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PerformancePlanTrigger =
  | "WEEK_PUBLISHED"
  | "TEAM_SCHEDULE_CHANGED"
  | "GAME_ADDED"
  | "GAME_REMOVED"
  | "ATHLETIC_PLAN_CHANGED"
  | "PERFORMANCE_PROFILE_COMPLETED"
  | "PERFORMANCE_GOAL_CHANGED"
  | "WEIGHT_TARGET_RECALCULATED"
  | "CALIBRATION_CHANGED"
  | "MANUAL";

export interface WeekActionResult {
  date: string;
  action:
    | "GENERATED"
    | "REOPTIMIZED"
    | "NO_CHANGE"
    | "SKIPPED_PAST_DATE"
    | "SKIPPED_PROFILE_INCOMPLETE"
    | "SKIPPED_TRACKED_DAY"
    | "SKIPPED_LIBRARY_TOO_SPARSE"
    | "FAILED";
  previousDayType: PerformanceDayType | null;
  newDayType: PerformanceDayType | null;
  previousKcal: number | null;
  newKcal: number | null;
  flags: string[];
  message?: string;
}

export interface WeekRunSummary {
  organizationId: string;
  userId: string;
  weekStart: string;
  generated: number;
  updated: number;
  skipped: number;
  failed: number;
  actions: WeekActionResult[];
}

// ---------------------------------------------------------------------------
// Enqueue server fn (called from coach/athlete mutations)
// ---------------------------------------------------------------------------

export const enqueuePerformancePlanJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      team_id?: string | null;
      athlete_user_id?: string | null;
      week_start: string;
      trigger: PerformancePlanTrigger;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("performance_plan_jobs")
      .insert({
        organization_id: data.organization_id,
        team_id: data.team_id ?? null,
        athlete_user_id: data.athlete_user_id ?? null,
        week_start: data.week_start,
        trigger: data.trigger,
        status: "pending",
        created_by: userId,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      // Duplicate pending job → treat as already-queued success.
      if ((error as { code?: string }).code === "23505") {
        return { ok: true, deduped: true };
      }
      throw new Error(error.message);
    }
    return { ok: true, job_id: (row as { id: string } | null)?.id ?? null };
  });

// ---------------------------------------------------------------------------
// Worker-visible core (called by the cron hook with supabaseAdmin)
// ---------------------------------------------------------------------------

const WEEK_DAYS = 7;

function addDaysISO(dateISO: string, delta: number): string {
  const d = new Date(dateISO + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Regenerate the whole 7-day performance week for ONE athlete inside ONE org.
 * Idempotent: if targets and day type didn't change since the last run, the
 * day is left untouched and reported as NO_CHANGE.
 */
export async function generateOrUpdatePerformanceNutritionWeekAdmin(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    userId: string;
    weekStart: string;
    trigger: PerformancePlanTrigger;
    jobId?: string | null;
  },
): Promise<WeekRunSummary> {
  const { organizationId, userId, weekStart, trigger, jobId } = params;
  const summary: WeekRunSummary = {
    organizationId,
    userId,
    weekStart,
    generated: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    actions: [],
  };

  // 1) Load athlete profile inputs (once for the week — same target params
  // apply, only day type changes per date).
  const [
    { data: profileRow },
    { data: bmRow },
    { data: pnpRow },
    { data: tmRow },
    { data: calibRow },
    { data: smartProfile },
  ] = await Promise.all([
    supabase.from("profiles").select("birthdate, height_cm").eq("id", userId).maybeSingle(),
    supabase
      .from("body_measurements")
      .select("weight_kg")
      .eq("user_id", userId)
      .not("weight_kg", "is", null)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("performance_nutrition_profiles")
      .select("sex_for_energy_calculation, baseline_daily_activity, performance_goal")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("team_memberships")
      .select("position, organization_teams!inner(organization_id)")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("organization_teams.organization_id", organizationId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("performance_nutrition_calibrations")
      .select("personal_calibration_kcal")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("smart_nutrition_profile")
      .select(
        "nogo_foods, extra_nogos, allergies, extra_allergies, intolerances, diet_style, eating_style, meal_prep_style, meal_prep_days",
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const weightKg = bmRow?.weight_kg ? Number(bmRow.weight_kg) : null;
  const position: string | null = (tmRow as { position?: string | null } | null)?.position ?? null;
  const personalCalibrationKcal = calibRow?.personal_calibration_kcal
    ? Number(calibRow.personal_calibration_kcal)
    : 0;

  // Engine-Readiness: Biometrie + PNP-Pflichtfelder.
  const engineMissing =
    !profileRow?.birthdate ||
    !profileRow?.height_cm ||
    weightKg == null ||
    !pnpRow?.sex_for_energy_calculation ||
    !pnpRow?.baseline_daily_activity ||
    !pnpRow?.performance_goal;

  // Meal-Planning-Readiness: SNP-Pflichtfelder für sicheren Plan-Builder.
  // `diet_style`, `meal_prep_style` gesetzt; `allergies`/`intolerances`
  // müssen bewusst gepflegt (auch leer) sein — NULL = ungeprüft = nicht ready.
  const snp = smartProfile as {
    nogo_foods?: string[] | null;
    extra_nogos?: string | null;
    allergies?: string[] | null;
    extra_allergies?: string | null;
    intolerances?: string[] | null;
    diet_style?: string | null;
    eating_style?: string | null;
    meal_prep_style?: string | null;
    meal_prep_days?: number | null;
  } | null;
  const mealPlanningMissing =
    !snp?.diet_style ||
    !snp?.meal_prep_style ||
    snp?.allergies == null ||
    snp?.intolerances == null;

  const profileMissing = engineMissing || mealPlanningMissing;

  // 2) Load recipe pool once (system + coach library, active only).
  const { data: poolRows } = await supabase
    .from("coach_meal_library")
    .select(
      "id, name, description, category, kcal, protein_g, carbs_g, fat_g, suitable_training, suitable_rest, no_go_ingredients, mealprep_ok",
    )
    .eq("is_active", true);
  const pool: PoolMeal[] = ((poolRows as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    category: r.category as SlotKind,
    kcal: Number(r.kcal),
    protein_g: Number(r.protein_g),
    carbs_g: Number(r.carbs_g),
    fat_g: Number(r.fat_g),
    suitable_training: !!r.suitable_training,
    suitable_rest: !!r.suitable_rest,
    no_go_ingredients: Array.isArray(r.no_go_ingredients) ? r.no_go_ingredients : [],
    mealprep_ok: !!r.mealprep_ok,
  }));

  // Merge Allergie-Tokens: allergies + tokenisierte extra_allergies + intolerances.
  const allergyTokens: string[] = [
    ...(snp?.allergies ?? []),
    ...(snp?.intolerances ?? []),
    ...((snp?.extra_allergies ?? "")
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)),
  ];
  const extraNogoTerms: string[] = (snp?.extra_nogos ?? "")
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);

  // wants_snack: eating_style=fresh mit meal_prep_days<=2 → true; sonst true.
  const wantsSnack = true;

  const preferences: AthletePreferences = {
    no_go_ingredients: (snp?.nogo_foods as string[] | null) ?? [],
    extra_nogo_terms: extraNogoTerms,
    allergy_tokens: allergyTokens,
    diet_style: (snp?.diet_style as AthletePreferences["diet_style"]) ?? null,
    meal_prep_style: (snp?.meal_prep_style as AthletePreferences["meal_prep_style"]) ?? null,
    wants_snack: wantsSnack,
  };

  // 3) Ensure a Performance Plan container exists (nutrition_plans row).
  const planId = profileMissing
    ? null
    : await ensurePerformancePlan(supabase, {
        organizationId,
        userId,
        weekStart,
      });

  const today = todayISO();

  for (let i = 0; i < WEEK_DAYS; i++) {
    const date = addDaysISO(weekStart, i);
    try {
      if (date < today) {
        await recordHistory(supabase, {
          userId,
          organizationId,
          planId,
          jobId,
          date,
          trigger,
          action: "SKIPPED_PAST_DATE",
        });
        summary.skipped++;
        summary.actions.push({
          date,
          action: "SKIPPED_PAST_DATE",
          previousDayType: null,
          newDayType: null,
          previousKcal: null,
          newKcal: null,
          flags: [],
        });
        continue;
      }

      if (profileMissing || planId == null) {
        await recordHistory(supabase, {
          userId,
          organizationId,
          planId,
          jobId,
          date,
          trigger,
          action: "SKIPPED_PROFILE_INCOMPLETE",
          flags: { profileMissing: true },
        });
        summary.skipped++;
        summary.actions.push({
          date,
          action: "SKIPPED_PROFILE_INCOMPLETE",
          previousDayType: null,
          newDayType: null,
          previousKcal: null,
          newKcal: null,
          flags: ["PROFILE_INCOMPLETE"],
        });
        continue;
      }

      // 3a) Resolve day type via central resolver.
      const signals = await collectPerformanceDayTypeSignals(supabase, {
        organizationId,
        userId,
        date,
      });
      const resolution = resolvePerformanceDayTypeFromSignals(signals);
      const newDayType: PerformanceDayType = RESOLVER_TO_ENGINE[resolution.dayType];

      // 3b) Engine target.
      const engine = calculatePerformanceNutritionTarget(
        {
          birthDate: profileRow!.birthdate,
          sexForEnergyCalculation: pnpRow!.sex_for_energy_calculation as EnergySex,
          heightCm: Number(profileRow!.height_cm),
          weightKg: weightKg!,
          position,
          performanceGoal: pnpRow!.performance_goal as PerformanceGoal,
          baselineDailyActivity: pnpRow!.baseline_daily_activity as BaselineDailyActivity,
        },
        {
          dayType: newDayType,
          sessionIntensity: null,
          referenceDate: new Date(date + "T12:00:00Z"),
        },
        { personalCalibrationKcal },
      );

      if (
        engine.status === "MISSING_DATA" ||
        engine.targetKcal == null ||
        engine.proteinG == null ||
        engine.carbsG == null ||
        engine.fatG == null
      ) {
        await recordHistory(supabase, {
          userId,
          organizationId,
          planId,
          jobId,
          date,
          trigger,
          action: "SKIPPED_PROFILE_INCOMPLETE",
          newDayType,
          flags: { engineStatus: engine.status },
        });
        summary.skipped++;
        summary.actions.push({
          date,
          action: "SKIPPED_PROFILE_INCOMPLETE",
          previousDayType: null,
          newDayType,
          previousKcal: null,
          newKcal: null,
          flags: ["ENGINE_MISSING_DATA"],
        });
        continue;
      }

      const target: MacroTarget = {
        kcal: engine.targetKcal,
        protein_g: engine.proteinG,
        carbs_g: engine.carbsG,
        fat_g: engine.fatG,
      };

      // 3c) Load existing day (if any).
      const existing = await loadExistingDay(supabase, {
        planId,
        userId,
        date,
      });

      const seed = `${userId}:${date}`;

      if (!existing) {
        const built = pickMealsForDay({
          target,
          dayType: newDayType,
          preferences,
          poolMeals: pool,
          seed,
        });
        if (!built.ok) {
          await recordHistory(supabase, {
            userId,
            organizationId,
            planId,
            jobId,
            date,
            trigger,
            action: "SKIPPED_LIBRARY_TOO_SPARSE",
            newDayType,
            newKcal: target.kcal,
            flags: { missingSlot: built.missingSlot },
            message: built.detail,
          });
          summary.skipped++;
          summary.actions.push({
            date,
            action: "SKIPPED_LIBRARY_TOO_SPARSE",
            previousDayType: null,
            newDayType,
            previousKcal: null,
            newKcal: target.kcal,
            flags: ["LIBRARY_TOO_SPARSE"],
          });
          continue;
        }
        await writeDay(supabase, {
          planId,
          date,
          dayType: newDayType,
          weekStart,
          meals: built.meals,
        });
        await recordHistory(supabase, {
          userId,
          organizationId,
          planId,
          jobId,
          date,
          trigger,
          action: "GENERATED",
          newDayType,
          newKcal: target.kcal,
        });
        summary.generated++;
        summary.actions.push({
          date,
          action: "GENERATED",
          previousDayType: null,
          newDayType,
          previousKcal: null,
          newKcal: target.kcal,
          flags: [],
        });
        continue;
      }

      // Day already exists — check no-change first.
      const prevKcal = existing.meals.reduce((s, m) => s + (m.kcal || 0), 0);
      const prevDayType = existing.dayType;
      const kcalDelta = Math.abs(target.kcal - prevKcal);
      if (
        prevDayType === newDayType &&
        prevKcal > 0 &&
        kcalDelta / prevKcal < 0.03
      ) {
        await recordHistory(supabase, {
          userId,
          organizationId,
          planId,
          jobId,
          date,
          trigger,
          action: "NO_CHANGE",
          previousDayType: prevDayType,
          newDayType,
          previousKcal: prevKcal,
          newKcal: target.kcal,
        });
        summary.actions.push({
          date,
          action: "NO_CHANGE",
          previousDayType: prevDayType,
          newDayType,
          previousKcal: prevKcal,
          newKcal: target.kcal,
          flags: [],
        });
        continue;
      }

      // Guard: today with tracking → protect tracked meals only.
      const hasTracked = existing.meals.some((m) => m.is_tracked);
      if (date === today && hasTracked && kcalDelta / Math.max(prevKcal, 1) < 0.1) {
        await recordHistory(supabase, {
          userId,
          organizationId,
          planId,
          jobId,
          date,
          trigger,
          action: "SKIPPED_TRACKED_DAY",
          previousDayType: prevDayType,
          newDayType,
          previousKcal: prevKcal,
          newKcal: target.kcal,
        });
        summary.skipped++;
        summary.actions.push({
          date,
          action: "SKIPPED_TRACKED_DAY",
          previousDayType: prevDayType,
          newDayType,
          previousKcal: prevKcal,
          newKcal: target.kcal,
          flags: ["ACTIVE_DAY_TRACKED"],
        });
        continue;
      }

      const reopt = reoptimizeExistingDay({
        existingMeals: existing.meals,
        previousDayType: prevDayType,
        newDayType,
        newTarget: target,
        preferences,
        poolMeals: pool,
        seed,
      });

      if ("ok" in reopt && reopt.ok === false) {
        await recordHistory(supabase, {
          userId,
          organizationId,
          planId,
          jobId,
          date,
          trigger,
          action: "SKIPPED_LIBRARY_TOO_SPARSE",
          previousDayType: prevDayType,
          newDayType,
          previousKcal: prevKcal,
          newKcal: target.kcal,
          flags: { missingSlot: reopt.missingSlot },
          message: reopt.detail,
        });
        summary.skipped++;
        summary.actions.push({
          date,
          action: "SKIPPED_LIBRARY_TOO_SPARSE",
          previousDayType: prevDayType,
          newDayType,
          previousKcal: prevKcal,
          newKcal: target.kcal,
          flags: ["LIBRARY_TOO_SPARSE"],
        });
        continue;
      }

      if ("action" in reopt && reopt.action === "NO_CHANGE") {
        await recordHistory(supabase, {
          userId,
          organizationId,
          planId,
          jobId,
          date,
          trigger,
          action: "NO_CHANGE",
          previousDayType: prevDayType,
          newDayType,
          previousKcal: prevKcal,
          newKcal: target.kcal,
        });
        summary.actions.push({
          date,
          action: "NO_CHANGE",
          previousDayType: prevDayType,
          newDayType,
          previousKcal: prevKcal,
          newKcal: target.kcal,
          flags: [],
        });
        continue;
      }

      if ("action" in reopt && reopt.action === "REBUILD") {
        await replaceDayMeals(supabase, {
          planId,
          date,
          dayType: newDayType,
          weekStart,
          protectedIds: existing.meals
            .filter((m) => m.is_locked || m.is_tracked || m.modification_source === "athlete_locked" || m.modification_source === "coach_fixed")
            .map((m) => m.id),
          meals: reopt.meals,
        });
      } else if ("action" in reopt && reopt.action === "SCALE") {
        await applyScaleDelta(supabase, existing.meals, reopt.meals);
      }

      await recordHistory(supabase, {
        userId,
        organizationId,
        planId,
        jobId,
        date,
        trigger,
        action: "REOPTIMIZED",
        previousDayType: prevDayType,
        newDayType,
        previousKcal: prevKcal,
        newKcal: target.kcal,
      });
      summary.updated++;
      summary.actions.push({
        date,
        action: "REOPTIMIZED",
        previousDayType: prevDayType,
        newDayType,
        previousKcal: prevKcal,
        newKcal: target.kcal,
        flags: [],
      });
    } catch (e) {
      const message = (e as Error).message ?? String(e);
      await recordHistory(supabase, {
        userId,
        organizationId,
        planId,
        jobId,
        date,
        trigger,
        action: "FAILED",
        message,
      });
      summary.failed++;
      summary.actions.push({
        date,
        action: "FAILED",
        previousDayType: null,
        newDayType: null,
        previousKcal: null,
        newKcal: null,
        flags: ["ERROR"],
        message,
      });
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Persistence helpers (org-scoped, performance_context=true)
// ---------------------------------------------------------------------------

async function ensurePerformancePlan(
  supabase: SupabaseClient,
  params: { organizationId: string; userId: string; weekStart: string },
): Promise<string> {
  const { organizationId, userId, weekStart } = params;
  const { data: existing } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("client_id", userId)
    .eq("organization_id", organizationId)
    .eq("performance_context", true)
    .eq("plan_type", "nutrition")
    .eq("status", "active")
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const weekEnd = addDaysISO(weekStart, 6);
  const { data: created, error } = await supabase
    .from("nutrition_plans")
    .insert({
      client_id: userId,
      organization_id: organizationId,
      performance_context: true,
      plan_type: "nutrition",
      title: "Performance Woche",
      file_path: "",
      file_name: "",
      status: "active",
      source: "manual",
      generated_by: "performance_auto_pipeline",
      uploaded_by: userId,
      scheduled_start_date: weekStart,
      scheduled_end_date: weekEnd,
      last_auto_generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (created as { id: string }).id;
}

interface LoadedDay {
  dayId: string;
  dayType: PerformanceDayType | null;
  meals: ExistingMeal[];
}

async function loadExistingDay(
  supabase: SupabaseClient,
  params: { planId: string; userId: string; date: string },
): Promise<LoadedDay | null> {
  const { data: dayRow } = await supabase
    .from("nutrition_plan_days")
    .select("id, day_type")
    .eq("plan_id", params.planId)
    .eq("day_date", params.date)
    .maybeSingle();
  if (!dayRow) return null;

  const [{ data: mealRows }, { data: trackedRows }] = await Promise.all([
    supabase
      .from("nutrition_plan_meals")
      .select(
        "id, library_meal_id, meal_slot, sort_order, kcal, protein_g, carbs_g, fat_g, is_locked, linked_prep_group, modification_source",
      )
      .eq("day_id", dayRow.id)
      .order("sort_order"),
    supabase
      .from("food_entries")
      .select("source")
      .eq("user_id", params.userId)
      .eq("entry_date", params.date)
      .like("source", "perf_plan:%"),
  ]);
  const trackedIds = new Set<string>(
    ((trackedRows as { source: string }[]) ?? []).map((r) =>
      r.source.slice("perf_plan:".length),
    ),
  );

  const meals: ExistingMeal[] = ((mealRows as any[]) ?? []).map((r) => ({
    id: r.id,
    library_meal_id: r.library_meal_id ?? null,
    meal_slot: (r.meal_slot ?? null) as SlotKind | null,
    sort_order: r.sort_order,
    kcal: Number(r.kcal ?? 0),
    protein_g: Number(r.protein_g ?? 0),
    carbs_g: Number(r.carbs_g ?? 0),
    fat_g: Number(r.fat_g ?? 0),
    is_locked: !!r.is_locked,
    linked_prep_group: r.linked_prep_group ?? null,
    modification_source: r.modification_source ?? null,
    is_tracked: trackedIds.has(r.id),
  }));

  // Map back the stored day_type ('training'/'rest' CHECK) into a rough
  // PerformanceDayType for the change-detection comparison.
  const raw = (dayRow as { day_type?: string | null }).day_type ?? null;
  const dayType: PerformanceDayType | null =
    raw === "training" ? "FOOTBALL_TRAINING" : raw === "rest" ? "REST" : null;
  return { dayId: (dayRow as { id: string }).id, dayType, meals };
}

async function writeDay(
  supabase: SupabaseClient,
  params: {
    planId: string;
    date: string;
    dayType: PerformanceDayType;
    weekStart: string;
    meals: PickedMeal[];
  },
): Promise<void> {
  const legacyDayType = params.dayType === "REST" ? "rest" : "training";
  const dayIdx = Math.round(
    (new Date(params.date + "T12:00:00Z").getTime() -
      new Date(params.weekStart + "T12:00:00Z").getTime()) /
      86400000,
  );
  const { data: day, error: dErr } = await supabase
    .from("nutrition_plan_days")
    .insert({
      plan_id: params.planId,
      name: params.date,
      sort_order: dayIdx + 1,
      week_number: 1,
      day_type: legacyDayType,
      day_date: params.date,
    })
    .select("id")
    .single();
  if (dErr) throw new Error(dErr.message);
  const dayId = (day as { id: string }).id;

  const rows = params.meals.map((m, i) => ({
    day_id: dayId,
    name: m.name,
    description: m.description,
    kcal: m.kcal,
    protein_g: m.protein_g,
    carbs_g: m.carbs_g,
    fat_g: m.fat_g,
    sort_order: m.sort_order ?? i,
    meal_slot: m.meal_slot,
    library_meal_id: m.library_meal_id || null,
    modification_source: "auto_generated" as const,
    data_source: "coach_verified" as const,
  }));
  if (rows.length) {
    const { error: mErr } = await supabase.from("nutrition_plan_meals").insert(rows);
    if (mErr) throw new Error(mErr.message);
  }
}

async function replaceDayMeals(
  supabase: SupabaseClient,
  params: {
    planId: string;
    date: string;
    dayType: PerformanceDayType;
    weekStart: string;
    protectedIds: string[];
    meals: PickedMeal[];
  },
): Promise<void> {
  const { data: day } = await supabase
    .from("nutrition_plan_days")
    .select("id")
    .eq("plan_id", params.planId)
    .eq("day_date", params.date)
    .maybeSingle();
  if (!day) {
    return writeDay(supabase, params);
  }
  const dayId = (day as { id: string }).id;
  // Delete only auto_generated + unlocked + untracked meals.
  const del = supabase
    .from("nutrition_plan_meals")
    .delete()
    .eq("day_id", dayId)
    .in("modification_source", ["auto_generated"])
    .eq("is_locked", false);
  if (params.protectedIds.length) {
    del.not("id", "in", `(${params.protectedIds.join(",")})`);
  }
  const { error: delErr } = await del;
  if (delErr) throw new Error(delErr.message);

  const rows = params.meals.map((m, i) => ({
    day_id: dayId,
    name: m.name,
    description: m.description,
    kcal: m.kcal,
    protein_g: m.protein_g,
    carbs_g: m.carbs_g,
    fat_g: m.fat_g,
    sort_order: m.sort_order ?? i,
    meal_slot: m.meal_slot,
    library_meal_id: m.library_meal_id || null,
    modification_source: "auto_generated" as const,
    data_source: "coach_verified" as const,
  }));
  if (rows.length) {
    const { error } = await supabase.from("nutrition_plan_meals").insert(rows);
    if (error) throw new Error(error.message);
  }
  // Update day_type on existing day row.
  await supabase
    .from("nutrition_plan_days")
    .update({ day_type: params.dayType === "REST" ? "rest" : "training" })
    .eq("id", dayId);
}

async function applyScaleDelta(
  supabase: SupabaseClient,
  existing: ExistingMeal[],
  scaled: PickedMeal[],
): Promise<void> {
  // Update-by-sort_order (scale delta entries have no meal id).
  const bySort = new Map(existing.map((m) => [m.sort_order, m]));
  for (const s of scaled) {
    const src = bySort.get(s.sort_order);
    if (!src) continue;
    await supabase
      .from("nutrition_plan_meals")
      .update({
        kcal: s.kcal,
        protein_g: s.protein_g,
        carbs_g: s.carbs_g,
        fat_g: s.fat_g,
      })
      .eq("id", src.id);
  }
}

async function recordHistory(
  supabase: SupabaseClient,
  params: {
    userId: string;
    organizationId: string;
    planId: string | null;
    jobId?: string | null;
    date: string;
    trigger: PerformancePlanTrigger;
    action: WeekActionResult["action"];
    previousDayType?: PerformanceDayType | null;
    newDayType?: PerformanceDayType | null;
    previousKcal?: number | null;
    newKcal?: number | null;
    flags?: Record<string, unknown>;
    message?: string;
  },
): Promise<void> {
  await supabase.from("performance_plan_history").insert({
    user_id: params.userId,
    organization_id: params.organizationId,
    plan_id: params.planId,
    job_id: params.jobId ?? null,
    date: params.date,
    trigger: params.trigger,
    action: params.action,
    previous_day_type: params.previousDayType ?? null,
    new_day_type: params.newDayType ?? null,
    previous_target_kcal: params.previousKcal ?? null,
    new_target_kcal: params.newKcal ?? null,
    engine_version: String(PERFORMANCE_NUTRITION_ENGINE_VERSION),
    flags: params.flags ?? {},
    message: params.message ?? null,
  });
}
