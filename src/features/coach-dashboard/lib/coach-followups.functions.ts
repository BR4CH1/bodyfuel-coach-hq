import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const SITE_NAME = "BODYFUEL";
const SENDER_DOMAIN = "notify.bodyfuel-coaching.com";
const FROM_DOMAIN = "bodyfuel-coaching.com";

const inputSchema = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("customer"), userId: z.string().uuid() }),
    z.object({ kind: z.literal("lead"), leadId: z.string().uuid() }),
  ]),
  channel: z.enum(["message", "email", "both"]),
  body: z.string().trim().min(1).max(4000),
  subject: z.string().trim().min(1).max(160),
});

async function assertCoach(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "coach",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nicht autorisiert");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function resolveRecipientEmail(
  target: z.infer<typeof inputSchema>["target"],
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (target.kind === "lead") {
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("email")
      .eq("id", target.leadId)
      .single();
    if (error || !data?.email) throw new Error("Für diese Anfrage wurde keine E-Mail gefunden.");
    return data.email.trim().toLowerCase();
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(target.userId);
  if (error || !data.user?.email) throw new Error("Für diesen Kunden wurde keine E-Mail gefunden.");
  return data.user.email.trim().toLowerCase();
}

async function queueEmail(input: {
  target: z.infer<typeof inputSchema>["target"];
  subject: string;
  body: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const to = await resolveRecipientEmail(input.target);
  const messageId = `coach-followup:${crypto.randomUUID()}`;
  const htmlBody = escapeHtml(input.body).replaceAll("\n", "<br />");
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111"><p>${htmlBody}</p><p style="margin-top:24px;color:#666;font-size:12px">Gesendet über ${SITE_NAME}</p></div>`;

  const { error: logError } = await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: "coach-followup",
    recipient_email: to,
    status: "pending",
  });
  if (logError) throw new Error(logError.message);

  const { error } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: input.subject,
      html,
      text: input.body,
      purpose: "transactional",
      label: "coach-followup",
      idempotency_key: messageId,
      queued_at: new Date().toISOString(),
    },
  });
  if (error) throw new Error(error.message);
}

export const sendCoachFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertCoach(context);

    const shouldSendMessage = data.channel === "message" || data.channel === "both";
    const shouldSendEmail = data.channel === "email" || data.channel === "both";

    if (shouldSendMessage) {
      if (data.target.kind !== "customer") {
        throw new Error("Eine In-App-Nachricht ist nur für bestehende Kunden möglich.");
      }
      const { error } = await context.supabase.from("coach_messages").insert({
        thread_user_id: data.target.userId,
        sender_id: context.userId,
        from_coach: true,
        body: data.body,
      });
      if (error) throw new Error(error.message);
    }

    if (shouldSendEmail) {
      await queueEmail({ target: data.target, subject: data.subject, body: data.body });
    }

    return { ok: true, channel: data.channel };
  });
