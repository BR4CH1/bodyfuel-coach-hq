/**
 * BodyFuel Performance Nutrition Engine V1 — Server Functions (Phase 2a)
 *
 * Read/Write layer around the pure engine. Organization-scoped.
 *
 * Client-safe module (imported by routes/components). All privileged access
 * happens inside handlers via requireSupabaseAuth (RLS as signed-in user).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculatePerformanceNutritionTarget } from "./engine";
import { collectPerformanceDayTypeSignals } from "./day-type-resolver.functions";
import { resolvePerformanceDayTypeFromSignals } from "./day-type-resolver";
import type {
  BaselineDailyActivity,
  EnergySex,
  PerformanceDayType,
  PerformanceGoal,
  SessionIntensity,
} from "./constants";
import { PERFORMANCE_NUTRITION_ENGINE_VERSION } from "./constants";
import type { PerformanceNutritionResult } from "./types";

// ---------------------------------------------------------------------------
// Profile: sex/baseline/goal — org-scoped
// ---------------------------------------------------------------------------

export const getPerformanceNutritionProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("performance_nutrition_profiles")
      .select(
        "sex_for_energy_calculation, baseline_daily_activity, performance_goal, updated_at",
      )
      .eq("user_id", userId)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });

export const savePerformanceNutritionProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      organization_id: string;
      sex_for_energy_calculation: EnergySex | null;
      baseline_daily_activity: BaselineDailyActivity | null;
      performance_goal: PerformanceGoal | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("performance_nutrition_profiles").upsert(
      {
        user_id: userId,
        organization_id: data.organization_id,
        sex_for_energy_calculation: data.sex_for_energy_calculation,
        baseline_daily_activity: data.baseline_daily_activity,
        performance_goal: data.performance_goal,
      },
      { onConflict: "user_id,organization_id" },
    );
    if (error) throw new Error(error.message);

    // Auto-Plan-Trigger: sobald das Performance-Profil vollständig ist,
    // wird für diesen Athleten ein Ernährungsplan-Job für die aktuelle
    // Woche eingereiht. Fehler brechen den Save nie.
    const complete =
      !!data.sex_for_energy_calculation &&
      !!data.baseline_daily_activity &&
      !!data.performance_goal;
    if (complete) {
      try {
        const now = new Date();
        const day = now.getUTCDay();
        const monday = new Date(now);
        monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
        const weekStart = monday.toISOString().slice(0, 10);
        await supabase.from("performance_plan_jobs").insert({
          organization_id: data.organization_id,
          athlete_user_id: userId,
          week_start: weekStart,
          trigger: "PERFORMANCE_PROFILE_COMPLETED",
          status: "pending",
          created_by: userId,
        });
      } catch {
        /* dedupe / RLS errors: best-effort */
      }
    }

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// getNutritionTargetForDate
// ---------------------------------------------------------------------------

/**
 * Resolve the full daily target for one athlete on one date, in one org context.
 *
 * Priority chain (Phase 2a):
 *   1. Engine (pure) — with org-scoped profile + calibration + day type override
 *   2. Coach override (NOT YET WIRED — will land in a later Phase 2 step)
 *
 * Never mixes with the personal BodyFuel Smart context (`nutrition_targets`).
 */
