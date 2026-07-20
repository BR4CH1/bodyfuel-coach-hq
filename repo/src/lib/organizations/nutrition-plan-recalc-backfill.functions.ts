import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Coach-only Backfill: läuft einmalig runNutritionRecalc für alle
 * organization_load_days ab heute (bis heute + horizonDays), pro
 * Organisation und Team-Scope. Athlet-Overrides werden separat verarbeitet.
 *
 * Aufruf zum Beispiel aus einer Admin-UI oder aus dem Cron. Idempotent —
 * auto_load_recalc-Overrides werden pro Tag gelöscht und neu geschrieben.
 */
export const backfillNutritionRecalcAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { horizonDays?: number; orgId?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Nur globale Coaches oder Org-Staff dürfen backfillen.
    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "coach",
    });
    if (!isCoach) {
      const { data: staff } = await supabase
        .from("staff_assignments")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      if (!staff || staff.length === 0) {
        throw new Response("Forbidden", { status: 403 });
      }
    }

    const horizon = Math.min(Math.max(data.horizonDays ?? 14, 1), 60);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);
    const endIso = new Date(today.getTime() + horizon * 86400_000)
      .toISOString()
      .slice(0, 10);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("organization_load_days")
      .select("organization_id, team_id, date")
      .gte("date", todayIso)
      .lte("date", endIso);
    if (data.orgId) q = q.eq("organization_id", data.orgId);
    const { data: loadRows, error } = await q;
    if (error) throw new Error(error.message);

    // Gruppieren nach (org, team) → Liste von Dates
    const grouped = new Map<
      string,
      { orgId: string; teamId: string | null; dates: Set<string> }
    >();
    for (const r of (loadRows ?? []) as Array<{
      organization_id: string;
      team_id: string | null;
      date: string;
    }>) {
      const key = `${r.organization_id}::${r.team_id ?? ""}`;
      const bucket = grouped.get(key) ?? {
        orgId: r.organization_id,
        teamId: r.team_id,
        dates: new Set<string>(),
      };
      bucket.dates.add(r.date);
      grouped.set(key, bucket);
    }

    const { runNutritionRecalc } = await import(
      "./nutrition-plan-recalc-core.server"
    );

    let scopes = 0;
    let totalUsers = 0;
    let totalReports = 0;
    let totalOverrides = 0;
    for (const bucket of grouped.values()) {
      const res = await runNutritionRecalc(supabase, {
        callerId: userId,
        orgId: bucket.orgId,
        teamId: bucket.teamId,
        userId: null,
        dates: Array.from(bucket.dates),
        reason: "intensity_increase",
      });
      scopes += 1;
      totalUsers += res.affected_users;
      totalReports += res.reports.length;
      totalOverrides += res.reports.reduce(
        (sum, r) => sum + r.overrides_written,
        0,
      );
    }

    return {
      ok: true,
      horizon_days: horizon,
      scopes_processed: scopes,
      users_touched: totalUsers,
      day_reports: totalReports,
      overrides_written: totalOverrides,
    };
  });
