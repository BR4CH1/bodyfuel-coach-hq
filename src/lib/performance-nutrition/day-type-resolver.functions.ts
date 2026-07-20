/**
 * BodyFuel Performance Nutrition — Central Day Type Resolver Server Fn
 *
 * Collects the raw structural signals for (organization_id, user_id, date)
 * and delegates the decision to the pure resolver in
 * `./day-type-resolver.ts`. Used by:
 *   - `getBullsDailyNutritionTargets` (Bulls Read Layer)
 *   - `getCoachAthletePerformanceNutrition` (Coach Read View)
 *   - `getNutritionTargetForDate` (Performance context path)
 *
 * NEVER used by the personal BodyFuel context — the personal
 * training/rest logic in `WeekScheduleCard` / `DayTypePrompt` /
 * `MacroTargetsCard` (personal variant) remains untouched.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolvePerformanceDayTypeFromSignals,
  type DayTypeResolution,
  type DayTypeResolverSignals,
} from "./day-type-resolver";

/** JS weekday → schedule weekday (0=Sunday..6=Saturday). Adjust if a table uses ISO 1..7. */
function jsWeekday(dateISO: string): number {
  // Anchor at noon UTC to avoid TZ drift on YYYY-MM-DD strings.
  return new Date(dateISO + "T12:00:00Z").getUTCDay();
}

/**
 * Collect all Performance day-type signals for (user, date) inside the given
 * organisation. Runs read-only queries; failures are swallowed to booleans so
 * a partial DB error can never silently flip the day type (a missing table
 * simply reads as "no session").
 */
