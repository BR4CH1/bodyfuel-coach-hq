import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AthleteProfileInput = {
  sport?: string | null;
  sport_position?: string | null;
  sport_level?: "recreational" | "amateur" | "semi_pro" | "pro" | "coach" | null;
  team_sport?: boolean | null;
  match_days_per_week?: number | null;
  practice_days_per_week?: number | null;
  sport_weekdays?: string[] | null;
  season_phase?: "off_season" | "pre_season" | "in_season" | "post_season" | null;
  class_types?: string[] | null;
  class_days_per_week?: number | null;
  mobility_frequency?: "none" | "1_2x" | "3_4x" | "daily" | null;
  mobility_focus?: string | null;
  cardio_outside_gym?: string | null;
  injuries?: string | null;
  training_experience?: "beginner" | "intermediate" | "advanced" | null;
};

const VALID_WEEKDAYS = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
]);

function sanitize(input: AthleteProfileInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const text = (v: string | null | undefined, max: number) =>
    v == null ? null : String(v).trim().slice(0, max) || null;
  const num = (v: number | null | undefined, min: number, max: number) => {
    if (v == null) return null;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return null;
    return Math.max(min, Math.min(max, n));
  };

  if (input.sport !== undefined) patch.sport = text(input.sport, 80);
  if (input.sport_position !== undefined) patch.sport_position = text(input.sport_position, 80);
  if (input.sport_level !== undefined) patch.sport_level = input.sport_level ?? null;
  if (input.team_sport !== undefined) patch.team_sport = Boolean(input.team_sport);
  if (input.match_days_per_week !== undefined)
    patch.match_days_per_week = num(input.match_days_per_week, 0, 7);
  if (input.practice_days_per_week !== undefined)
    patch.practice_days_per_week = num(input.practice_days_per_week, 0, 7);
  if (input.season_phase !== undefined) patch.season_phase = input.season_phase ?? null;
  if (input.sport_weekdays !== undefined)
    patch.sport_weekdays = Array.isArray(input.sport_weekdays)
      ? Array.from(new Set(
          input.sport_weekdays
            .map((d) => String(d).toLowerCase().trim())
            .filter((d) => VALID_WEEKDAYS.has(d)),
        ))
      : [];
  if (input.class_types !== undefined)
    patch.class_types = Array.isArray(input.class_types)
      ? input.class_types
          .map((c) => String(c).trim().slice(0, 40))
          .filter((c) => c.length > 0)
          .slice(0, 20)
      : [];
  if (input.class_days_per_week !== undefined)
    patch.class_days_per_week = num(input.class_days_per_week, 0, 7);
  if (input.mobility_frequency !== undefined)
    patch.mobility_frequency = input.mobility_frequency ?? null;
  if (input.mobility_focus !== undefined) patch.mobility_focus = text(input.mobility_focus, 300);
  if (input.cardio_outside_gym !== undefined)
    patch.cardio_outside_gym = text(input.cardio_outside_gym, 300);
  if (input.injuries !== undefined) patch.injuries = text(input.injuries, 500);
  if (input.training_experience !== undefined)
    patch.training_experience = input.training_experience ?? null;

  patch.athlete_profile_updated_at = new Date().toISOString();
  return patch;
}

/** Self-service: signed-in user updates own athlete fields (RLS scoped). */
export const updateMyAthleteProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AthleteProfileInput) => data)
  .handler(async ({ data, context }) => {
    const patch = sanitize(data);
    const { error } = await context.supabase
      .from("profiles")
      .update(patch as any)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Coach updates another user's athlete profile. */
export const updateCustomerAthleteProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AthleteProfileInput & { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: isCoach } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "coach",
    });
    if (!isCoach) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { user_id, ...rest } = data;
    const patch = sanitize(rest);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch as any)
      .eq("id", user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Lightweight read so the banner knows whether the profile is "complete". */
export const getMyAthleteProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(
        "sport, sport_position, sport_level, team_sport, match_days_per_week, practice_days_per_week, sport_weekdays, season_phase, class_types, class_days_per_week, mobility_frequency, mobility_focus, cardio_outside_gym, injuries, training_experience, athlete_profile_updated_at",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });
