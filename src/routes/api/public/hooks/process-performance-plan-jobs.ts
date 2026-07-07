import { createFileRoute } from "@tanstack/react-router";
import { verifyCronAuth } from "@/lib/cron-auth.server";

/**
 * BodyFuel Performance — Auto-Plan Job Worker
 *
 * Verarbeitet Performance-Ernährungsplan-Jobs aus `performance_plan_jobs`.
 * Pro Aufruf wird EIN Job-Schritt erledigt: entweder wird der Job erstmalig
 * expandiert (Athleten-Liste erstellt), oder es wird EIN weiterer Athlet
 * regeneriert. Das schützt vor Cloudflare-524-Timeouts bei großen Teams.
 *
 * Der Athletenfortschritt eines Jobs wird über die `performance_plan_history`
 * ermittelt (Athleten mit mind. einem History-Eintrag für den Job gelten
 * als verarbeitet). Ein einzelner Athletenfehler stoppt den Job NIE.
 */
export const Route = createFileRoute("/api/public/hooks/process-performance-plan-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = verifyCronAuth(request);
        if (!auth.ok) return auth.response;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { generateOrUpdatePerformanceNutritionWeekAdmin } = await import(
          "@/lib/performance-nutrition/auto-plan.functions"
        );

        // 1) Take the oldest pending/processing job (no SKIP LOCKED via PostgREST,
        // but we set status→processing atomically per athlete iteration).
        const { data: jobs, error } = await supabaseAdmin
          .from("performance_plan_jobs")
          .select("*")
          .in("status", ["pending", "processing"])
          .order("created_at", { ascending: true })
          .limit(1);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        const job = (jobs ?? [])[0];
        if (!job) {
          return new Response(JSON.stringify({ ok: true, idle: true }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // 2) Resolve athlete list for this job (single-athlete jobs skip the query).
        let athleteIds: string[] = [];
        if (job.athlete_user_id) {
          athleteIds = [job.athlete_user_id as string];
        } else if (job.team_id) {
          const { data: rows } = await supabaseAdmin
            .from("team_memberships")
            .select("user_id")
            .eq("team_id", job.team_id)
            .eq("status", "active");
          athleteIds = ((rows as { user_id: string }[]) ?? []).map((r) => r.user_id);
        } else {
          // Org-wide: iterate athletes with an org-scoped performance profile.
          const { data: rows } = await supabaseAdmin
            .from("performance_nutrition_profiles")
            .select("user_id")
            .eq("organization_id", job.organization_id);
          athleteIds = ((rows as { user_id: string }[]) ?? []).map((r) => r.user_id);
        }

        if (job.status === "pending") {
          await supabaseAdmin
            .from("performance_plan_jobs")
            .update({
              status: "processing",
              started_at: job.started_at ?? new Date().toISOString(),
              total_athletes: athleteIds.length,
              attempts: (job.attempts ?? 0) + 1,
            })
            .eq("id", job.id);
        }

        if (athleteIds.length === 0) {
          await supabaseAdmin
            .from("performance_plan_jobs")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              total_athletes: 0,
            })
            .eq("id", job.id);
          return new Response(JSON.stringify({ ok: true, job_id: job.id, empty: true }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // 3) Find athletes not yet processed for this job (via history join).
        const { data: doneRows } = await supabaseAdmin
          .from("performance_plan_history")
          .select("user_id")
          .eq("job_id", job.id);
        const doneSet = new Set(
          ((doneRows as { user_id: string }[]) ?? []).map((r) => r.user_id),
        );
        const pendingIds = athleteIds.filter((id) => !doneSet.has(id));

        if (pendingIds.length === 0) {
          const failed = (job.failed_count ?? 0) > 0;
          await supabaseAdmin
            .from("performance_plan_jobs")
            .update({
              status: failed ? "completed_with_errors" : "completed",
              completed_at: new Date().toISOString(),
              processed_athletes: athleteIds.length,
            })
            .eq("id", job.id);
          return new Response(JSON.stringify({ ok: true, job_id: job.id, done: true }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // 4) Process ONE athlete this request.
        const nextId = pendingIds[0];
        let generated = 0;
        let updated = 0;
        let skipped = 0;
        let failed = 0;
        let athleteError: string | null = null;
        try {
          const res = await generateOrUpdatePerformanceNutritionWeekAdmin(
            supabaseAdmin as any,
            {
              organizationId: job.organization_id as string,
              userId: nextId,
              weekStart: job.week_start as string,
              trigger: job.trigger as any,
              jobId: job.id as string,
            },
          );
          generated = res.generated;
          updated = res.updated;
          skipped = res.skipped;
          failed = res.failed;
        } catch (e) {
          athleteError = (e as Error).message ?? String(e);
          failed = 1;
          // Ensure we produce at least one history row for this athlete so
          // the worker doesn't loop forever on the same failing athlete.
          await supabaseAdmin.from("performance_plan_history").insert({
            user_id: nextId,
            organization_id: job.organization_id,
            job_id: job.id,
            date: job.week_start,
            trigger: job.trigger,
            action: "FAILED",
            message: athleteError.slice(0, 1000),
          });
        }

        await supabaseAdmin
          .from("performance_plan_jobs")
          .update({
            processed_athletes: (job.processed_athletes ?? 0) + 1,
            generated_count: (job.generated_count ?? 0) + generated,
            updated_count: (job.updated_count ?? 0) + updated,
            skipped_count: (job.skipped_count ?? 0) + skipped,
            failed_count: (job.failed_count ?? 0) + failed,
            last_error: athleteError,
          })
          .eq("id", job.id);

        // 5) If this was the last athlete, mark the job complete.
        if (pendingIds.length === 1) {
          const willFail = (job.failed_count ?? 0) + failed > 0;
          await supabaseAdmin
            .from("performance_plan_jobs")
            .update({
              status: willFail ? "completed_with_errors" : "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        }

        return new Response(
          JSON.stringify({
            ok: true,
            job_id: job.id,
            processed_user: nextId,
            remaining: pendingIds.length - 1,
            generated,
            updated,
            skipped,
            failed,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
