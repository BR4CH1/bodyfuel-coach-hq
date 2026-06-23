import { createFileRoute } from "@tanstack/react-router";
import { verifyCronAuth } from "@/lib/cron-auth.server";

/**
 * Auto-Regen für Smart-Ernährungspläne:
 * Findet aktive Smart-Nutrition-Pläne, deren scheduled_end_date erreicht ist,
 * prüft auf aktives Abo und generiert automatisch einen frischen 4-Wochen-Plan.
 *
 * Plan-Rotation (separater Cron) aktiviert den neuen Plan dann am Startdatum.
 *
 * Aufruf per pg_cron mit `Authorization: Bearer <CRON_HOOK_SECRET>`.
 */
export const Route = createFileRoute("/api/public/hooks/regen-nutrition-plans")({
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
        const { generateAiNutritionPlanCore } = await import("@/lib/nutrition-plan-ai.functions");
        const { hasActiveSmartSubscription } = await import("@/lib/smart-subscription.server");

        const today = new Date().toISOString().slice(0, 10);

        const { data: expired, error } = await supabaseAdmin
          .from("nutrition_plans")
          .select("id, client_id, scheduled_end_date")
          .eq("plan_type", "nutrition")
          .eq("is_active", true)
          .lt("scheduled_end_date", today);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const results: Array<{ user: string; ok: boolean; error?: string; skipped?: string }> = [];
        for (const row of expired ?? []) {
          const { data: pkg } = await supabaseAdmin
            .from("customer_packages")
            .select("package")
            .eq("user_id", row.client_id)
            .eq("is_active", true)
            .maybeSingle();
          if (pkg?.package !== "smart") {
            results.push({ user: row.client_id, ok: false, skipped: "not_smart" });
            continue;
          }
          const sub = await hasActiveSmartSubscription(supabaseAdmin as any, row.client_id);
          if (!sub.active) {
            results.push({ user: row.client_id, ok: false, skipped: `no_active_sub(${sub.status ?? "none"})` });
            continue;
          }

          try {
            await generateAiNutritionPlanCore(supabaseAdmin as any, {
              target: row.client_id,
              uploadedBy: null,
              start_mode: "today",
              plan_days: 30,
              apiKey,
            });
            results.push({ user: row.client_id, ok: true });
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
