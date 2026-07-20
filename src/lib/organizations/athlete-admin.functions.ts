import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Delete a user completely from the platform. Callable by:
 *  - platform coach (user_roles.role = 'coach'), OR
 *  - organization admin of the org the target user belongs to.
 *
 * Removes profile + auth user. FK cascades handle the rest.
 */
export const deleteOrgAthlete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { org_id: string; user_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) {
      throw new Error("Du kannst dein eigenes Konto nicht hier löschen.");
    }

    // Authorize: platform coach OR org admin of this org
    const [{ data: isCoach }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
      supabase.rpc("is_org_admin", { _user: userId, _org: data.org_id }),
    ]);
    if (!isCoach && !isAdmin) {
      throw new Error("Keine Berechtigung, dieses Profil zu löschen.");
    }

    // Confirm target is a member of this org (defense-in-depth for org admins)
    if (!isCoach) {
      const { data: mem } = await supabase
        .from("organization_memberships")
        .select("id")
        .eq("organization_id", data.org_id)
        .eq("user_id", data.user_id)
        .maybeSingle();
      if (!mem) throw new Error("Athlet gehört nicht zu diesem Verein.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Best-effort clean-up of tables that may not cascade
    await supabaseAdmin.from("payment_history").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("customer_packages").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("staff_assignments").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("organization_memberships").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Remove an athlete from a specific organization (team membership only).
 * Does NOT delete the user's profile, auth account, or global data.
 * Removes: organization_memberships (this org), staff_assignments (this org).
 */
export const removeAthleteFromOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { org_id: string; user_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) {
      throw new Error("Du kannst dich nicht selbst aus dem Team entfernen.");
    }

    const [{ data: isCoach }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
      supabase.rpc("is_org_admin", { _user: userId, _org: data.org_id }),
    ]);
    if (!isCoach && !isAdmin) {
      throw new Error("Keine Berechtigung, Spieler aus diesem Team zu entfernen.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("staff_assignments")
      .delete()
      .eq("organization_id", data.org_id)
      .eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("organization_memberships")
      .delete()
      .eq("organization_id", data.org_id)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
