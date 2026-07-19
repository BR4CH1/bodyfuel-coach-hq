/**
 * BodyFuel Performance Nutrition Engine V1 — Coach Read-Only View (Phase 2b)
 *
 * Reads the organization-scoped Performance Nutrition state for ONE athlete
 * from a coach/staff perspective. No writes. No calibration actions.
 *
 * SOURCE OF TRUTH:
 *  - Pure engine (calculatePerformanceNutritionTarget) for the 5 day-type blocks
 *  - performance_nutrition_profiles (org-scoped)
 *  - performance_nutrition_calibrations (org-scoped)
 *  - performance_nutrition_calculations (last stored calculation, if any)
 *
 * Never reads or exposes the personal `nutrition_targets` table.
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
} from "./constants";
import { PERFORMANCE_NUTRITION_ENGINE_VERSION } from "./constants";
import type { PerformanceNutritionResult } from "./types";

export type CoachDayTypeKey =
  | "rest"
  | "strength"
  | "football_training"
  | "game_day"
  | "double_session";

const UI_TO_ENGINE: Record<CoachDayTypeKey, PerformanceDayType> = {
  rest: "REST",
  strength: "STRENGTH",
  football_training: "FOOTBALL_TRAINING",
  game_day: "GAME_DAY",
  double_session: "DOUBLE_SESSION",
};

export const ALL_COACH_DAY_TYPES: CoachDayTypeKey[] = [
  "rest",
  "strength",
  "football_training",
  "game_day",
  "double_session",
];

export interface CoachMacroDTO {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface CoachDayTypeBlock {
  key: CoachDayTypeKey;
  status: "CALCULATED" | "REVIEW_REQUIRED" | "MISSING_DATA";
  macros: CoachMacroDTO | null;
  flags: string[];
}

export interface CoachAthletePerformanceNutrition {
  organizationId: string;
  targetUserId: string;
  date: string;
  /** Overall status derived from the REST block (baseline availability). */
  status: "CALCULATED" | "REVIEW_REQUIRED" | "MISSING_DATA";
  engineVersion: number;
  /** Aggregated flags across the 5 day-type blocks (deduped). */
  flags: string[];
  /** Missing profile fields (human keys). Only populated if status !== CALCULATED. */
  missing: string[];

  /** Engine status metadata. */
  meta: {
    performanceGoal: PerformanceGoal | null;
    effectiveGoal: PerformanceNutritionResult["effectiveGoal"];
    baselineDailyActivity: BaselineDailyActivity | null;
    sexForEnergyCalculation: EnergySex | null;
    position: string | null;
    positionCluster: PerformanceNutritionResult["positionCluster"];
    ageAtCalculation: number | null;
    isYouth: boolean;
    personalCalibrationKcal: number;
    lastCalibrationAt: string | null;
    weightTrendPercentPerWeek: number | null;
    lastCalculatedAt: string | null;
  };

  /** Active target (currently == engine suggestion; no coach override yet). */
  activeTarget: CoachMacroDTO | null;
  /** Engine suggestion (based on stored/inferred day type). */
  engineSuggestion: CoachMacroDTO | null;
  /** Which day type the active/suggestion pair uses. */
  activeDayType: CoachDayTypeKey;

  /** Per-day-type preview blocks (all 5). */
  perDayType: CoachDayTypeBlock[];
}

function toMacroDTO(r: PerformanceNutritionResult): CoachMacroDTO | null {
  if (
    r.status === "MISSING_DATA" ||
    r.targetKcal == null ||
    r.proteinG == null ||
    r.carbsG == null ||
    r.fatG == null
  ) {
    return null;
  }
  return {
    kcal: r.targetKcal,
    protein_g: r.proteinG,
    carbs_g: r.carbsG,
    fat_g: r.fatG,
  };
}

function flagsToMissing(flags: string[]): string[] {
  const missing: string[] = [];
  if (flags.includes("MISSING_BIRTH_DATE")) missing.push("Geburtsdatum");
  if (flags.includes("MISSING_HEIGHT")) missing.push("Größe");
  if (flags.includes("MISSING_WEIGHT")) missing.push("Gewicht");
  if (flags.includes("MISSING_ENERGY_CALCULATION_SEX"))
    missing.push("Angabe für Energiebedarfsberechnung");
  if (flags.includes("MISSING_PERFORMANCE_GOAL")) missing.push("Performance-Ziel");
  if (flags.includes("MISSING_BASELINE_ACTIVITY")) missing.push("Alltagsaktivität");
  return missing;
}

