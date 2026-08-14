import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CoachPushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string | null;
};

async function assertCoach(ctx: { supabase: any; userId: string }) {
  const { BODYFUEL_OWNER_USER_ID } = await import("@/lib/coach-push.server");
  if (ctx.userId !== BODYFUEL_OWNER_USER_ID) throw new Error("Nicht autorisiert");

  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "coach",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nicht autorisiert");
}

export const getCoachPushConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context);
    const { COACH_PUSH_VAPID_PUBLIC_KEY, isCoachPushConfigured } =
      await import("@/lib/coach-push.server");
    return {
      publicKey: COACH_PUSH_VAPID_PUBLIC_KEY,
      configured: isCoachPushConfigured(),
    };
  });

export const saveMyCoachPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CoachPushSubscriptionInput) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    const { saveCoachPushSubscription } = await import("@/lib/coach-push.server");
    await saveCoachPushSubscription(context.userId, data);
    return { ok: true };
  });

export const removeMyCoachPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { endpoint: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    const { removeCoachPushSubscription } = await import("@/lib/coach-push.server");
    await removeCoachPushSubscription(context.userId, data.endpoint);
    return { ok: true };
  });

export const sendMyCoachPushTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context);
    const { isCoachPushConfigured, sendCoachPushToUser } = await import("@/lib/coach-push.server");
    if (!isCoachPushConfigured()) throw new Error("Push ist serverseitig noch nicht konfiguriert");
    const result = await sendCoachPushToUser(context.userId, {
      title: "BodyFuel Coach 🔔",
      body: "Push funktioniert. Neue Coaching-Ereignisse können dich jetzt direkt erreichen.",
      url: "/coach",
      tag: "coach-push-test",
    });
    if (result.sent === 0) throw new Error("Keine aktive Push-Subscription gefunden");
    return { ok: true, ...result };
  });

export const notifyCoachCheckinSubmitted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { weekStart: string }) => data)
  .handler(async ({ data, context }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.weekStart)) return { ok: false };

    // Verify the claimed event belongs to the authenticated user. The client
    // only supplies the week identifier, never a user id or notification text.
    const { data: checkin, error: checkinError } = await context.supabase
      .from("weekly_checkins")
      .select("id")
      .eq("user_id", context.userId)
      .eq("week_start", data.weekStart)
      .maybeSingle();
    if (checkinError || !checkin) return { ok: false };

    // Keep delivery best-effort: a Push outage must not break a successfully stored check-in.
    try {
      const { claimCoachPushEvent, getPushActorName, isCoachPushConfigured, notifyEnabledCoaches } =
        await import("@/lib/coach-push.server");
      if (!isCoachPushConfigured()) return { ok: true };
      const claimed = await claimCoachPushEvent(`checkin:${context.userId}:${checkin.id}`);
      if (!claimed) return { ok: true };

      const name = await getPushActorName(context.userId);
      await notifyEnabledCoaches({
        title: "Neuer Check-in",
        body: `${name} hat einen neuen Wochen-Check-in eingereicht.`,
        url: "/coach",
        tag: `checkin-${checkin.id}`,
      });
    } catch (error) {
      console.warn("[coach-push] check-in notification failed", error);
    }
    return { ok: true };
  });
