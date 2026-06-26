import { createFileRoute } from "@tanstack/react-router";
import { verifyCronAuth } from "@/lib/cron-auth.server";

/**
 * Verarbeitet Smart-Autopilot-Jobs in der Warteschlange.
 *
 * Pro Aufruf wird EIN Job-Schritt erledigt (entweder Ernährungsplan oder
 * Trainingsplan), damit ein einzelner Worker-Request nicht beide langen
 * LLM-Calls in Folge ausführen muss. Ein Job durchläuft:
 *   pending/nutrition  → running/nutrition  → running/training  → done/done
 *
 * pg_cron ruft diesen Endpoint im Minutentakt mit `CRON_HOOK_SECRET` auf.
 */
export const Route = createFileRoute("/api/public/hooks/process-autopilot-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = verifyCronAuth(request);
        if (!auth.ok) return auth.response;

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Bis zu 3 offene Jobs pro Aufruf — jeder macht genau einen Schritt.
        const { data: jobs, error } = await supabaseAdmin
          .from("smart_autopilot_jobs")
          .select("*")
          .in("status", ["pending", "running"])
          .neq("step", "done")
          .order("created_at", { ascending: true })
          .limit(3);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const results: Array<{ id: string; step: string; ok: boolean; error?: string }> = [];

        for (const job of jobs ?? []) {
          try {
            await supabaseAdmin
              .from("smart_autopilot_jobs")
              .update({
                status: "running",
                started_at: job.started_at ?? new Date().toISOString(),
                attempts: (job.attempts ?? 0) + 1,
                error: null,
              })
              .eq("id", job.id);

            if (job.step === "nutrition") {
              const { generateAiNutritionPlanCore } = await import("@/lib/nutrition-plan-ai.functions");
              const res = await generateAiNutritionPlanCore(supabaseAdmin as any, {
                target: job.user_id,
                uploadedBy: job.user_id,
                start_mode: "today",
                plan_days: 31,
                apiKey,
              });
              const planId = (res as any)?.plan_id ?? (res as any)?.id ?? null;
              await activateLatestPlan(supabaseAdmin, job.user_id, "nutrition");
              await supabaseAdmin
                .from("smart_autopilot_jobs")
                .update({ step: "training", nutrition_plan_id: planId })
                .eq("id", job.id);
              results.push({ id: job.id, step: "nutrition", ok: true });
              continue;
            }

            if (job.step === "training") {
              const { generateTrainingPlanCore } = await import("@/lib/training-plan-ai-core.server");
              const res = await generateTrainingPlanCore(supabaseAdmin as any, {
                target: job.user_id,
                uploadedBy: job.user_id,
                startMode: "today",
                apiKey,
                weeks: 4,
              });
              const planId = (res as any)?.plan_id ?? null;
              await activateLatestPlan(supabaseAdmin, job.user_id, "training");
              await supabaseAdmin
                .from("smart_autopilot_jobs")
                .update({
                  status: "done",
                  step: "done",
                  training_plan_id: planId,
                  finished_at: new Date().toISOString(),
                })
                .eq("id", job.id);
              results.push({ id: job.id, step: "training", ok: true });
              continue;
            }
          } catch (e) {
            const message = (e as Error).message ?? String(e);
            const attempts = (job.attempts ?? 0) + 1;
            const failed = attempts >= 3;
            await supabaseAdmin
              .from("smart_autopilot_jobs")
              .update({
                status: failed ? "failed" : "pending",
                error: message.slice(0, 1000),
                finished_at: failed ? new Date().toISOString() : null,
              })
              .eq("id", job.id);
            results.push({ id: job.id, step: job.step, ok: false, error: message });
          }
        }

        return new Response(
          JSON.stringify({ ok: true, processed: results.length, results }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});

async function activateLatestPlan(
  supabase: any,
  userId: string,
  planType: "nutrition" | "training",
) {
  const { data: draft } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("client_id", userId)
    .eq("plan_type", planType)
    .in("status", ["draft", "approved", "published"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draft) return;
  await supabase
    .from("nutrition_plans")
    .update({ status: "archived" })
    .eq("client_id", userId)
    .eq("plan_type", planType)
    .eq("status", "active");
  await supabase
    .from("nutrition_plans")
    .update({ status: "active" })
    .eq("id", draft.id);
}
