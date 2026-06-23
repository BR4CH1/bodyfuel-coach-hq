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

        const results: Array<{ user: string; ok: boolean; error?: string; skipped?: string; kind?: "regen" | "initial" }> = [];

        const tryGenerate = async (clientId: string, kind: "regen" | "initial") => {
          const { data: pkg } = await supabaseAdmin
            .from("customer_packages")
            .select("package")
            .eq("user_id", clientId)
            .eq("is_active", true)
            .maybeSingle();
          if (pkg?.package !== "smart") {
            results.push({ user: clientId, ok: false, skipped: "not_smart", kind });
            return;
          }
          const sub = await hasActiveSmartSubscription(supabaseAdmin as any, clientId);
          if (!sub.active) {
            results.push({ user: clientId, ok: false, skipped: `no_active_sub(${sub.status ?? "none"})`, kind });
            return;
          }
          try {
            await generateAiNutritionPlanCore(supabaseAdmin as any, {
              target: clientId,
              uploadedBy: null,
              start_mode: "today",
              plan_days: 30,
              apiKey,
            });
            results.push({ user: clientId, ok: true, kind });
          } catch (e) {
            results.push({ user: clientId, ok: false, error: (e as Error).message, kind });
          }
        };

        // Pass 1: Renewals — active Smart plan with expired scheduled_end_date
        for (const row of expired ?? []) {
          await tryGenerate(row.client_id, "regen");
        }

        // Pass 2: Initial creation — Smart users with a smart_nutrition_profile
        // but no nutrition plan yet (covers manually freigeschaltete 0€-Kunden,
        // bei denen kein Self-Service-Trigger lief).
        const { data: smartProfiles } = await supabaseAdmin
          .from("smart_nutrition_profile")
          .select("user_id");
        const candidateIds = (smartProfiles ?? []).map((r: { user_id: string }) => r.user_id);
        if (candidateIds.length > 0) {
          const { data: existingPlans } = await supabaseAdmin
            .from("nutrition_plans")
            .select("client_id")
            .eq("plan_type", "nutrition")
            .in("client_id", candidateIds)
            .in("status", ["active", "approved", "draft"]);
          const haveAny = new Set((existingPlans ?? []).map((r: { client_id: string }) => r.client_id));
          for (const id of candidateIds) {
            if (haveAny.has(id)) continue;
            await tryGenerate(id, "initial");
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
