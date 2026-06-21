import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyCronAuth } from "@/lib/cron-auth.server";

// Daily rotation hook — runs nightly via pg_cron.
//
// Goal: every client with at least one generated plan (nutrition AND training)
// must end the night with an active plan whose date window covers TODAY.
//
// Steps for each plan_type in ("nutrition", "training"):
//   1. Archive plans whose scheduled_end_date is before today (cleanup).
//   2. For every client without an active plan that covers today, find the
//      newest non-archived plan (active/published/approved/draft) and:
//        - if its scheduled_start_date is in the future OR null → shift it to
//          today, keeping its original duration so the customer sees content
//          immediately (closes the gap that caused "auto-activation didn't
//          work" reports).
//        - archive any other plan of the same type for that client.
//        - mark the chosen plan as 'active'.
//
// The auto_publish flag is no longer required — Smart/Premium clients always
// get rotated. Coach-managed clients still get rotation only when a freshly
// generated draft exists (which is created by the regen hooks for Smart users
// or manually by the coach), so this is safe.
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

        for (const planType of ["nutrition", "training"] as const) {
          // 1. Archive expired plans (active or otherwise) — they are stale.
          const { data: expired } = await admin
            .from("nutrition_plans")
            .select("id, client_id")
            .eq("plan_type", planType)
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
              log.push({
                action: "archived_expired",
                plan_type: planType,
                plan: (p as any).id,
                client: (p as any).client_id,
              });
          }

          // 2. Find candidate plans for clients without active coverage.
          //    Pull all non-archived plans of this type, group by client.
          const { data: candidates } = await admin
            .from("nutrition_plans")
            .select(
              "id, client_id, status, scheduled_start_date, scheduled_end_date, created_at",
            )
            .eq("plan_type", planType)
            .in("status", ["active", "approved", "published", "draft"])
            .order("created_at", { ascending: false });

          const byClient = new Map<string, any[]>();
          for (const row of (candidates ?? []) as any[]) {
            const arr = byClient.get(row.client_id) ?? [];
            arr.push(row);
            byClient.set(row.client_id, arr);
          }

          const CHUNK = 5;
          const clientIds = Array.from(byClient.keys());
          for (let i = 0; i < clientIds.length; i += CHUNK) {
            const slice = clientIds.slice(i, i + CHUNK);
            await Promise.all(
              slice.map(async (clientId) => {
                const plans = byClient.get(clientId)!;

                // Is there already an active plan that covers today? Done.
                const coveringActive = plans.find(
                  (p) =>
                    p.status === "active" &&
                    (!p.scheduled_start_date ||
                      p.scheduled_start_date <= today) &&
                    (!p.scheduled_end_date || p.scheduled_end_date >= today),
                );
                if (coveringActive) return;

                // Pick the newest non-archived plan as the next active one.
                const next = plans[0];
                if (!next) return;

                // If start date is in the future or missing, shift window to
                // today so the customer immediately has visible content.
                let patch: Record<string, any> = { status: "active" };
                const startsInFuture =
                  !next.scheduled_start_date ||
                  next.scheduled_start_date > today;
                if (startsInFuture) {
                  let durationDays = 28;
                  if (next.scheduled_start_date && next.scheduled_end_date) {
                    const s = new Date(next.scheduled_start_date).getTime();
                    const e = new Date(next.scheduled_end_date).getTime();
                    durationDays = Math.max(
                      1,
                      Math.round((e - s) / 86_400_000) + 1,
                    );
                  }
                  const endDate = new Date(today);
                  endDate.setDate(endDate.getDate() + durationDays - 1);
                  patch.scheduled_start_date = today;
                  patch.scheduled_end_date = endDate
                    .toISOString()
                    .slice(0, 10);
                }

                // Archive any other plan of this type for the client.
                const otherIds = plans
                  .filter((p) => p.id !== next.id && p.status !== "archived")
                  .map((p) => p.id);
                if (otherIds.length) {
                  await admin
                    .from("nutrition_plans")
                    .update({ status: "archived" })
                    .in("id", otherIds);
                }

                const { error } = await admin
                  .from("nutrition_plans")
                  .update(patch)
                  .eq("id", next.id);
                if (error) {
                  log.push({
                    action: "activate_failed",
                    plan_type: planType,
                    plan: next.id,
                    client: clientId,
                    error: error.message,
                  });
                  return;
                }
                log.push({
                  action: "activated",
                  plan_type: planType,
                  plan: next.id,
                  client: clientId,
                  shifted_start: startsInFuture ? today : undefined,
                });
              }),
            );
          }
        }

        return new Response(
          JSON.stringify({ ok: true, today, processed: log.length, log }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