export const getNutritionTargetForDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      organization_id: string;
      /** YYYY-MM-DD */
      date: string;
      /** Optional explicit override; else resolved from day_type_overrides for that date, else REST. */
      day_type?: PerformanceDayType;
      session_intensity?: SessionIntensity | null;
      /** If true, append a row to performance_nutrition_calculations. Default false. */
      persist?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Athlete profile basics (personal) — profiles table
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("birthdate, height_cm")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);

    // 2) Latest weight — prefer body_measurements (most recent)
    const { data: bmRows } = await supabase
      .from("body_measurements")
      .select("weight_kg, measured_at")
      .eq("user_id", userId)
      .not("weight_kg", "is", null)
      .order("measured_at", { ascending: false })
      .limit(1);
    let weightKg: number | null =
      bmRows && bmRows.length ? Number(bmRows[0].weight_kg) : null;

    if (weightKg == null) {
      // Fallback: bulls_weight_logs
      const { data: bwRows } = await supabase
        .from("bulls_weight_logs")
        .select("weight_kg, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (bwRows && bwRows.length) weightKg = Number(bwRows[0].weight_kg);
    }

    // 3) Org-scoped performance nutrition profile
    const { data: pnp, error: pnpErr } = await supabase
      .from("performance_nutrition_profiles")
      .select("sex_for_energy_calculation, baseline_daily_activity, performance_goal")
      .eq("user_id", userId)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (pnpErr) throw new Error(pnpErr.message);

    // 4) Position — team_memberships (team scoped to org)
    const { data: tmRows } = await supabase
      .from("team_memberships")
      .select("position, organization_teams!inner(organization_id)")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("organization_teams.organization_id", data.organization_id)
      .limit(1);
    const position: string | null =
      tmRows && tmRows.length ? (tmRows[0] as any).position ?? null : null;

    // 5) Day type: explicit → central Performance Day Type Resolver → REST.
    //    The resolver considers manual (real perf) overrides plus structural
    //    signals (team football, strength assignments, game events, individual
    //    training) and enforces the priority ladder. Legacy "training" is
    //    never silently mapped.
    const UI_TO_ENGINE_DT: Record<string, PerformanceDayType> = {
      rest: "REST",
      strength: "STRENGTH",
      football_training: "FOOTBALL_TRAINING",
      game_day: "GAME_DAY",
      double_session: "DOUBLE_SESSION",
    };
    let dayType: PerformanceDayType = data.day_type ?? "REST";
    if (!data.day_type) {
      const signals = await collectPerformanceDayTypeSignals(supabase, {
        organizationId: data.organization_id,
        userId,
        date: data.date,
      });
      const resolution = resolvePerformanceDayTypeFromSignals(signals);
      dayType = UI_TO_ENGINE_DT[resolution.dayType] ?? "REST";
    }

    // 6) Calibration — org-scoped, adults only (engine enforces youth=0)
    const { data: calib } = await supabase
      .from("performance_nutrition_calibrations")
      .select("personal_calibration_kcal")
      .eq("user_id", userId)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    const personalCalibrationKcal = calib?.personal_calibration_kcal
      ? Number(calib.personal_calibration_kcal)
      : 0;

    const referenceDate = new Date(data.date + "T12:00:00Z");

    const result: PerformanceNutritionResult = calculatePerformanceNutritionTarget(
      {
        birthDate: profile?.birthdate ?? null,
        sexForEnergyCalculation:
          (pnp?.sex_for_energy_calculation as EnergySex | null) ?? null,
        heightCm: profile?.height_cm ? Number(profile.height_cm) : null,
        weightKg,
        position,
        performanceGoal: (pnp?.performance_goal as PerformanceGoal | null) ?? null,
        baselineDailyActivity:
          (pnp?.baseline_daily_activity as BaselineDailyActivity | null) ?? null,
      },
      {
        dayType,
        sessionIntensity: data.session_intensity ?? null,
        referenceDate,
      },
      { personalCalibrationKcal },
    );

    // 7) Optional append-only persistence
    if (data.persist && result.status === "CALCULATED") {
      await supabase.from("performance_nutrition_calculations").insert({
        user_id: userId,
        organization_id: data.organization_id,
        calculation_date: data.date,
        engine_version: PERFORMANCE_NUTRITION_ENGINE_VERSION,
        day_type: result.dayType,
        pal_category: result.palCategory,
        position_cluster: result.positionCluster,
        performance_goal: result.performanceGoal,
        effective_goal: result.effectiveGoal,
        session_intensity: data.session_intensity ?? null,
        age_at_calculation: result.age,
        weight_kg: weightKg,
        height_cm: profile?.height_cm ? Number(profile.height_cm) : null,
        initial_eer: result.initialEer,
        goal_modifier: result.goalModifier,
        goal_adjusted_energy: result.goalAdjustedEnergy,
        personal_calibration_kcal: result.personalCalibrationKcal,
        protein_g: result.proteinG,
        fat_g: result.fatG,
        carbs_g: result.carbsG,
        final_target_kcal: result.targetKcal,
        carb_floor_g: result.carbFloorG,
        energy_floor_applied: result.energyFloorApplied,
        coach_review_required: result.coachReviewRequired,
        calculation_flags: result.flags,
      } as any);
    }

    return {
      ...result,
      date: data.date,
      organizationId: data.organization_id,
    };
  });