export async function collectPerformanceDayTypeSignals(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    userId: string;
    date: string; // YYYY-MM-DD
  },
): Promise<DayTypeResolverSignals> {
  const { organizationId, userId, date } = params;
  const weekday = jsWeekday(date);

  // 1) Manual override (real perf value or legacy).
  const manualOverridePromise = supabase
    .from("day_type_overrides")
    .select("kind")
    .eq("user_id", userId)
    .eq("entry_date", date)
    .maybeSingle();

  // 2) Game event on that date. Zwei Quellen:
  //    a) NEUE, organisationsagnostische Source of Truth: `organization_events`
  //       (event_type='match'). Team-spezifische oder orgweite Events zählen —
  //       Team-Auflösung erfolgt weiter unten via `team_memberships`.
  //    b) Legacy `bulls_hub_events` (per-user Onboarding-Kalender). Bleibt
  //       aus Rückwärtskompatibilität aktiv, aber sekundär.
  const gameEventPromise = supabase
    .from("bulls_hub_events")
    .select("id, kind, occurred_at")
    .eq("user_id", userId)
    .in("kind", ["game_day", "game", "match", "spieltag"])
    .gte("occurred_at", `${date}T00:00:00Z`)
    .lte("occurred_at", `${date}T23:59:59Z`)
    .limit(1);

  const orgEventsMatchPromise = supabase
    .from("organization_events")
    .select("id, team_id, starts_at")
    .eq("organization_id", organizationId)
    .eq("event_type", "match")
    .gte("starts_at", `${date}T00:00:00Z`)
    .lte("starts_at", `${date}T23:59:59Z`);

  // 3) Team football training session on that weekday (via active team
  //    membership inside this organisation).
  const teamMembershipsPromise = supabase
    .from("team_memberships")
    .select("team_id, position, organization_teams!inner(organization_id)")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("organization_teams.organization_id", organizationId);

  // 4) Individual athlete training schedule on that weekday.
  const athleteTrainingPromise = supabase
    .from("athlete_training_schedule")
    .select("id, weekday, active")
    .eq("user_id", userId)
    .eq("weekday", weekday)
    .eq("active", true)
    .limit(1);

  // 5) Individual strength assignments (athletic plans) — sessions whose
  //    scheduled_weekdays include this weekday, resolved via the athlete's
  //    active plan assignments within this org.
  const athleticAssignmentsPromise = supabase
    .from("organization_athletic_plan_assignments")
    .select("plan_id, scope_type, team_id, position, athlete_user_id, active, organization_id")
    .eq("organization_id", organizationId)
    .eq("active", true);

  // 6) Belastungssteuerung: Coach-gesetzte Belastungsstufe für diesen Tag.
  //     Nur aktiv, wenn Modul `load_management` in der Organisation aktiv ist.
  //     Team-spezifischer Eintrag hat Vorrang vor orgweitem Eintrag.
  const loadModulePromise = supabase
    .from("organization_features")
    .select("enabled")
    .eq("organization_id", organizationId)
    .eq("feature", "load_management")
    .maybeSingle();
  const loadDaysPromise = supabase
    .from("organization_load_days")
    .select("team_id, load_level")
    .eq("organization_id", organizationId)
    .eq("date", date);
  const loadOverridePromise = supabase
    .from("organization_load_day_athlete_overrides")
    .select("load_level")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  const [
    manualOverrideRes,
    gameEventRes,
    orgEventsMatchRes,
    teamMembershipsRes,
    athleteTrainingRes,
    athleticAssignmentsRes,
    loadModuleRes,
    loadDaysRes,
    loadOverrideRes,
  ] = await Promise.all([
    manualOverridePromise,
    gameEventPromise,
    orgEventsMatchPromise,
    teamMembershipsPromise,
    athleteTrainingPromise,
    athleticAssignmentsPromise,
    loadModulePromise,
    loadDaysPromise,
    loadOverridePromise,
  ]);

  const manualOverrideKind: string | null =
    (manualOverrideRes.data as { kind?: string } | null)?.kind ?? null;

  const legacyGameEvent =
    !!gameEventRes.data && (gameEventRes.data as unknown[]).length > 0;

  // Football training: is there an active team_training_schedule row for
  // this weekday scoped to one of the athlete's active teams in this org?
  const teamIds = (teamMembershipsRes.data ?? []).map(
    (r: { team_id: string }) => r.team_id,
  );
  const positions = (teamMembershipsRes.data ?? [])
    .map((r: { position: string | null }) => r.position)
    .filter((p): p is string => !!p);

  // Match aus organization_events (SoT): entweder team-spezifisch (Team des
  // Athleten) oder orgweit (team_id = null). U17 bekommt kein U19-Match.
  const orgEventsMatchRows = (orgEventsMatchRes.data ?? []) as Array<{
    team_id: string | null;
  }>;
  const hasOrgEventMatch = orgEventsMatchRows.some(
    (m) => m.team_id === null || (m.team_id !== null && teamIds.includes(m.team_id)),
  );
  const hasGameEvent = legacyGameEvent || hasOrgEventMatch;

  let hasFootballTrainingSession = false;
  if (teamIds.length > 0) {
    // 1) Neue wochenbezogene Team-Trainingspläne (published) für dieses konkrete Datum.
    const { data: weekRows } = await supabase
      .from("org_team_training_week")
      .select("id, team_id, status, week_start")
      .in("team_id", teamIds)
      .eq("status", "published")
      .lte("week_start", date);
    const weekIds = ((weekRows ?? []) as any[])
      .filter((w) => {
        const end = new Date(w.week_start + "T00:00:00Z");
        end.setUTCDate(end.getUTCDate() + 6);
        return end.toISOString().slice(0, 10) >= date;
      })
      .map((w) => w.id as string);
    if (weekIds.length) {
      const { data: sess } = await supabase
        .from("org_team_training_week_session")
        .select("id")
        .in("week_id", weekIds)
        .eq("session_date", date)
        .eq("active", true)
        .limit(1);
      if (sess && sess.length > 0) hasFootballTrainingSession = true;
    }
    // 2) Fallback auf Legacy Weekday-Plan, wenn (noch) keine Wochenveröffentlichung existiert.
    if (!hasFootballTrainingSession) {
      const { data: footballRows } = await supabase
        .from("organization_team_training_schedule")
        .select("id")
        .in("team_id", teamIds)
        .eq("weekday", weekday)
        .eq("active", true)
        .limit(1);
      hasFootballTrainingSession = !!footballRows && footballRows.length > 0;
    }
  }

  const hasIndividualTrainingSession =
    !!athleteTrainingRes.data && athleteTrainingRes.data.length > 0;

  // Strength: any active plan assignment (individual, team, or position
  // scope) with at least one session scheduled on this weekday.
  let hasStrengthSession = false;
  const assignments = athleticAssignmentsRes.data ?? [];
  const relevantPlanIds = new Set<string>();
  for (const a of assignments as Array<{
    plan_id: string;
    scope_type: string;
    team_id: string | null;
    position: string | null;
    athlete_user_id: string | null;
  }>) {
    if (a.scope_type === "individual" && a.athlete_user_id === userId) {
      relevantPlanIds.add(a.plan_id);
    } else if (
      a.scope_type === "team" &&
      a.team_id &&
      teamIds.includes(a.team_id)
    ) {
      relevantPlanIds.add(a.plan_id);
    } else if (
      a.scope_type === "position" &&
      a.position &&
      positions.includes(a.position)
    ) {
      relevantPlanIds.add(a.plan_id);
    }
  }
  if (relevantPlanIds.size > 0) {
    const { data: sessionRows } = await supabase
      .from("organization_athletic_plan_sessions")
      .select("id, scheduled_weekdays")
      .in("plan_id", Array.from(relevantPlanIds));
    if (sessionRows) {
      hasStrengthSession = (sessionRows as Array<{
        scheduled_weekdays: number[] | null;
      }>).some(
        (s) =>
          Array.isArray(s.scheduled_weekdays) &&
          s.scheduled_weekdays.includes(weekday),
      );
    }
  }

  // Belastungssteuerung: nur berücksichtigen, wenn Modul aktiv ist.
  let loadLevel: number | null = null;
  const loadEnabled =
    (loadModuleRes.data as { enabled?: boolean } | null)?.enabled === true;
  if (loadEnabled) {
    // 1) Athleten-Override hat Vorrang.
    const overrideLevel = (loadOverrideRes.data as { load_level?: number } | null)?.load_level;
    if (typeof overrideLevel === "number") {
      loadLevel = overrideLevel;
    } else {
      const loadRows = (loadDaysRes.data ?? []) as Array<{
        team_id: string | null;
        load_level: number | null;
      }>;
      if (loadRows.length > 0) {
        const teamRow = loadRows.find(
          (r) => r.team_id !== null && teamIds.includes(r.team_id as string),
        );
        const orgRow = loadRows.find((r) => r.team_id === null);
        const picked = teamRow ?? orgRow ?? null;
        loadLevel =
          picked && typeof picked.load_level === "number"
            ? picked.load_level
            : null;
      }
    }
  }


  return {
    manualOverrideKind,
    hasGameEvent,
    hasFootballTrainingSession,
    hasStrengthSession,
    hasIndividualTrainingSession,
    loadLevel,
  };
}


/**
 * Resolve the final Performance Day Type for (organization_id, user_id, date).
 * Applies to the Bulls / Performance context only.
 */
export const resolvePerformanceDayType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { organization_id: string; user_id?: string; date: string }) => d,
  )
  .handler(async ({ data, context }): Promise<DayTypeResolution> => {
    const { supabase, userId } = context;
    const targetUserId = data.user_id ?? userId;
    const signals = await collectPerformanceDayTypeSignals(supabase, {
      organizationId: data.organization_id,
      userId: targetUserId,
      date: data.date,
    });
    return resolvePerformanceDayTypeFromSignals(signals);
  });
