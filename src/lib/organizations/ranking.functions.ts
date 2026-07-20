/**
 * Generic Organization Ranking — Server Functions
 *
 * Wirkt für ALLE Organisationen außer Coesfeld Bulls (Bulls hat ein eigenes
 * Ledger `bulls_ranking_events`). Die Punktevergabe passiert automatisch über
 * DB-Trigger; diese Server-Fns liefern Reads + kontrollierte manuelle Anpassung.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BULLS_ORG_ID = "b86f49ab-20b7-42ca-bba4-f65ca8757c4c";

async function resolveOrg(supabase: any, slug: string): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organisation nicht gefunden.");
  if (data.id === BULLS_ORG_ID) {
    throw new Error("Bulls nutzen die eigene Bulls-Rangliste (/bulls/ranking).");
  }
  return data;
}

async function assertOrgAccess(
  supabase: any,
  userId: string,
  orgId: string,
): Promise<"staff" | "member"> {
  const { data: staff } = await supabase
    .from("staff_assignments")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (staff) return "staff";
  const { data: mem } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  if (!mem) throw new Error("Kein Zugriff auf diese Rangliste.");
  return "member";
}

function currentBerlinYearMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

// ================================================
// MONTHLY RANKING (default = current month)
// ================================================
export const getOrgMonthlyRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string; year?: number; month?: number }) => {
    const fb = currentBerlinYearMonth();
    return {
      slug: String(d.slug),
      year: Number.isFinite(d.year) ? Number(d.year) : fb.year,
      month: Number.isFinite(d.month) ? Number(d.month) : fb.month,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = await resolveOrg(supabase, data.slug);
    await assertOrgAccess(supabase, userId, org.id);
    const { data: rows, error } = await supabase.rpc("get_org_month_ranking", {
      _organization_id: org.id,
      _year: data.year,
      _month: data.month,
    } as any);
    if (error) throw new Error(error.message);
    const { data: fin } = await supabase
      .from("org_monthly_finalizations")
      .select("status, finalized_at, winner_user_id, winner_points, participant_count")
      .eq("organization_id", org.id)
      .eq("year", data.year)
      .eq("month", data.month)
      .maybeSingle();
    return {
      organizationId: org.id,
      year: data.year,
      month: data.month,
      rows: (rows ?? []) as any[],
      finalization: fin ?? null,
      viewerUserId: userId,
    };
  });

// ================================================
// MY SCORE BREAKDOWN
// ================================================
export const getOrgMyScore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string; year?: number; month?: number }) => {
    const fb = currentBerlinYearMonth();
    return {
      slug: String(d.slug),
      year: Number.isFinite(d.year) ? Number(d.year) : fb.year,
      month: Number.isFinite(d.month) ? Number(d.month) : fb.month,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = await resolveOrg(supabase, data.slug);
    await assertOrgAccess(supabase, userId, org.id);
    const start = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const endDate = new Date(data.year, data.month, 0);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

    const [{ data: breakdown }, { data: allTime }, { data: streakRows }] = await Promise.all([
      supabase.rpc("get_org_score_breakdown", {
        _user_id: userId,
        _organization_id: org.id,
        _since: start,
        _until: end,
      } as any),
      supabase.rpc("get_org_score_breakdown", {
        _user_id: userId,
        _organization_id: org.id,
      } as any),
      supabase
        .from("org_ranking_events")
        .select("event_kind, metadata, event_date")
        .eq("user_id", userId)
        .eq("organization_id", org.id)
        .eq("category", "streak")
        .eq("status", "active")
        .order("event_date", { ascending: false })
        .limit(1),
    ]);
    const streak =
      streakRows && streakRows.length
        ? {
            milestone: streakRows[0].event_kind,
            days: (streakRows[0].metadata as any)?.days ?? null,
          }
        : null;
    return {
      breakdown: (breakdown ?? []) as { category: string; total_points: number; event_count: number }[],
      allTimeBreakdown: (allTime ?? []) as { category: string; total_points: number; event_count: number }[],
      streak,
      year: data.year,
      month: data.month,
    };
  });

// ================================================
// MY HISTORY
// ================================================
export const getOrgMyHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string; limit?: number }) => ({
    slug: String(d.slug),
    limit: Math.min(Math.max(d.limit ?? 40, 1), 200),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = await resolveOrg(supabase, data.slug);
    await assertOrgAccess(supabase, userId, org.id);
    const { data: rows, error } = await supabase
      .from("org_ranking_events")
      .select("id, event_date, category, event_kind, points, reason, source_type, status, awarded_by")
      .eq("user_id", userId)
      .eq("organization_id", org.id)
      .eq("status", "active")
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[] };
  });

// ================================================
// HALL OF FAME (past monthly winners)
// ================================================
export const getOrgHallOfFame = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string; limit?: number }) => ({
    slug: String(d.slug),
    limit: Math.min(Math.max(d.limit ?? 12, 1), 60),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = await resolveOrg(supabase, data.slug);
    await assertOrgAccess(supabase, userId, org.id);
    const { data: rows, error } = await supabase.rpc("get_org_monthly_winners", {
      _organization_id: org.id,
      _limit: data.limit,
    } as any);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[] };
  });

// ================================================
// MANUAL ADJUSTMENT (staff only, logged)
// ================================================
export const adjustOrgPointsManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    slug: string;
    userId: string;
    points: number;
    reason: string;
    category?: string;
    eventDate?: string;
  }) => ({
    slug: String(d.slug),
    userId: String(d.userId),
    points: Math.round(Number(d.points)),
    reason: String(d.reason).trim(),
    category: (d.category ?? "tasks") as string,
    eventDate: d.eventDate ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = await resolveOrg(supabase, data.slug);
    const role = await assertOrgAccess(supabase, userId, org.id);
    if (role !== "staff") throw new Error("Nur Coach oder Org-Admin darf Punkte anpassen.");
    if (!data.reason) throw new Error("Grund ist erforderlich.");
    if (data.points === 0) throw new Error("Punkte dürfen nicht 0 sein.");

    const { data: id, error } = await supabase.rpc("adjust_org_points_manual", {
      _organization_id: org.id,
      _target_user_id: data.userId,
      _points: data.points,
      _reason: data.reason,
      _category: data.category,
      _event_date: data.eventDate ?? undefined,
    } as any);
    if (error) throw new Error(error.message);
    return { id };
  });

// ================================================
// FORCE FINALIZE (staff only, for past months)
// ================================================
export const finalizeOrgMonthNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string; year: number; month: number }) => ({
    slug: String(d.slug),
    year: Number(d.year),
    month: Number(d.month),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = await resolveOrg(supabase, data.slug);
    const role = await assertOrgAccess(supabase, userId, org.id);
    if (role !== "staff") throw new Error("Nur Coach oder Org-Admin darf Monate finalisieren.");
    const { data: id, error } = await supabase.rpc("finalize_org_month", {
      _organization_id: org.id,
      _year: data.year,
      _month: data.month,
    } as any);
    if (error) throw new Error(error.message);
    return { id };
  });
