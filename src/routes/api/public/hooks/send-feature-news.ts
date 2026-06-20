import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { render } from "@react-email/components";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { verifyCronAuth } from "@/lib/cron-auth.server";

const SITE_NAME = "BodyFuel";
const SENDER_DOMAIN = "notify.bodyfuel-coaching.com";
const FROM_DOMAIN = "bodyfuel-coaching.com";
const DEFAULT_TEMPLATE = "feature-news-june";
const DEFAULT_LABEL = "feature-news-june";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Recipient {
  user_id: string | null;
  email: string;
  first_name: string;
}

export const Route = createFileRoute("/api/public/hooks/send-feature-news")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = verifyCronAuth(request);
        if (!auth.ok) return auth.response;

        let body: any = {};
        try {
          body = await request.json();
        } catch {
          // empty body OK
        }

        const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ error: "Server config error" }, { status: 500 });
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const effectiveTemplate = body.template_name || DEFAULT_TEMPLATE;
        const effectiveLabel = body.label || DEFAULT_LABEL;
        const template = TEMPLATES[effectiveTemplate];
        if (!template) {
          return Response.json({ error: "Template missing" }, { status: 500 });
        }

        const recipients: Recipient[] = [];

        // Mode 1: explicit test recipients
        if (Array.isArray(body.test_emails) && body.test_emails.length > 0) {
          for (const entry of body.test_emails) {
            if (typeof entry === "string") {
              recipients.push({ user_id: null, email: entry, first_name: "" });
            } else if (entry && typeof entry === "object") {
              recipients.push({
                user_id: null,
                email: String(entry.email),
                first_name: String(entry.first_name ?? ""),
              });
            }
          }
        }

        // Mode 2: all active members
        if (body.send_to_all_active === true) {
          // Active = active customer_packages OR profiles.trial_status='active'
          const userIds = new Set<string>();

          const { data: pkgs } = await supabase
            .from("customer_packages")
            .select("user_id")
            .eq("is_active", true);
          pkgs?.forEach((r: any) => r.user_id && userIds.add(r.user_id));

          const { data: actProfiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("trial_status", "active");
          actProfiles?.forEach((r: any) => r.id && userIds.add(r.id));

          const ids = Array.from(userIds);
          if (ids.length > 0) {
            const { data: profs } = await supabase
              .from("profiles")
              .select("id, display_name")
              .in("id", ids);
            const nameById = new Map<string, string>();
            profs?.forEach((p: any) =>
              nameById.set(p.id, (p.display_name ?? "").split(" ")[0] ?? "")
            );

            for (const id of ids) {
              const { data: u } = await supabase.auth.admin.getUserById(id);
              const email = u?.user?.email;
              if (!email) continue;
              recipients.push({
                user_id: id,
                email,
                first_name: nameById.get(id) ?? "",
              });
            }
          }
        }

        if (recipients.length === 0) {
          return Response.json({
            error:
              "No recipients. Provide { test_emails: [...] } or { send_to_all_active: true }",
          }, { status: 400 });
        }

        const results: Array<{ email: string; status: string; reason?: string }> = [];
        const dateTag = new Date().toISOString().slice(0, 10);

        for (const r of recipients) {
          const normalized = r.email.toLowerCase();
          const idempotencyKey = `${LABEL}:${dateTag}:${normalized}`;

          // Duplikat-Schutz
          const { data: existing } = await supabase
            .from("email_send_log")
            .select("id")
            .eq("template_name", TEMPLATE_NAME)
            .eq("recipient_email", normalized)
            .eq("message_id", idempotencyKey)
            .maybeSingle();
          if (existing) {
            results.push({ email: normalized, status: "duplicate" });
            continue;
          }

          // Suppression-Check
          const { data: supp } = await supabase
            .from("suppressed_emails")
            .select("email")
            .eq("email", normalized)
            .maybeSingle();
          if (supp) {
            results.push({ email: normalized, status: "suppressed" });
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
            name: r.first_name,
            siteName: SITE_NAME,
          };

          const element = React.createElement(template.component, data);
          const html = await render(element);
          const text = await render(element, { plainText: true });
          const subject =
            typeof template.subject === "function" ? template.subject(data) : template.subject;

          await supabase.from("email_send_log").insert({
            message_id: idempotencyKey,
            template_name: TEMPLATE_NAME,
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
              label: LABEL,
              idempotency_key: idempotencyKey,
              unsubscribe_token: unsubscribeToken,
              queued_at: new Date().toISOString(),
            },
          });

          if (enqErr) {
            results.push({ email: normalized, status: "error", reason: enqErr.message });
          } else {
            results.push({ email: normalized, status: "queued" });
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
