import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { render } from "@react-email/components";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";

// Reminder-Trigger: Tage VOR Ablauf, an denen eine E-Mail gehen soll.
const REMIND_DAYS = [3, 1, 0] as const;

const SITE_NAME = "BODYFUEL";
const SENDER_DOMAIN = "notify.bodyfuel-coaching.com";
const FROM_DOMAIN = "bodyfuel-coaching.com";
const ACTIVATE_URL = "https://bodyfuel-coaching.com/profile";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/public/hooks/trial-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        const apikey = request.headers.get("apikey");
        if (!anonKey || apikey !== anonKey) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ error: "Server config error" }, { status: 500 });
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const template = TEMPLATES["trial-reminder"];
        if (!template) {
          return Response.json({ error: "Template missing" }, { status: 500 });
        }

        const today = new Date();
        const targets = REMIND_DAYS.map((d) => {
          const dt = new Date(today);
          dt.setUTCDate(dt.getUTCDate() + d);
          return { daysLeft: d, date: isoDate(dt) };
        });
        const dateList = targets.map((t) => t.date);

        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("id, display_name, trial_end")
          .eq("trial_status", "trial")
          .in("trial_end", dateList);

        if (pErr) {
          console.error("trial-reminders: profiles query failed", pErr);
          return Response.json({ error: pErr.message }, { status: 500 });
        }

        const results: Array<{ user_id: string; status: string; reason?: string }> = [];

        for (const profile of profiles ?? []) {
          const target = targets.find((t) => t.date === profile.trial_end);
          if (!target) continue;

          // E-Mail aus auth.users holen
          const { data: u } = await supabase.auth.admin.getUserById(profile.id);
          const email = u?.user?.email;
          if (!email) {
            results.push({ user_id: profile.id, status: "skipped", reason: "no_email" });
            continue;
          }

          const normalized = email.toLowerCase();
          const idempotencyKey = `trial-reminder:${profile.id}:${target.date}:${target.daysLeft}`;

          // Duplikat-Schutz: schon mal mit diesem message_id-Suffix gesendet?
          const { data: existing } = await supabase
            .from("email_send_log")
            .select("id")
            .eq("template_name", "trial-reminder")
            .eq("recipient_email", normalized)
            .eq("message_id", idempotencyKey)
            .maybeSingle();
          if (existing) {
            results.push({ user_id: profile.id, status: "duplicate" });
            continue;
          }

          // Suppression-Check
          const { data: supp } = await supabase
            .from("suppressed_emails")
            .select("email")
            .eq("email", normalized)
            .maybeSingle();
          if (supp) {
            results.push({ user_id: profile.id, status: "suppressed" });
            continue;
          }

          // Unsubscribe-Token sicherstellen
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
            const { data: stored } = await supabase
              .from("email_unsubscribe_tokens")
              .select("token")
              .eq("email", normalized)
              .maybeSingle();
            unsubscribeToken = stored?.token ?? newTok;
          }

          const data: Record<string, any> = {
            name: profile.display_name?.split(" ")[0] ?? "",
            daysLeft: target.daysLeft,
            activateUrl: ACTIVATE_URL,
            siteName: SITE_NAME,
          };

          const element = React.createElement(template.component, data);
          const html = await render(element);
          const text = await render(element, { plainText: true });
          const subject =
            typeof template.subject === "function" ? template.subject(data) : template.subject;

          await supabase.from("email_send_log").insert({
            message_id: idempotencyKey,
            template_name: "trial-reminder",
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
              label: "trial-reminder",
              idempotency_key: idempotencyKey,
              unsubscribe_token: unsubscribeToken,
              queued_at: new Date().toISOString(),
            },
          });

          if (enqErr) {
            results.push({ user_id: profile.id, status: "error", reason: enqErr.message });
          } else {
            results.push({ user_id: profile.id, status: "queued" });
          }
        }

        return Response.json({
          ok: true,
          processed: results.length,
          results,
        });
      },
    },
  },
});
