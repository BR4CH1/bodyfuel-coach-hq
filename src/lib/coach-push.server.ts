import webpush from "web-push";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const COACH_PUSH_VAPID_PUBLIC_KEY =
  "BL2dn-Oix8CCCAORreNFxQWDNm2HAcnoBoMVf5qPN8Mbxe_x7Er009dIjOL4J1BNzJIFKvcVg_KNnMwqiSvSdvE";

const VAPID_SUBJECT = "https://bodyfuel-coaching.com";
const MAX_BODY_LENGTH = 220;

type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string | null;
};

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

type StoredSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushError = Error & { statusCode?: number };

function db() {
  // Generated Supabase types do not contain the additive migration until the
  // next type regeneration. Keep the unsafe cast isolated to this server-only module.
  return supabaseAdmin as any;
}

function privateVapidKey(): string | null {
  const value = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  return value || null;
}

export function isCoachPushConfigured(): boolean {
  return Boolean(privateVapidKey());
}

export async function claimCoachPushEvent(eventKey: string): Promise<boolean> {
  if (!eventKey || eventKey.length > 500) return false;
  const { error } = await db().from("coach_push_event_receipts").insert({ event_key: eventKey });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
}

function validateSubscription(input: PushSubscriptionInput) {
  let endpoint: URL;
  try {
    endpoint = new URL(input.endpoint);
  } catch {
    throw new Error("Ungültige Push-Subscription");
  }
  if (endpoint.protocol !== "https:") throw new Error("Ungültige Push-Subscription");
  if (input.endpoint.length > 4096) throw new Error("Push-Endpoint zu lang");
  if (!input.keys?.p256dh || !input.keys?.auth) throw new Error("Push-Schlüssel fehlen");
  if (input.keys.p256dh.length > 512 || input.keys.auth.length > 512) {
    throw new Error("Push-Schlüssel ungültig");
  }
}

export async function saveCoachPushSubscription(
  userId: string,
  input: PushSubscriptionInput,
): Promise<void> {
  validateSubscription(input);
  const { error } = await db()
    .from("coach_push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        user_agent: input.userAgent?.slice(0, 500) || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  if (error) throw new Error(error.message);
}

export async function removeCoachPushSubscription(userId: string, endpoint: string): Promise<void> {
  const { error } = await db()
    .from("coach_push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
}

async function deleteStaleSubscription(id: string) {
  const { error } = await db().from("coach_push_subscriptions").delete().eq("id", id);
  if (error) console.warn("[coach-push] stale subscription cleanup failed", error.message);
}

async function sendToSubscriptions(rows: StoredSubscription[], payload: PushPayload) {
  const privateKey = privateVapidKey();
  if (!privateKey || rows.length === 0) return { sent: 0, failed: 0, stale: 0 };

  const message = JSON.stringify({
    title: payload.title.slice(0, 100),
    body: payload.body.slice(0, MAX_BODY_LENGTH),
    url: payload.url.startsWith("/") ? payload.url : "/coach",
    tag: payload.tag?.slice(0, 80),
  });

  let sent = 0;
  let failed = 0;
  let stale = 0;

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          message,
          {
            TTL: 60 * 60,
            urgency: "high",
            vapidDetails: {
              subject: VAPID_SUBJECT,
              publicKey: COACH_PUSH_VAPID_PUBLIC_KEY,
              privateKey,
            },
          },
        );
        sent += 1;
      } catch (cause) {
        const error = cause as PushError;
        if (error.statusCode === 404 || error.statusCode === 410) {
          stale += 1;
          await deleteStaleSubscription(row.id);
          return;
        }
        failed += 1;
        console.warn("[coach-push] delivery failed", error.statusCode ?? error.message);
      }
    }),
  );

  return { sent, failed, stale };
}

export async function sendCoachPushToUser(userId: string, payload: PushPayload) {
  if (!isCoachPushConfigured()) return { sent: 0, failed: 0, stale: 0 };
  const { data, error } = await db()
    .from("coach_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return sendToSubscriptions((data ?? []) as StoredSubscription[], payload);
}

export async function notifyEnabledCoaches(payload: PushPayload) {
  if (!isCoachPushConfigured()) return { sent: 0, failed: 0, stale: 0 };
  const { data, error } = await db()
    .from("coach_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth");
  if (error) throw new Error(error.message);
  return sendToSubscriptions((data ?? []) as StoredSubscription[], payload);
}

export async function getPushActorName(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("display_name,nickname")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name?.trim() || data?.nickname?.trim() || "Ein Kunde";
}
