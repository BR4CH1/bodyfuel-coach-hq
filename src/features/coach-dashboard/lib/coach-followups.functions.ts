import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const FROM_ADDRESS = "Manuel | BodyFuel <manuel@bodyfuel-coaching.com>";
const REPLY_TO = "manuel@bodyfuel-coaching.com";
const TASK_PREFIX = "fuely-followup:";

const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("customer"), userId: z.string().uuid() }),
  z.object({ kind: z.literal("lead"), leadId: z.string().uuid() }),
]);

const inputSchema = z.object({
  sourceSignalId: z.string().trim().min(1).max(220),
  target: targetSchema,
  channel: z.enum(["message", "email", "both"]),
  body: z.string().trim().min(1).max(4000),
  subject: z.string().trim().min(1).max(160),
});

const actionSchema = z.object({
  sourceSignalId: z.string().trim().min(1).max(220),
  status: z.enum(["snoozed", "completed", "dismissed"]),
  until: z.string().datetime().optional(),
  reason: z.string().trim().max(500).optional(),
  completedAt: z.string().datetime().optional(),
  deliveryChannel: z.enum(["message", "email", "both", "manual"]).optional(),
});

export type CoachFollowUpAction = z.infer<typeof actionSchema>;

async function assertCoach(ctx: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "coach",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nicht autorisiert");
}

function taskKey(sourceSignalId: string) {
  return `${TASK_PREFIX}${sourceSignalId}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function saveAction(
  supabase: SupabaseClient<Database>,
  coachId: string,
  action: CoachFollowUpAction,
) {
  const completedAt =
    action.status === "completed" || action.status === "dismissed"
      ? (action.completedAt ?? new Date().toISOString())
      : null;
  const snoozedUntil = action.status === "snoozed" ? (action.until ?? null) : null;
  const note = JSON.stringify({
    kind: "fuely-followup",
    status: action.status,
    reason: action.reason ?? null,
    deliveryChannel: action.deliveryChannel ?? null,
    completedAt,
  });

  const { error } = await supabase.from("coach_task_state").upsert(
    {
      coach_id: coachId,
      task_key: taskKey(action.sourceSignalId),
      completed_at: completedAt,
      snoozed_until: snoozedUntil,
      note,
    },
    { onConflict: "coach_id,task_key" },
  );
  if (error) throw new Error(error.message);
}

function parseAction(row: {
  task_key: string;
  completed_at: string | null;
  snoozed_until: string | null;
  note: string | null;
}): CoachFollowUpAction | null {
  const sourceSignalId = row.task_key.slice(TASK_PREFIX.length);
  if (!sourceSignalId) return null;
  let metadata: {
    status?: CoachFollowUpAction["status"];
    reason?: string | null;
    deliveryChannel?: CoachFollowUpAction["deliveryChannel"] | null;
    completedAt?: string | null;
  } = {};
  try {
    metadata = row.note ? JSON.parse(row.note) : {};
  } catch {
    metadata = {};
  }

  const status =
    metadata.status ?? (row.snoozed_until ? "snoozed" : row.completed_at ? "completed" : null);
  if (!status) return null;

  return {
    sourceSignalId,
    status,
    ...(row.snoozed_until ? { until: row.snoozed_until } : {}),
    ...(metadata.reason ? { reason: metadata.reason } : {}),
    ...(metadata.deliveryChannel ? { deliveryChannel: metadata.deliveryChannel } : {}),
    ...(row.completed_at || metadata.completedAt
      ? { completedAt: row.completed_at ?? metadata.completedAt ?? undefined }
      : {}),
  };
}

export const listCoachFollowUpActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context);
    const { data, error } = await context.supabase
      .from("coach_task_state")
      .select("task_key, completed_at, snoozed_until, note")
      .eq("coach_id", context.userId)
      .like("task_key", `${TASK_PREFIX}%`);
    if (error) throw new Error(error.message);
    return {
      items: (data ?? [])
        .map(parseAction)
        .filter((item): item is CoachFollowUpAction => Boolean(item)),
    };
  });

export const saveCoachFollowUpAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => actionSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    await saveAction(context.supabase, context.userId, data);
    return { ok: true };
  });

async function resolveRecipientEmail(target: z.infer<typeof targetSchema>): Promise<string> {
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

async function sendEmailNow(input: {
  coachId: string;
  sourceSignalId: string;
  target: z.infer<typeof targetSchema>;
  subject: string;
  body: string;
}) {
  const to = await resolveRecipientEmail(input.target);
  const messageId = `coach-followup:${input.coachId}:${input.sourceSignalId}`;

  const request = getRequest();
  const authHeader = request?.headers.get("authorization");
  if (!authHeader) throw new Error("Sitzung abgelaufen — bitte neu anmelden.");

  const origin =
    request?.headers.get("origin") ??
    (() => {
      const host = request?.headers.get("host");
      const proto = request?.headers.get("x-forwarded-proto") ?? "https";
      return host ? `${proto}://${host}` : "https://bodyfuel-coaching.com";
    })();

  const response = await fetch(`${origin}/lovable/email/transactional/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      templateName: "coach-followup",
      recipientEmail: to,
      idempotencyKey: messageId,
      templateData: {
        subject: input.subject,
        body: input.body,
        coachName: "Manuel | BodyFuel",
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; reason?: string; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      `E-Mail konnte nicht versendet werden: ${payload?.error ?? `HTTP ${response.status}`}`,
    );
  }
  if (payload?.success === false) {
    throw new Error(
      payload.reason === "email_suppressed"
        ? "Diese E-Mail-Adresse ist für den Versand gesperrt."
        : `E-Mail konnte nicht versendet werden: ${payload.reason ?? "unbekannter Fehler"}`,
    );
  }

  return { sent: true, messageId };
}


export const sendCoachFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertCoach(context);

    const shouldSendMessage = data.channel === "message" || data.channel === "both";
    const shouldSendEmail = data.channel === "email" || data.channel === "both";

    // The external delivery uses a deterministic idempotency key. It is sent
    // before the in-app message so a mail failure never produces a false
    // "both sent" state.
    if (shouldSendEmail) {
      await sendEmailNow({
        coachId: context.userId,
        sourceSignalId: data.sourceSignalId,
        target: data.target,
        subject: data.subject,
        body: data.body,
      });
    }

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

    // Persist completion on the server before returning success. If the phone
    // locks after delivery, the follow-up still remains completed everywhere.
    await saveAction(context.supabase, context.userId, {
      sourceSignalId: data.sourceSignalId,
      status: "completed",
      completedAt: new Date().toISOString(),
      deliveryChannel: data.channel,
    });

    return { ok: true, channel: data.channel, emailSent: shouldSendEmail };
  });
