import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { render } from "@react-email/components";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { verifyCronAuth } from "@/lib/cron-auth.server";

const SITE_NAME = "BODYFUEL";
const SENDER_DOMAIN = "notify.bodyfuel-coaching.com";
const FROM_DOMAIN = "bodyfuel-coaching.com";
const DASHBOARD_URL = "https://bodyfuel-coaching.com/coach";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mondayOf(d: Date): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/public/hooks/coach-daily-summary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = verifyCronAuth(request);
        if (!auth.ok) return auth.response;

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ error: "Server config error" }, { status: 500 });
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const template = TEMPLATES["coach-daily-summary"];
        if (!template) return Response.json({ error: "Template missing" }, { status: 500 });

        // ---- 1. Aggregate critical client data (global — all coaches share the client pool) ----
        const { data: clientRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "client");
        const clientIds = (clientRoles ?? []).map((r) => r.user_id);

        let openCheckins = 0;
        let expiringPlans = 0;
        let inactiveClients = 0;
        let redClients = 0;
        const criticalNames: string[] = [];

        if (clientIds.length > 0) {
          const today = new Date();
          const weekStart = mondayOf(today);
          const in5Days = isoDate(new Date(today.getTime() + 5 * 86400000));
          const past14 = isoDate(new Date(today.getTime() - 14 * 86400000));

          const [profilesRes, checkinsRes, plansRes, checksRes] = await Promise.all([
            supabase.from("profiles").select("id, display_name").in("id", clientIds),
            supabase
              .from("weekly_checkins")
              .select("user_id, week_start")
              .in("user_id", clientIds)
              .gte("week_start", weekStart),
            supabase
              .from("nutrition_plans")
              .select("client_id, plan_type, scheduled_end_date, status")
              .in("client_id", clientIds)
              .eq("status", "active")
              .lte("scheduled_end_date", in5Days),
            supabase
              .from("daily_checks")
              .select("user_id, date")
              .in("user_id", clientIds)
              .gte("date", past14),
          ]);

          const nameById = new Map<string, string>();
          (profilesRes.data ?? []).forEach((p: any) =>
            nameById.set(p.id, p.display_name ?? "Ohne Namen"),
          );

          const checkedThisWeek = new Set<string>(
            (checkinsRes.data ?? []).map((c: any) => c.user_id),
          );
          const openCheckinIds = clientIds.filter((id) => !checkedThisWeek.has(id));
          openCheckins = openCheckinIds.length;

          expiringPlans = (plansRes.data ?? []).length;

          const activeRecent = new Set<string>(
            (checksRes.data ?? []).map((c: any) => c.user_id),
          );
          const inactiveIds = clientIds.filter((id) => !activeRecent.has(id));
          inactiveClients = inactiveIds.length;

          // Red clients = open check-in AND inactive >14d (proxy for "akut")
          const redSet = new Set<string>(
            openCheckinIds.filter((id) => !activeRecent.has(id)),
          );
          redClients = redSet.size;
          for (const id of redSet) {
            if (criticalNames.length >= 5) break;
            criticalNames.push(nameById.get(id) ?? "Ohne Namen");
          }
        }

        // New leads in last 24h
        const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { count: leadsCount } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since24h);
        const newLeads = leadsCount ?? 0;

        // ---- 2. Find recipients (all coaches) ----
        const { data: coachRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "coach");
        const coachIds = (coachRoles ?? []).map((r) => r.user_id);

        if (coachIds.length === 0) {
          return Response.json({ ok: true, processed: 0, reason: "no_coaches" });
        }

        const { data: coachProfiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", coachIds);
        const profileById = new Map<string, { display_name: string | null }>();
        (coachProfiles ?? []).forEach((p: any) => profileById.set(p.id, p));

        const todayStr = isoDate(new Date());
        const results: Array<{ coach_id: string; status: string; reason?: string }> = [];

        for (const coachId of coachIds) {
          const { data: u } = await supabase.auth.admin.getUserById(coachId);
          const email = u?.user?.email;
          if (!email) {
            results.push({ coach_id: coachId, status: "skipped", reason: "no_email" });
            continue;
          }

          const normalized = email.toLowerCase();
          const idempotencyKey = `coach-daily-summary:${coachId}:${todayStr}`;

          const { data: existing } = await supabase
            .from("email_send_log")
            .select("id")
            .eq("template_name", "coach-daily-summary")
            .eq("recipient_email", normalized)
            .eq("message_id", idempotencyKey)
            .maybeSingle();
          if (existing) {
            results.push({ coach_id: coachId, status: "duplicate" });
            continue;
          }

          const { data: supp } = await supabase
            .from("suppressed_emails")
            .select("email")
            .eq("email", normalized)
            .maybeSingle();
          if (supp) {
            results.push({ coach_id: coachId, status: "suppressed" });
            continue;
          }

          let unsubscribeToken: string | null = null;
          const { data: tokRow } = await supabase
            .from("email_unsubscribe_tokens")
            .select("token, used_at")
            .eq("email", normalized)
            .maybeSingle();
          if (tokRow?.token && !tokRow.used_at) {
            unsubscribeToken = tokRow.token;
          } else if (!tokRow) {
            const newTok = generateToken();
            await supabase
              .from("email_unsubscribe_tokens")
              .upsert({ email: normalized, token: newTok }, { onConflict: "email" });
            unsubscribeToken = newTok;
          }

          const coachProfile = profileById.get(coachId);
          const data: Record<string, any> = {
            name: coachProfile?.display_name?.split(" ")[0] ?? "",
            date: new Date().toLocaleDateString("de-DE"),
            openCheckins,
            expiringPlans,
            inactiveClients,
            redClients,
            newLeads,
            topCriticalNames: criticalNames,
            dashboardUrl: DASHBOARD_URL,
            siteName: SITE_NAME,
          };

          const element = React.createElement(template.component, data);
          const html = await render(element);
          const text = await render(element, { plainText: true });
          const subject =
            typeof template.subject === "function" ? template.subject(data) : template.subject;

          await supabase.from("email_send_log").insert({
            message_id: idempotencyKey,
            template_name: "coach-daily-summary",
            recipient_email: normalized,
            status: "pending",
          });

          const { error: enqErr } = await supabase.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              message_id: idempotencyKey,
              to: normalized,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject,
              html,
              text,
              purpose: "transactional",
              label: "coach-daily-summary",
              idempotency_key: idempotencyKey,
              unsubscribe_token: unsubscribeToken,
              queued_at: new Date().toISOString(),
            },
          });

          if (enqErr) {
            results.push({ coach_id: coachId, status: "error", reason: enqErr.message });
          } else {
            results.push({ coach_id: coachId, status: "queued" });
          }
        }

        return Response.json({
          ok: true,
          processed: results.length,
          totals: { openCheckins, expiringPlans, inactiveClients, redClients, newLeads },
          results,
        });
      },
    },
  },
});
