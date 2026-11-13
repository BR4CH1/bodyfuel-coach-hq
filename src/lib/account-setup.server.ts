import * as React from "react";
import { render } from "@react-email/components";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "BODYFUEL";
const SENDER_DOMAIN = "notify.bodyfuel-coaching.com";
const FROM_DOMAIN = "bodyfuel-coaching.com";
const APP_URL = "https://bodyfuel-coaching.com";

/** Erzeugt (oder nutzt) einen dauerhaft gültigen Einrichtungslink und verschickt ihn. */
export async function sendAccountSetupEmail(userId: string, email: string, firstName?: string, next = "/welcome") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("account_setup_tokens").select("token").eq("user_id", userId).maybeSingle();
  let token = (existing as any)?.token as string | undefined;
  if (!token) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabaseAdmin.from("account_setup_tokens").insert({ token, user_id: userId, email } as any);
    if (error) throw new Error(error.message);
  }
  const tpl = TEMPLATES["account-setup"];
  const payload = { firstName, setupUrl: `${APP_URL}/zugang/${token}${next !== "/welcome" ? `?next=${encodeURIComponent(next)}` : ""}` };
  const element = React.createElement(tpl.component, payload);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = typeof tpl.subject === "function" ? tpl.subject(payload) : tpl.subject;
  const messageId = `account-setup:${userId}:${Date.now()}`;
  await supabaseAdmin.from("email_send_log").insert({ message_id: messageId, template_name: "account-setup", recipient_email: email, status: "pending" } as any);
  const { error } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId, to: email, from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN, subject, html, text, purpose: "transactional",
      label: "account-setup", idempotency_key: messageId, queued_at: new Date().toISOString(),
    },
  } as any);
  if (error) throw new Error(error.message);
}
