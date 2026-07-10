import { createFileRoute } from "@tanstack/react-router";
import { verifyCronAuth } from "@/lib/cron-auth.server";

/**
 * Täglicher Load-Recalc: iteriert über alle `organization_load_days` im
 * Horizont (default 14 Tage) und triggert den protection-aware
 * `runNutritionRecalc` pro (org, team)-Scope. Idempotent — `auto_load_recalc`-
 * Overrides werden pro Tag frisch geschrieben.
 *
 * Aufruf per pg_cron mit `Authorization: Bearer <CRON_HOOK_SECRET>`.
 */
export const Route = createFileRoute("/api/public/hooks/recalc-nutrition-load")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = verifyCronAuth(request);
        if (!auth.ok) return auth.response;

        let horizonDays = 14;
        try {
          const body = (await request.json()) as { horizonDays?: number };
          if (typeof body?.horizonDays === "number") horizonDays = body.horizonDays;
        } catch {
          // leerer Body ist ok
        }
        const horizon = Math.min(Math.max(horizonDays, 1), 60);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runNutritionRecalc } = await import(
          "@/lib/organizations/nutrition-plan-recalc-core.server"
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString().slice(0, 10);
        const endIso = new Date(today.getTime() + horizon * 86400_000)
          .toISOString()
          .slice(0, 10);

        const { data: loadRows, error } = await supabaseAdmin
          .from("organization_load_days")
          .select("organization_id, team_id, date, created_by")
          .gte("date", todayIso)
          .lte("date", endIso);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const grouped = new Map<
          string,
          { orgId: string; teamId: string | null; caller: string; dates: Set<string> }
        >();
        for (const r of (loadRows ?? []) as Array<{
          organization_id: string;
          team_id: string | null;
          date: string;
          created_by: string | null;
        }>) {
          const key = `${r.organization_id}::${r.team_id ?? ""}`;
          const bucket = grouped.get(key) ?? {
            orgId: r.organization_id,
            teamId: r.team_id,
            caller: r.created_by ?? "",
            dates: new Set<string>(),
          };
          if (!bucket.caller && r.created_by) bucket.caller = r.created_by;
          bucket.dates.add(r.date);
          grouped.set(key, bucket);
        }

        let scopes = 0;
        let users = 0;
        let reports = 0;
        let overrides = 0;
        const errors: Array<{ orgId: string; teamId: string | null; error: string }> = [];

        for (const bucket of grouped.values()) {
          // Fallback-Caller: bevorzugt der zuletzt schreibende Coach, sonst
          // suche einen aktiven Coach in staff_assignments dieser Org.
          let caller = bucket.caller;
          if (!caller) {
            const { data: staff } = await supabaseAdmin
              .from("staff_assignments")
              .select("user_id")
              .eq("organization_id", bucket.orgId)
              .limit(1);
            caller = ((staff ?? [])[0] as { user_id?: string } | undefined)?.user_id ?? "";
          }
          if (!caller) continue;

          try {
            const res = await runNutritionRecalc(supabaseAdmin, {
              callerId: caller,
              orgId: bucket.orgId,
              teamId: bucket.teamId,
              userId: null,
              dates: Array.from(bucket.dates),
              reason: "intensity_increase",
            });
            scopes += 1;
            users += res.affected_users;
            reports += res.reports.length;
            overrides += res.reports.reduce((s, r) => s + r.overrides_written, 0);
          } catch (e) {
            errors.push({
              orgId: bucket.orgId,
              teamId: bucket.teamId,
              error: (e as Error).message,
            });
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            horizon_days: horizon,
            scopes_processed: scopes,
            users_touched: users,
            day_reports: reports,
            overrides_written: overrides,
            errors,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
