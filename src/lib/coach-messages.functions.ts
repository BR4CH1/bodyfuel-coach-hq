import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CoachMessage = {
  id: string;
  thread_user_id: string;
  sender_id: string;
  from_coach: boolean;
  body: string;
  broadcast_id: string | null;
  created_at: string;
  read_by_coach_at: string | null;
  read_by_client_at: string | null;
};

export type InboxThread = {
  user_id: string;
  display_name: string | null;
  nickname: string | null;
  last_body: string;
  last_at: string;
  last_from_coach: boolean;
  unread_count: number;
};

async function assertCoach(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "coach",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nicht autorisiert");
}

// === Client: send to coach ===
export const sendMessageToCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { body: string }) => d)
  .handler(async ({ data, context }) => {
    const body = (data.body ?? "").trim();
    if (!body) throw new Error("Nachricht darf nicht leer sein");
    if (body.length > 4000) throw new Error("Nachricht zu lang (max. 4000 Zeichen)");

    const { error } = await context.supabase.from("coach_messages").insert({
      thread_user_id: context.userId,
      sender_id: context.userId,
      from_coach: false,
      body,
    });
    if (error) throw new Error(error.message);

    // Push is best-effort and must never make a stored message appear failed.
    try {
      const { getPushActorName, notifyEnabledCoaches } = await import("@/lib/coach-push.server");
      const name = await getPushActorName(context.userId);
      await notifyEnabledCoaches({
        title: "Neue Kundennachricht",
        body: `${name} hat dir eine neue Nachricht geschickt.`,
        url: "/coach",
        tag: `message-${context.userId}-${Date.now()}`,
      });
    } catch (pushError) {
      console.warn("[coach-push] message notification failed", pushError);
    }
    return { ok: true };
  });

// === Client: get own thread ===
export const getMyThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("coach_messages")
      .select("*")
      .eq("thread_user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as CoachMessage[];
  });

// === Client: mark thread read ===
export const markMyThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("coach_messages")
      .update({ read_by_client_at: new Date().toISOString() })
      .eq("thread_user_id", context.userId)
      .eq("from_coach", true)
      .is("read_by_client_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// === Client: unread count from coach ===
export const getMyUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("coach_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_user_id", context.userId)
      .eq("from_coach", true)
      .is("read_by_client_at", null);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

// === Coach: send to single client ===
export const sendMessageToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; body: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    const body = (data.body ?? "").trim();
    if (!body) throw new Error("Nachricht darf nicht leer sein");
    if (body.length > 4000) throw new Error("Nachricht zu lang");

    const { error } = await context.supabase.from("coach_messages").insert({
      thread_user_id: data.userId,
      sender_id: context.userId,
      from_coach: true,
      body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// === Coach: broadcast to all clients (clients + free) ===
export const broadcastFromCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { body: string; audience?: "all" | "client" | "free" }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    const body = (data.body ?? "").trim();
    if (!body) throw new Error("Nachricht darf nicht leer sein");
    if (body.length > 4000) throw new Error("Nachricht zu lang");

    const audience = data.audience ?? "all";
    const roles: ("client" | "free")[] =
      audience === "all" ? ["client", "free"] : audience === "free" ? ["free"] : ["client"];

    const { data: rows, error: rolesErr } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .in("role", roles);
    if (rolesErr) throw new Error(rolesErr.message);

    const recipients = Array.from(new Set((rows ?? []).map((r: any) => r.user_id))).filter(
      (id) => id !== context.userId,
    );
    if (recipients.length === 0) return { ok: true, sent: 0 };

    const broadcastId = crypto.randomUUID();
    const inserts = recipients.map((uid) => ({
      thread_user_id: uid,
      sender_id: context.userId,
      from_coach: true,
      body,
      broadcast_id: broadcastId,
    }));

    // chunked insert for safety
    const CHUNK = 200;
    for (let i = 0; i < inserts.length; i += CHUNK) {
      const slice = inserts.slice(i, i + CHUNK);
      const { error } = await context.supabase.from("coach_messages").insert(slice);
      if (error) throw new Error(error.message);
    }

    return { ok: true, sent: recipients.length, broadcast_id: broadcastId };
  });

// === Coach: inbox (latest message per client, with unread counts) ===
export const getCoachInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context);

    const { data: msgs, error } = await context.supabase
      .from("coach_messages")
      .select("thread_user_id, from_coach, body, created_at, read_by_coach_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const byThread = new Map<string, { last: any; unread: number }>();
    for (const m of (msgs ?? []) as any[]) {
      const cur = byThread.get(m.thread_user_id);
      if (!cur) {
        byThread.set(m.thread_user_id, {
          last: m,
          unread: !m.from_coach && !m.read_by_coach_at ? 1 : 0,
        });
      } else {
        if (!m.from_coach && !m.read_by_coach_at) cur.unread += 1;
      }
    }

    const userIds = Array.from(byThread.keys());
    if (userIds.length === 0) return [] as InboxThread[];

    const { data: profs } = await context.supabase
      .from("profiles")
      .select("id, display_name, nickname")
      .in("id", userIds);

    const profMap = new Map<string, any>();
    for (const p of (profs ?? []) as any[]) profMap.set(p.id, p);

    const out: InboxThread[] = userIds.map((uid) => {
      const t = byThread.get(uid)!;
      const p = profMap.get(uid);
      return {
        user_id: uid,
        display_name: p?.display_name ?? null,
        nickname: p?.nickname ?? null,
        last_body: t.last.body,
        last_at: t.last.created_at,
        last_from_coach: t.last.from_coach,
        unread_count: t.unread,
      };
    });

    out.sort((a, b) => {
      if (a.unread_count !== b.unread_count) return b.unread_count - a.unread_count;
      return new Date(b.last_at).getTime() - new Date(a.last_at).getTime();
    });

    return out;
  });

// === Coach: get one thread ===
export const getThreadForClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    const { data: msgs, error } = await context.supabase
      .from("coach_messages")
      .select("*")
      .eq("thread_user_id", data.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (msgs ?? []) as CoachMessage[];
  });

// === Coach: mark thread read ===
export const markThreadReadByCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context);
    const { error } = await context.supabase
      .from("coach_messages")
      .update({ read_by_coach_at: new Date().toISOString() })
      .eq("thread_user_id", data.userId)
      .eq("from_coach", false)
      .is("read_by_coach_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
