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
  const normalizedEmail = email.trim().toLowerCase();
  const { data: suppressed, error: suppressionError } = await supabaseAdmin
    .from("suppressed_emails").select("id").eq("email", normalizedEmail).limit(1).maybeSingle();
  if (suppressionError) throw new Error("E-Mail-Versand konnte nicht geprüft werden.");
  if (suppressed) throw new Error("Diese E-Mail-Adresse ist für den Versand gesperrt.");

  const { data: existingUnsubscribe, error: lookupError } = await supabaseAdmin
    .from("email_unsubscribe_tokens").select("token, used_at").eq("email", normalizedEmail).maybeSingle();
  if (lookupError) throw new Error("E-Mail konnte nicht vorbereitet werden.");
  if (existingUnsubscribe?.used_at) throw new Error("Diese E-Mail-Adresse hat sich vom Versand abgemeldet.");
  let unsubscribeToken = existingUnsubscribe?.token;
  if (!unsubscribeToken) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const candidate = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { error: insertError } = await supabaseAdmin.from("email_unsubscribe_tokens")
      .upsert({ token: candidate, email: normalizedEmail }, { onConflict: "email", ignoreDuplicates: true });
    if (insertError) throw new Error("E-Mail konnte nicht vorbereitet werden.");
    const { data: stored, error: readError } = await supabaseAdmin.from("email_unsubscribe_tokens")
      .select("token, used_at").eq("email", normalizedEmail).maybeSingle();
    if (readError || !stored?.token || stored.used_at) throw new Error("E-Mail konnte nicht vorbereitet werden.");
    unsubscribeToken = stored.token;
  }
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
  const { error: logError } = await supabaseAdmin.from("email_send_log").insert({ message_id: messageId, template_name: "account-setup", recipient_email: normalizedEmail, status: "pending" } as any);
  if (logError) throw new Error("E-Mail-Versand konnte nicht vorgemerkt werden.");
  const { error } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId, to: normalizedEmail, from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN, subject, html, text, purpose: "transactional",
      label: "account-setup", idempotency_key: messageId, unsubscribe_token: unsubscribeToken, queued_at: new Date().toISOString(),
    },
  } as any);
  if (error) throw new Error(error.message);
}
