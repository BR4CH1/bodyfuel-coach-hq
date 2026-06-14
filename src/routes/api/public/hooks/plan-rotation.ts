import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Daily rotation hook: activates scheduled/published "next" plans whose
// scheduled_start_date has arrived (when client opted into auto_publish),
// and archives any active plan whose scheduled_end_date has passed.
//
// Triggered by pg_cron. Authenticated via Supabase publishable apikey header.
export const Route = createFileRoute("/api/public/hooks/plan-rotation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") || "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          "";
        if (!apikey || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const url = process.env.SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const today = new Date().toISOString().slice(0, 10);
        const log: any[] = [];

        // 1. Auto-archive: active plans past scheduled_end_date
        const { data: expired } = await admin
          .from("nutrition_plans")
          .select("id, client_id, title")
          .eq("status", "active")
          .not("scheduled_end_date", "is", null)
          .lt("scheduled_end_date", today);

        for (const p of (expired ?? []) as any[]) {
          await admin
            .from("nutrition_plans")
            .update({ status: "archived" })
            .eq("id", p.id);
          log.push({ action: "archived_expired", plan: p.id, client: p.client_id });
        }

        // 2. Auto-activate: clients with auto_publish=true whose published/approved
        //    plan should start today (scheduled_start_date <= today or null).
        const { data: profiles } = await admin
          .from("smart_nutrition_profile")
          .select("user_id")
          .eq("auto_publish", true);

        for (const prof of (profiles ?? []) as any[]) {
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
          if (!cand) continue;

          // Archive currently active for this client
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
        }

        return new Response(
          JSON.stringify({ ok: true, today, processed: log.length, log }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
