/**
 * BodyFuel Performance Nutrition Engine V1 — Bulls Hub Wrapper (Phase 2a)
 *
 * Central Source of Truth for ALL Bulls-Smart nutrition surfaces
 * (MacroTargetsCard, NutritionTracker, …). Never touches the personal
 * `nutrition_targets` table — resolves the Bulls organisation internally and
 * calls the pure engine strictly org-scoped.
 *
 * UI DAY-TYPE MAPPING
 *   day_type_overrides.kind is stored as "training" / "rest" (personal UX).
 *   For the Bulls Performance engine we map:
 *     "rest"     → REST
 *     "training" → FOOTBALL_TRAINING (default intensity MODERATE)
 *   No further heuristics — smart auto-scheduling lands in a later step.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculatePerformanceNutritionTarget } from "./engine";
import type {
  BaselineDailyActivity,
  EnergySex,
  PerformanceGoal,
  SessionIntensity,
} from "./constants";
import type { PerformanceNutritionResult } from "./types";

export type BullsDayTypeSimple = "training" | "rest";

export interface BullsMacroDTO {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface BullsDailyNutritionTargets {
  organizationId: string;
  date: string;
  status: "CALCULATED" | "REVIEW_REQUIRED" | "MISSING_DATA";
  needsProfile: boolean;
  coachReviewRequired: boolean;
  dayType: BullsDayTypeSimple;
  dayTypeSource: "manual" | "auto";
  /** Macros for the ACTIVE day type (null when MISSING_DATA). */
  targets: BullsMacroDTO | null;
  /** Macros for FOOTBALL_TRAINING (MODERATE) — preview block. */
  trainingTargets: BullsMacroDTO | null;
  /** Macros for REST — preview block. */
  restTargets: BullsMacroDTO | null;
  flags: string[];
  engineVersion: number;
}

function toMacroDTO(r: PerformanceNutritionResult): BullsMacroDTO | null {
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

export const getBullsDailyNutritionTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      /** YYYY-MM-DD */
      date: string;
      /** Optional explicit day-type override (skips DB read). */
      day_type?: BullsDayTypeSimple;
      /** Optional session intensity for the training-day calc. Defaults to MODERATE. */
      session_intensity?: SessionIntensity | null;
    }) => d,
  )
  .handler(async ({ data, context }): Promise<BullsDailyNutritionTargets> => {
    const { supabase, userId } = context;

    // 0) Resolve Bulls organisation (slug = "bulls", active)
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "bulls")
      .eq("status", "active")
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org?.id) throw new Error("Bulls-Organisation nicht gefunden");
    const organizationId: string = org.id;

    // 1) Athlete basics (personal profile)
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("birthdate, height_cm")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);

    // 2) Latest weight
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
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (pnpErr) throw new Error(pnpErr.message);

    // 4) Position (org-scoped team)
    const { data: tmRows } = await supabase
      .from("team_memberships")
      .select("position, organization_teams!inner(organization_id)")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("organization_teams.organization_id", organizationId)
      .limit(1);
    const position: string | null =
      tmRows && tmRows.length ? (tmRows[0] as any).position ?? null : null;

    // 5) Day-type: explicit → override → REST (auto default)
    let dayTypeSimple: BullsDayTypeSimple;
    let dayTypeSource: "manual" | "auto";
    if (data.day_type) {
      dayTypeSimple = data.day_type;
      dayTypeSource = "manual";
    } else {
      const { data: dto } = await supabase
        .from("day_type_overrides")
        .select("kind")
        .eq("user_id", userId)
        .eq("entry_date", data.date)
        .maybeSingle();
      if (dto?.kind === "rest" || dto?.kind === "training") {
        dayTypeSimple = dto.kind;
        dayTypeSource = "manual";
      } else {
        dayTypeSimple = "rest";
        dayTypeSource = "auto";
      }
    }

    // 6) Calibration (org-scoped)
    const { data: calib } = await supabase
      .from("performance_nutrition_calibrations")
      .select("personal_calibration_kcal")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const personalCalibrationKcal = calib?.personal_calibration_kcal
      ? Number(calib.personal_calibration_kcal)
      : 0;

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

    // Compute both variants so the UI never needs to derive a rest/training
    // preview locally — engine is the single source of truth.
    const restResult = calculatePerformanceNutritionTarget(
      baseInput,
      { dayType: "REST", referenceDate },
      { personalCalibrationKcal },
    );
    const trainingResult = calculatePerformanceNutritionTarget(
      baseInput,
      {
        dayType: "FOOTBALL_TRAINING",
        sessionIntensity: data.session_intensity ?? "MODERATE",
        referenceDate,
      },
      { personalCalibrationKcal },
    );

    const active = dayTypeSimple === "training" ? trainingResult : restResult;

    return {
      organizationId,
      date: data.date,
      status: active.status,
      needsProfile: active.status === "MISSING_DATA",
      coachReviewRequired: active.coachReviewRequired,
      dayType: dayTypeSimple,
      dayTypeSource,
      targets: toMacroDTO(active),
      trainingTargets: toMacroDTO(trainingResult),
      restTargets: toMacroDTO(restResult),
      flags: active.flags,
      engineVersion: active.engineVersion,
    };
  });

/**
 * Set the Bulls day-type override for a date. Mirrors the personal
 * setDayType API but keeps the concept in the Bulls surface.
 * kind=null clears the override (falls back to auto = REST for now).
 */
export const setBullsDayType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { date: string; kind: BullsDayTypeSimple | null }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.kind == null) {
      const { error } = await supabase
        .from("day_type_overrides")
        .delete()
        .eq("user_id", userId)
        .eq("entry_date", data.date);
      if (error) throw new Error(error.message);
      return { ok: true, kind: null as null };
    }
    const { error } = await supabase.from("day_type_overrides").upsert(
      {
        user_id: userId,
        entry_date: data.date,
        kind: data.kind,
      },
      { onConflict: "user_id,entry_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, kind: data.kind };
  });
