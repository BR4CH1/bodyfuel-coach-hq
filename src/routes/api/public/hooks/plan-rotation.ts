import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyCronAuth } from "@/lib/cron-auth.server";

// Daily rotation hook: activates scheduled/published "next" plans whose
// scheduled_start_date has arrived (when client opted into auto_publish),
// and archives any active plan whose scheduled_end_date has passed.
//
// Triggered by pg_cron. Authenticated via CRON_HOOK_SECRET bearer header.
export const Route = createFileRoute("/api/public/hooks/plan-rotation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = verifyCronAuth(request);
        if (!auth.ok) return auth.response;

        const url = process.env.SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const today = new Date().toISOString().slice(0, 10);
        const log: any[] = [];

        // 1. Auto-archive: active plans past scheduled_end_date (bulk update)
        const { data: expired } = await admin
          .from("nutrition_plans")
          .select("id, client_id")
          .eq("status", "active")
          .not("scheduled_end_date", "is", null)
          .lt("scheduled_end_date", today);
        const expiredIds = (expired ?? []).map((p: any) => p.id);
        if (expiredIds.length) {
          await admin
            .from("nutrition_plans")
            .update({ status: "archived" })
            .in("id", expiredIds);
          for (const p of expired ?? [])
            log.push({ action: "archived_expired", plan: (p as any).id, client: (p as any).client_id });
        }

        // 2. Auto-activate: clients with auto_publish=true whose published/approved
        //    plan should start today. Process clients in parallel chunks to stay
        //    inside Worker CPU limits.
        const { data: profiles } = await admin
          .from("smart_nutrition_profile")
          .select("user_id")
          .eq("auto_publish", true);

        const profList = (profiles ?? []) as any[];
        const CHUNK = 5;
        for (let i = 0; i < profList.length; i += CHUNK) {
          const slice = profList.slice(i, i + CHUNK);
          await Promise.all(
            slice.map(async (prof) => {
              const clientId = prof.user_id;
              const { data: candidates } = await admin
                .from("nutrition_plans")
                .select("id, status, scheduled_start_date, created_at")
                .eq("client_id", clientId)
                .eq("plan_type", "nutrition")
                .in("status", ["approved", "published"])
                .order("created_at", { ascending: false });

              const cand = (candidates ?? []).find(
                (c: any) =>
                  !c.scheduled_start_date || c.scheduled_start_date <= today,
              ) as any;
              if (!cand) return;

              await admin
                .from("nutrition_plans")
                .update({ status: "archived" })
                .eq("client_id", clientId)
                .eq("plan_type", "nutrition")
                .eq("status", "active");

              await admin
                .from("nutrition_plans")
                .update({ status: "active" })
                .eq("id", cand.id);

              log.push({ action: "activated", plan: cand.id, client: clientId });
            }),
          );
        }

        return new Response(
          JSON.stringify({ ok: true, today, processed: log.length, log }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
