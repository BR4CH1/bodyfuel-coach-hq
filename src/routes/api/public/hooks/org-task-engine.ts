import { createFileRoute } from "@tanstack/react-router";
import { runOrgTaskEngineWithClient } from "@/lib/organizations/task-engine.server";

/**
 * Daily automatic task engine runner.
 *
 * Called by pg_cron once per day at 03:00 UTC.
 * Iterates all active organizations and runs the engine per org.
 * Failures in one org do not abort the run for others.
 *
 * Auth: requires the Supabase anon key in the `apikey` header
 * (Lovable Cloud standard for /api/public/* cron endpoints).
 */
export const Route = createFileRoute("/api/public/hooks/org-task-engine")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        // Load body (optional { horizon_days, organization_id })
        let body: { horizon_days?: number; organization_id?: string } = {};
        try {
          body = (await request.json()) as any;
        } catch {}
        const horizonDays = Math.min(Math.max(body.horizon_days ?? 14, 1), 30);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let orgIds: string[] = [];
        if (body.organization_id) {
          orgIds = [body.organization_id];
        } else {
          const { data: orgs, error } = await supabaseAdmin
            .from("organizations")
            .select("id")
            .eq("status", "active");
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }
          orgIds = ((orgs ?? []) as any[]).map((o) => o.id);
        }

        const results: any[] = [];
        for (const orgId of orgIds) {
          try {
            const r = await runOrgTaskEngineWithClient(supabaseAdmin, orgId, horizonDays);
            results.push(r);
          } catch (e: any) {
            results.push({
              organization_id: orgId,
              error_count: 1,
              error_details: [e?.message || String(e)],
            });
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            processed_orgs: results.length,
            total_created: results.reduce((s, r) => s + (r.created_task_count ?? 0), 0),
            total_errors: results.reduce((s, r) => s + (r.error_count ?? 0), 0),
            results,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
