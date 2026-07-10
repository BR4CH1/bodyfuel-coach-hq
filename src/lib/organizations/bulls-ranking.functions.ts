/**
 * Bulls Ranking — Server Functions (Phase 2)
 *
 * Scope: NUR Coesfeld Bulls (organization_id konstant).
 * Alle Reads gehen als authentifizierter User; RLS greift.
 * Manuelle Anpassungen: nur Bulls-Coach / Org-Admin.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const BULLS_ORG_ID = "b86f49ab-20b7-42ca-bba4-f65ca8757c4c";

type Timeframe = "week" | "last_week" | "month" | "last_month" | "season" | "all";

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function resolveTimeframe(tf: Timeframe): { since: string | null; until: string | null } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  const mondayOffset = (day + 6) % 7; // Monday as start
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - mondayOffset);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  // Season = current year (fallback for football/general use)
  const seasonStart = new Date(today.getFullYear(), 0, 1);
  switch (tf) {
    case "week":
      return { since: isoDate(thisMonday), until: isoDate(today) };
    case "last_week":
      return { since: isoDate(lastMonday), until: isoDate(lastSunday) };
    case "month":
      return { since: isoDate(firstOfMonth), until: isoDate(today) };
    case "last_month":
      return { since: isoDate(firstOfLastMonth), until: isoDate(lastOfLastMonth) };
    case "season":
      return { since: isoDate(seasonStart), until: isoDate(today) };
    case "all":
    default:
      return { since: null, until: null };
  }
}

async function assertBullsAccess(supabase: any, userId: string): Promise<"admin" | "member"> {
  const { data: coach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
  if (coach) return "admin";
  const { data: staff } = await supabase
    .from("staff_assignments")
    .select("role,permissions")
    .eq("user_id", userId)
    .eq("organization_id", BULLS_ORG_ID)
    .maybeSingle();
  if (staff) return "admin";
  const { data: mem } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", BULLS_ORG_ID)
    .eq("status", "active")
    .maybeSingle();
  if (!mem) throw new Error("Kein Zugriff auf die Bulls-Rangliste.");
  return "member";
}

// ================================================
// GET RANKING
// ================================================
export const getBullsRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { timeframe?: Timeframe; teamId?: string | null; position?: string | null }) => ({
    timeframe: (d.timeframe ?? "season") as Timeframe,
    teamId: d.teamId ?? null,
    position: d.position?.trim() || null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBullsAccess(supabase, userId);
    const { since, until } = resolveTimeframe(data.timeframe);
    const { data: rows, error } = await supabase.rpc("get_bulls_ranking", {
      _organization_id: BULLS_ORG_ID,
      _since: since ?? undefined,
      _until: until ?? undefined,
      _team_id: data.teamId ?? undefined,
      _position: data.position ?? undefined,
    } as any);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[], since, until };
  });

// ================================================
// MY SCORE (breakdown + streak + totals)
// ================================================
export const getBullsMyScore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { timeframe?: Timeframe }) => ({ timeframe: (d.timeframe ?? "season") as Timeframe }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBullsAccess(supabase, userId);
    const { since, until } = resolveTimeframe(data.timeframe);
    const { data: breakdown, error } = await supabase.rpc("get_bulls_score_breakdown", {
      _user_id: userId,
      _organization_id: BULLS_ORG_ID,
      _since: since ?? undefined,
      _until: until ?? undefined,
    } as any);
    if (error) throw new Error(error.message);

    // Total across all time (for rank display)
    const { data: allTime } = await supabase.rpc("get_bulls_score_breakdown", {
      _user_id: userId,
      _organization_id: BULLS_ORG_ID,
    } as any);

    // Streak: latest streak_* event
    const { data: streakRows } = await supabase
      .from("bulls_ranking_events")
      .select("event_kind, metadata, event_date")
      .eq("user_id", userId)
      .eq("organization_id", BULLS_ORG_ID)
      .eq("category", "streak")
      .eq("status", "active")
      .order("event_date", { ascending: false })
      .limit(1);
    const streak = streakRows && streakRows.length
      ? { milestone: streakRows[0].event_kind, days: (streakRows[0].metadata as any)?.days ?? null }
      : null;

    return {
      breakdown: (breakdown ?? []) as { category: string; total_points: number; event_count: number }[],
      allTimeBreakdown: (allTime ?? []) as { category: string; total_points: number; event_count: number }[],
      streak,
      since,
      until,
    };
  });

// ================================================
// MY HISTORY
// ================================================
export const getBullsMyHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number }) => ({ limit: Math.min(Math.max(d.limit ?? 40, 1), 200) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBullsAccess(supabase, userId);
    const { data: rows, error } = await supabase
      .from("bulls_ranking_events")
      .select("id, event_date, category, event_kind, points, reason, source_type, status, awarded_by")
      .eq("user_id", userId)
      .eq("organization_id", BULLS_ORG_ID)
      .eq("status", "active")
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[] };
  });

// ================================================
// LIST BULLS TEAMS (for filter)
// ================================================
export const listBullsTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertBullsAccess(supabase, userId);
    const { data, error } = await supabase
      .from("organization_teams")
      .select("id, name")
      .eq("organization_id", BULLS_ORG_ID)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; name: string }[];
  });

// ================================================
// MANUAL ADJUSTMENT (admin only)
// ================================================
export const adjustBullsPointsManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    userId: string;
    points: number;
    reason: string;
    category?: string;
    eventDate?: string;
  }) => ({
    userId: String(d.userId),
    points: Math.round(Number(d.points)),
    reason: String(d.reason).trim(),
    category: (d.category ?? "tasks") as string,
    eventDate: d.eventDate ?? new Date().toISOString().slice(0, 10),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await assertBullsAccess(supabase, userId);
    if (role !== "admin") throw new Error("Nur Bulls-Coach oder Org-Admin darf Punkte anpassen.");
    if (!data.reason) throw new Error("Grund ist erforderlich.");
    if (data.points === 0) throw new Error("Punkte dürfen nicht 0 sein.");

    // Verify target is Bulls member
    const { data: mem } = await supabase
      .from("organization_memberships")
      .select("id")
      .eq("user_id", data.userId)
      .eq("organization_id", BULLS_ORG_ID)
      .maybeSingle();
    if (!mem) throw new Error("Zieluser ist kein aktives Bulls-Mitglied.");

    const { data: inserted, error } = await supabase
      .from("bulls_ranking_events")
      .insert({
        user_id: data.userId,
        organization_id: BULLS_ORG_ID,
        category: data.category as any,
        event_kind: "manual_adjustment",
        points: data.points,
        event_date: data.eventDate,
        source_type: "manual_adjustment",
        reason: data.reason,
        awarded_by: userId,
        metadata: { manual: true },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

// ================================================
// MONTHLY RANKING (default = current month)
// ================================================
function currentBerlinYearMonth(): { year: number; month: number } {
  // Server may be UTC; approximate Berlin by using UTC month (close enough for
  // month boundaries — the finalize cron uses Berlin-aware logic).
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export const getBullsMonthlyRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year?: number; month?: number }) => {
    const fallback = currentBerlinYearMonth();
    return {
      year: Number.isFinite(d.year) ? Number(d.year) : fallback.year,
      month: Number.isFinite(d.month) ? Number(d.month) : fallback.month,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBullsAccess(supabase, userId);
    const { data: rows, error } = await supabase.rpc("get_bulls_month_ranking", {
      _organization_id: BULLS_ORG_ID,
      _year: data.year,
      _month: data.month,
    } as any);
    if (error) throw new Error(error.message);
    const { data: fin } = await supabase
      .from("bulls_monthly_finalizations")
      .select("status, finalized_at, winner_user_id, winner_points, participant_count")
      .eq("organization_id", BULLS_ORG_ID)
      .eq("year", data.year)
      .eq("month", data.month)
      .maybeSingle();
    return {
      year: data.year,
      month: data.month,
      rows: (rows ?? []) as any[],
      finalization: fin ?? null,
      viewerUserId: userId,
    };
  });

// ================================================
// HALL OF FAME (past winners)
// ================================================
export const getBullsHallOfFame = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number }) => ({ limit: Math.min(Math.max(d.limit ?? 24, 1), 60) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBullsAccess(supabase, userId);
    const { data: rows, error } = await supabase.rpc("get_bulls_monthly_winners", {
      _organization_id: BULLS_ORG_ID,
      _limit: data.limit,
    } as any);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[] };
  });

// ================================================
// USER PLAYER-OF-THE-MONTH AWARDS
// ================================================
export const getBullsMyAwards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertBullsAccess(supabase, userId);
    const { data, error } = await supabase.rpc("get_bulls_user_player_of_month_awards", {
      _user_id: userId,
      _organization_id: BULLS_ORG_ID,
    } as any);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as { year: number; month: number; points: number; finalized_at: string }[] };
  });

// ================================================
// ARCHIVED MONTH TOP-N
// ================================================
export const getBullsArchivedMonth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year: number; month: number; limit?: number }) => ({
    year: Number(d.year),
    month: Number(d.month),
    limit: Math.min(Math.max(d.limit ?? 10, 1), 50),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertBullsAccess(supabase, userId);
    const { data: rows, error } = await supabase
      .from("bulls_monthly_standings")
      .select(
        "rank, user_id, final_points, completed_trainings, plan_completion_rate, check_in_completion_rate, active_days, profiles:profiles!inner(display_name, nickname, is_minor)",
      )
      .eq("organization_id", BULLS_ORG_ID)
      .eq("year", data.year)
      .eq("month", data.month)
      .order("rank", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[] };
  });

// ================================================
// ADMIN: force finalize a completed month
// ================================================
export const finalizeBullsMonthNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year: number; month: number }) => ({
    year: Number(d.year),
    month: Number(d.month),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await assertBullsAccess(supabase, userId);
    if (role !== "admin") throw new Error("Nur Bulls-Coach oder Org-Admin darf Monate finalisieren.");
    const { data: id, error } = await supabase.rpc("finalize_bulls_month", {
      _organization_id: BULLS_ORG_ID,
      _year: data.year,
      _month: data.month,
    } as any);
    if (error) throw new Error(error.message);
    return { id };
  });
