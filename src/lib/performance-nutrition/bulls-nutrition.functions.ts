/**
 * BodyFuel Performance Nutrition Engine V1 — Bulls Hub Wrapper (Phase 2a+)
 *
 * Central Source of Truth for ALL Bulls-Smart nutrition surfaces
 * (MacroTargetsCard, NutritionTracker, WeekScheduleCard, BullsPlanContentView).
 * Never touches the personal `nutrition_targets` table — resolves the Bulls
 * organisation internally and calls the pure engine strictly org-scoped.
 *
 * FIVE UI DAY TYPES → engine day types:
 *   "rest"              → REST
 *   "strength"          → STRENGTH
 *   "football_training" → FOOTBALL_TRAINING
 *   "game_day"          → GAME_DAY
 *   "double_session"    → DOUBLE_SESSION
 *
 * Backwards compat: legacy override kind "training" is interpreted as
 * "football_training" (the personal DayTypePrompt/WeekScheduleCard still
 * writes training/rest to the shared day_type_overrides table).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculatePerformanceNutritionTarget } from "./engine";
import type {
  BaselineDailyActivity,
  EnergySex,
  PerformanceDayType,
  PerformanceGoal,
  SessionIntensity,
} from "./constants";
import type { PerformanceNutritionResult } from "./types";

export type BullsDayType =
  | "rest"
  | "strength"
  | "football_training"
  | "game_day"
  | "double_session";

/** Legacy: personal flow writes "training"/"rest". */
export type BullsDayTypeSimple = "training" | "rest";

export const BULLS_DAY_TYPE_LABELS: Record<BullsDayType, string> = {
  rest: "Restday",
  strength: "Strength",
  football_training: "Football Training",
  game_day: "Game Day",
  double_session: "Double Session",
};

const UI_TO_ENGINE: Record<BullsDayType, PerformanceDayType> = {
  rest: "REST",
  strength: "STRENGTH",
  football_training: "FOOTBALL_TRAINING",
  game_day: "GAME_DAY",
  double_session: "DOUBLE_SESSION",
};

export const ALL_BULLS_DAY_TYPES: BullsDayType[] = [
  "rest",
  "strength",
  "football_training",
  "game_day",
  "double_session",
];

export interface BullsMacroDTO {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export type BullsPerDayTypeTargets = Record<BullsDayType, BullsMacroDTO | null>;

export interface BullsDailyNutritionTargets {
  organizationId: string;
  date: string;
  status: "CALCULATED" | "REVIEW_REQUIRED" | "MISSING_DATA";
  needsProfile: boolean;
  coachReviewRequired: boolean;
  /** UI day type resolved for this date. */
  dayType: BullsDayType;
  dayTypeSource: "manual" | "auto";
  sessionIntensity: SessionIntensity | null;
  /** Macros for the ACTIVE day type. */
  targets: BullsMacroDTO | null;
  /** Preview blocks per Day Type. */
  perDayTypeTargets: BullsPerDayTypeTargets;
  /** Legacy compat for existing MacroTargetsCard/NutritionTracker consumers. */
  trainingTargets: BullsMacroDTO | null;
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

function normalizeOverrideKind(kind: string | null | undefined): BullsDayType | null {
  if (!kind) return null;
  if (kind === "training") return "football_training"; // legacy compat
  if (
    kind === "rest" ||
    kind === "strength" ||
    kind === "football_training" ||
    kind === "game_day" ||
    kind === "double_session"
  ) {
    return kind;
  }
  return null;
}

export const getBullsDailyNutritionTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      /** YYYY-MM-DD */
      date: string;
      /** Optional explicit day-type override (skips DB read). */
      day_type?: BullsDayType;
      /** Optional session intensity for the active calc. */
      session_intensity?: SessionIntensity | null;
    }) => d,
  )
  .handler(async ({ data, context }): Promise<BullsDailyNutritionTargets> => {
    const { supabase, userId } = context;

    // 0) Resolve Bulls organisation
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "bulls")
      .eq("status", "active")
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org?.id) throw new Error("Bulls-Organisation nicht gefunden");
    const organizationId: string = org.id;

    // 1) Athlete basics
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

    // 3) Org-scoped profile
    const { data: pnp, error: pnpErr } = await supabase
      .from("performance_nutrition_profiles")
      .select("sex_for_energy_calculation, baseline_daily_activity, performance_goal")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (pnpErr) throw new Error(pnpErr.message);

    // 4) Position
    const { data: tmRows } = await supabase
      .from("team_memberships")
      .select("position, organization_teams!inner(organization_id)")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("organization_teams.organization_id", organizationId)
      .limit(1);
    const position: string | null =
      tmRows && tmRows.length ? (tmRows[0] as any).position ?? null : null;

    // 5) Day-type + session intensity resolution
    let dayType: BullsDayType;
    let dayTypeSource: "manual" | "auto";
    let sessionIntensity: SessionIntensity | null =
      data.session_intensity ?? null;

    if (data.day_type) {
      dayType = data.day_type;
      dayTypeSource = "manual";
    } else {
      const { data: dto } = await supabase
        .from("day_type_overrides")
        .select("kind, session_intensity")
        .eq("user_id", userId)
        .eq("entry_date", data.date)
        .maybeSingle();
      const normalized = normalizeOverrideKind((dto as any)?.kind ?? null);
      if (normalized) {
        dayType = normalized;
        dayTypeSource = "manual";
        if (sessionIntensity == null) {
          const si = (dto as any)?.session_intensity ?? null;
          if (si === "LIGHT" || si === "MODERATE" || si === "HARD") {
            sessionIntensity = si;
          }
        }
      } else {
        dayType = "rest";
        dayTypeSource = "auto";
      }
    }

    // 6) Calibration
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

    // Compute all 5 day-type variants — engine is the single source of truth.
    const results = {} as Record<BullsDayType, PerformanceNutritionResult>;
    const perDayTypeTargets = {} as BullsPerDayTypeTargets;
    for (const k of ALL_BULLS_DAY_TYPES) {
      const engineDayType = UI_TO_ENGINE[k];
      // Session intensity applies mostly to football_training; forward for
      // active day type. For preview blocks we use MODERATE where meaningful.
      const intensityForPreview: SessionIntensity | null =
        k === "football_training" || k === "double_session"
          ? (k === dayType && sessionIntensity ? sessionIntensity : "MODERATE")
          : null;
      const r = calculatePerformanceNutritionTarget(
        baseInput,
        {
          dayType: engineDayType,
          sessionIntensity: intensityForPreview,
          referenceDate,
        },
        { personalCalibrationKcal },
      );
      results[k] = r;
      perDayTypeTargets[k] = toMacroDTO(r);
    }

    const active = results[dayType];

    return {
      organizationId,
      date: data.date,
      status: active.status,
      needsProfile: active.status === "MISSING_DATA",
      coachReviewRequired: active.coachReviewRequired,
      dayType,
      dayTypeSource,
      sessionIntensity,
      targets: toMacroDTO(active),
      perDayTypeTargets,
      trainingTargets: perDayTypeTargets.football_training,
      restTargets: perDayTypeTargets.rest,
      flags: active.flags,
      engineVersion: active.engineVersion,
    };
  });

/**
 * Set the Bulls day-type override for a date.
 * kind=null clears the override (falls back to auto = REST).
 */
export const setBullsDayType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      date: string;
      kind: BullsDayType | BullsDayTypeSimple | null;
      session_intensity?: SessionIntensity | null;
    }) => d,
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
        session_intensity: data.session_intensity ?? null,
      },
      { onConflict: "user_id,entry_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, kind: data.kind };
  });
