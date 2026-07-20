import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";

async function assertCoach(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
  if (!data) throw new Error("Forbidden");
}

/** Listet alle Kunden, mit denen ein Kunde gekoppelt werden könnte (alle anderen Kunden des Coaches). */
export const listLinkablePartners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "client");
    const clientIds = (roles ?? []).map((r: any) => r.user_id).filter((id: string) => id !== data.user_id);
    if (!clientIds.length) return [];

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", clientIds);

    // Exclude users that already have a partner.
    const { data: existing } = await supabaseAdmin
      .from("nutrition_partners")
      .select("user_a, user_b");
    const taken = new Set<string>();
    for (const p of existing ?? []) {
      taken.add(p.user_a);
      taken.add(p.user_b);
    }

    return (profs ?? [])
      .filter((p: any) => !taken.has(p.id))
      .map((p: any) => ({ id: p.id, name: p.display_name ?? "Unbenannt" }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name, "de"));
  });

/** Lädt die aktuelle Kopplung eines Kunden (falls vorhanden). */
export const getPartnerLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    if (data.user_id !== context.userId) {
      await assertCoachOrOrgStaffForAthlete(context, data.user_id, "nutrition");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: link } = await supabaseAdmin
      .from("nutrition_partners")
      .select("id, user_a, user_b")
      .or(`user_a.eq.${data.user_id},user_b.eq.${data.user_id}`)
      .maybeSingle();
    if (!link) return null;

    const partnerId = (link.user_a === data.user_id ? link.user_b : link.user_a) as string;
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .eq("id", partnerId)
      .maybeSingle();
    return { id: link.id, partner_id: partnerId, partner_name: prof?.display_name ?? "Partner" };
  });

/** Koppelt zwei Kunden — entfernt vorher bestehende Kopplungen beider. */
export const linkPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_a: string; user_b: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    if (data.user_a === data.user_b) throw new Error("Partner muss eine andere Person sein.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Remove any existing partner link involving either user.
    await supabaseAdmin
      .from("nutrition_partners")
      .delete()
      .or(`user_a.eq.${data.user_a},user_b.eq.${data.user_a},user_a.eq.${data.user_b},user_b.eq.${data.user_b}`);

    const { data: row, error } = await supabaseAdmin
      .from("nutrition_partners")
      .insert({ user_a: data.user_a, user_b: data.user_b, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const unlinkPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCoach(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("nutrition_partners")
      .delete()
      .or(`user_a.eq.${data.user_id},user_b.eq.${data.user_id}`);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
