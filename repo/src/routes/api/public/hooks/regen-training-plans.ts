import { createFileRoute } from "@tanstack/react-router";
import { verifyCronAuth } from "@/lib/cron-auth.server";

/**
 * Cron-Endpoint: Findet aktive Trainingspläne, deren Zeitraum (1 Monat)
 * abgelaufen ist, und generiert für jeden Kunden automatisch einen neuen
 * Smart-Plan als Entwurf. Coach bekommt diesen über die normale
 * Plan-Vorschau zur Freigabe.
 *
 * Aufruf per pg_cron mit `Authorization: Bearer <CRON_HOOK_SECRET>`.
 */
export const Route = createFileRoute("/api/public/hooks/regen-training-plans")({
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

        const { hasActiveSmartSubscription } = await import("@/lib/smart-subscription.server");

        const results: Array<{ user: string; ok: boolean; error?: string; plan_id?: string; skipped?: string }> = [];
        for (const row of expired ?? []) {
          // Nur Smart-Kunden mit aktivem Abo bekommen automatisch einen neuen Plan
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

          // Strength-Check muss frisch sein (≤ 30 Tage) — sonst wartet das System
          const { data: lastCheck } = await supabaseAdmin
            .from("strength_checks")
            .select("performed_at")
            .eq("user_id", row.client_id)
            .eq("status", "completed")
            .order("performed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const ageDays = lastCheck?.performed_at
            ? Math.floor((Date.now() - new Date(lastCheck.performed_at).getTime()) / 86_400_000)
            : null;
          if (ageDays == null || ageDays > 30) {
            results.push({ user: row.client_id, ok: false, skipped: "strength_check_stale" });
            continue;
          }

          try {
            const r = await generateTrainingPlanCore(supabaseAdmin as any, {
              target: row.client_id,
              uploadedBy: null,
              startMode: "today",
              apiKey,
              title: `Smart-Trainingsplan (Auto) — ${new Date().toLocaleDateString("de-DE")}`,
              weeks: 4,
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
