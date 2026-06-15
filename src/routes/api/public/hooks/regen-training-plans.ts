import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron-Endpoint: Findet aktive Trainingspläne, deren Zeitraum (4 Wochen)
 * abgelaufen ist, und generiert für jeden Kunden automatisch einen neuen
 * Smart-Plan als Entwurf. Coach bekommt diesen über die normale
 * Plan-Vorschau zur Freigabe.
 *
 * Aufruf per pg_cron mit `apikey`-Header (anon key) — bypassed Auth durch
 * den `/api/public/*` Prefix; Schutz erfolgt über zusätzlichen Vergleich
 * mit `VITE_SUPABASE_PUBLISHABLE_KEY`.
 */
export const Route = createFileRoute("/api/public/hooks/regen-training-plans")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!auth || !expected || auth !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { generateTrainingPlanCore } = await import("@/lib/training-plan-ai-core.server");

        const today = new Date().toISOString().slice(0, 10);

        const { data: expired, error } = await supabaseAdmin
          .from("nutrition_plans")
          .select("id, client_id, scheduled_end_date")
          .eq("plan_type", "training")
          .eq("is_active", true)
          .lt("scheduled_end_date", today);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const results: Array<{ user: string; ok: boolean; error?: string; plan_id?: string }> = [];
        for (const row of expired ?? []) {
          try {
            const r = await generateTrainingPlanCore(supabaseAdmin as any, {
              target: row.client_id,
              uploadedBy: null,
              startMode: "today",
              apiKey,
              title: `Smart-Trainingsplan (Auto) — ${new Date().toLocaleDateString("de-DE")}`,
            });
            results.push({ user: row.client_id, ok: true, plan_id: r.plan_id });
          } catch (e) {
            results.push({ user: row.client_id, ok: false, error: (e as Error).message });
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
