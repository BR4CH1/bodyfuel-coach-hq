import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GroupName = "bulls" | "running_team" | "sgz" | "premium";

async function assertCoach(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const listUserGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_groups")
      .select("group_name")
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => r.group_name as GroupName);
  });

export const setUserGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; group: GroupName; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("user_groups")
        .upsert(
          { user_id: data.user_id, group_name: data.group },
          { onConflict: "user_id,group_name" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_groups")
        .delete()
        .eq("user_id", data.user_id)
        .eq("group_name", data.group);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listAllManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [usersRes, profilesRes, groupsRes, packagesRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id, display_name"),
      supabaseAdmin.from("user_groups").select("user_id, group_name"),
      supabaseAdmin.from("customer_packages").select("user_id, is_active, end_date"),
    ]);
    const profMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p.display_name]));
    const groupMap = new Map<string, string[]>();
    for (const g of groupsRes.data ?? []) {
      const a = groupMap.get(g.user_id) ?? [];
      a.push(g.group_name);
      groupMap.set(g.user_id, a);
    }
    const pkgMap = new Map<string, { active: boolean }>();
    for (const p of packagesRes.data ?? []) {
      const cur = pkgMap.get(p.user_id);
      const active = !!p.is_active && new Date(p.end_date).getTime() >= Date.now();
      if (!cur || active) pkgMap.set(p.user_id, { active });
    }
    return usersRes.data.users.map((u) => ({
      user_id: u.id,
      email: u.email ?? null,
      display_name: profMap.get(u.id) ?? null,
      groups: groupMap.get(u.id) ?? [],
      coaching_active: !!pkgMap.get(u.id)?.active,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }));
  });
