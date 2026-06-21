import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listFreeUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    if (!isCoach) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "free");
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return [];

    const [profilesRes, pointsRes, eventsRes, usersRes, groupsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, display_name, nickname, created_at").in("id", ids),
      supabaseAdmin.from("user_points").select("user_id, total_points, level, current_streak, last_check_date").in("user_id", ids),
      supabaseAdmin.from("free_user_events").select("user_id, event, created_at").in("user_id", ids).order("created_at", { ascending: false }),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("user_groups").select("user_id, group_name").in("user_id", ids),
    ]);

    const pointsByUser = new Map<string, any>();
    (pointsRes.data ?? []).forEach((p: any) => pointsByUser.set(p.user_id, p));
    const lastEventByUser = new Map<string, any>();
    (eventsRes.data ?? []).forEach((e: any) => {
      if (!lastEventByUser.has(e.user_id)) lastEventByUser.set(e.user_id, e);
    });
    const upgradeClickedByUser = new Set(
      (eventsRes.data ?? []).filter((e: any) => e.event === "upgrade_clicked").map((e: any) => e.user_id),
    );
    const profileById = new Map<string, any>();
    (profilesRes.data ?? []).forEach((p: any) => profileById.set(p.id, p));
    const emailMap = new Map(usersRes.data.users.map((u: any) => [u.id, u.email]));
    const groupsByUser = new Map<string, string[]>();
    for (const g of groupsRes.data ?? []) {
      const a = groupsByUser.get(g.user_id) ?? [];
      a.push(g.group_name);
      groupsByUser.set(g.user_id, a);
    }
    const emailList = [...emailMap.values()].filter(Boolean) as string[];
    const { data: suppressed } = emailList.length
      ? await supabaseAdmin
          .from("suppressed_emails")
          .select("email")
          .in("email", emailList.map((e) => e.toLowerCase()))
      : { data: [] as { email: string }[] };
    const suppressedSet = new Set((suppressed ?? []).map((s: any) => s.email.toLowerCase()));

    return ids.map((id) => {
      const p = pointsByUser.get(id);
      const pr = profileById.get(id);
      const email = emailMap.get(id) ?? null;
      return {
        user_id: id,
        display_name: pr?.display_name ?? null,
        nickname: pr?.nickname ?? null,
        email,
        email_subscribed: email ? !suppressedSet.has(email.toLowerCase()) : true,
        groups: groupsByUser.get(id) ?? [],
        signup_at: pr?.created_at ?? null,
        total_points: p?.total_points ?? 0,
        level: p?.level ?? 1,
        streak: p?.current_streak ?? 0,
        last_check_date: p?.last_check_date ?? null,
        last_event_at: lastEventByUser.get(id)?.created_at ?? null,
        upgrade_clicked: upgradeClickedByUser.has(id),
      };
    });
  });