export const getCoachAthletePerformanceNutrition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      organization_id: string;
      target_user_id: string;
      /** YYYY-MM-DD */
      date: string;
    }) => d,
  )
  .handler(async ({ data, context }): Promise<CoachAthletePerformanceNutrition> => {
    const { supabase } = context;
    const target = data.target_user_id;
    const orgId = data.organization_id;

    // 1) Athlete basics (RLS: coach staff read on profiles required, handled by policies)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("birthdate, height_cm")
      .eq("id", target)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);

    // 2) Latest weight
    const { data: bmRows } = await supabase
      .from("body_measurements")
      .select("weight_kg, measured_at")
      .eq("user_id", target)
      .not("weight_kg", "is", null)
      .order("measured_at", { ascending: false })
      .limit(1);
    let weightKg: number | null =
      bmRows && bmRows.length ? Number(bmRows[0].weight_kg) : null;
    if (weightKg == null) {
      const { data: bwRows } = await supabase
        .from("bulls_weight_logs")
        .select("weight_kg, created_at")
        .eq("user_id", target)
        .order("created_at", { ascending: false })
        .limit(1);
      if (bwRows && bwRows.length) weightKg = Number(bwRows[0].weight_kg);
    }

    // 3) Org-scoped profile
    const { data: pnp } = await supabase
      .from("performance_nutrition_profiles")
      .select("sex_for_energy_calculation, baseline_daily_activity, performance_goal")
      .eq("user_id", target)
      .eq("organization_id", orgId)
      .maybeSingle();

    // 4) Position
    const { data: tmRows } = await supabase
      .from("team_memberships")
      .select("position, organization_teams!inner(organization_id)")
      .eq("user_id", target)
      .eq("status", "active")
      .eq("organization_teams.organization_id", orgId)
      .limit(1);
    const position: string | null =
      tmRows && tmRows.length ? (tmRows[0] as any).position ?? null : null;

    // 5) Calibration
    const { data: calib } = await supabase
      .from("performance_nutrition_calibrations")
      .select(
        "personal_calibration_kcal, last_calibration_at, weight_trend_percent_per_week",
      )
      .eq("user_id", target)
      .eq("organization_id", orgId)
      .maybeSingle();
    const personalCalibrationKcal = calib?.personal_calibration_kcal
      ? Number(calib.personal_calibration_kcal)
      : 0;

    // 6) Day type on requested date — via the central Performance Day Type
    //    Resolver (manual override with real perf type wins, then structural
    //    priority ladder). Legacy "training" is never mapped silently.
    const dayTypeSignals = await collectPerformanceDayTypeSignals(supabase, {
      organizationId: orgId,
      userId: target,
      date: data.date,
    });
    const dayTypeResolution = resolvePerformanceDayTypeFromSignals(dayTypeSignals);
    const activeDayType: CoachDayTypeKey = dayTypeResolution.dayType;
    const legacyOverrideIgnored = dayTypeResolution.flags.includes(
      "LEGACY_TRAINING_OVERRIDE_IGNORED",
    );

    // 7) Last stored calculation (for engine status "letzte Berechnung")
    const { data: lastCalcRow } = await supabase
      .from("performance_nutrition_calculations")
      .select("calculated_at")
      .eq("user_id", target)
      .eq("organization_id", orgId)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const referenceDate = new Date(data.date + "T12:00:00Z");
    const baseInput = {
      birthDate: profile?.birthdate ?? null,
      sexForEnergyCalculation:
        (pnp?.sex_for_energy_calculation as EnergySex | null) ?? null,
      heightCm: profile?.height_cm ? Number(profile.height_cm) : null,
      weightKg,
      position,
      performanceGoal: (pnp?.performance_goal as PerformanceGoal | null) ?? null,
      baselineDailyActivity:
        (pnp?.baseline_daily_activity as BaselineDailyActivity | null) ?? null,
    };

    // Compute all 5 day-type blocks
    const perDayType: CoachDayTypeBlock[] = [];
    const flagSet = new Set<string>();
    let activeResult: PerformanceNutritionResult | null = null;
    for (const k of ALL_COACH_DAY_TYPES) {
      const r = calculatePerformanceNutritionTarget(
        baseInput,
        {
          dayType: UI_TO_ENGINE[k],
          sessionIntensity: null,
          referenceDate,
        },
        { personalCalibrationKcal },
      );
      perDayType.push({
        key: k,
        status: r.status,
        macros: toMacroDTO(r),
        flags: r.flags,
      });
      for (const f of r.flags) flagSet.add(f);
      if (k === activeDayType) activeResult = r;
    }

    const baselineStatus = activeResult?.status ?? "MISSING_DATA";
    if (legacyOverrideIgnored) flagSet.add("LEGACY_TRAINING_OVERRIDE_IGNORED");
    const aggregatedFlags = Array.from(flagSet);
    const missing = flagsToMissing(aggregatedFlags);

    const activeMacros = activeResult ? toMacroDTO(activeResult) : null;

    return {
      organizationId: orgId,
      targetUserId: target,
      date: data.date,
      status: baselineStatus,
      engineVersion: PERFORMANCE_NUTRITION_ENGINE_VERSION,
      flags: aggregatedFlags,
      missing,
      meta: {
        performanceGoal: baseInput.performanceGoal,
        effectiveGoal: activeResult?.effectiveGoal ?? baseInput.performanceGoal,
        baselineDailyActivity: baseInput.baselineDailyActivity,
        sexForEnergyCalculation: baseInput.sexForEnergyCalculation,
        position,
        positionCluster: activeResult?.positionCluster ?? null,
        ageAtCalculation: activeResult?.age ?? null,
        isYouth: activeResult?.isYouth ?? false,
        personalCalibrationKcal,
        lastCalibrationAt: calib?.last_calibration_at ?? null,
        weightTrendPercentPerWeek: calib?.weight_trend_percent_per_week
          ? Number(calib.weight_trend_percent_per_week)
          : null,
        lastCalculatedAt: lastCalcRow?.calculated_at ?? null,
      },
      // No coach override yet — active target == engine suggestion.
      activeTarget: activeMacros,
      engineSuggestion: activeMacros,
      activeDayType,
      perDayType,
    };
  });
