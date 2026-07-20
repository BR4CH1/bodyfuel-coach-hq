import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isGlobalCoach } from "@/lib/organizations/org-coach-access";

/**
 * Kursleiter-Status ist pro Organisations-Mitgliedschaft freigeschaltet.
 * Der Status macht ein bestehendes Mitglied zusätzlich zum Kursleiter
 * (Zugang zu /coach-tools). Er verleiht KEINE Coach-Ansicht — dafür muss der
 * Nutzer separat zum Staff der Organisation hinzugefügt werden.
 */

async function assertCanManageMembers(
  ctx: { supabase: any; userId: string },
  orgId: string,
) {
  if (await isGlobalCoach(ctx.supabase, ctx.userId)) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: mem }, { data: staff }] = await Promise.all([
    supabaseAdmin
      .from("organization_memberships")
      .select("role, status")
      .eq("user_id", ctx.userId)
      .eq("organization_id", orgId)
      .maybeSingle(),
    supabaseAdmin
      .from("staff_assignments")
      .select("role, permissions")
      .eq("user_id", ctx.userId)
      .eq("organization_id", orgId),
  ]);
  const isAdmin =
    (mem as any)?.status === "active" &&
    (mem as any)?.role === "organization_admin";
  if (isAdmin) return;
  const canStaff = ((staff ?? []) as any[]).some((s) => {
    if (s.role === "organization_admin" || s.role === "head_coach") return true;
    const perms = (s.permissions ?? []) as string[];
    return perms.includes("manage_members") || perms.includes("manage_organization");
  });
  if (canStaff) return;
  throw new Error("Keine Berechtigung, Kursleiter in dieser Organisation zu verwalten.");
}

export const getMemberCourseInstructor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ orgId: z.string().uuid(), userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.userId !== context.userId) {
      await assertCanManageMembers(context, data.orgId);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("organization_memberships")
      .select("is_course_instructor")
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId)
      .maybeSingle();
    return { enabled: !!(row as any)?.is_course_instructor };
  });

export const setMemberCourseInstructor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orgId: z.string().uuid(),
        userId: z.string().uuid(),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageMembers(context, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("organization_memberships")
      .update({ is_course_instructor: data.enabled } as any)
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true, enabled: data.enabled };
  });

/**
 * Gibt die Organisations-IDs zurück, in denen der eingeloggte Nutzer als
 * Kursleiter freigeschaltet ist. Wird von der Navigation genutzt, um den
 * Coach-Tools-Menüpunkt einzublenden.
 */
export const listMyCourseInstructorOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("organization_memberships")
      .select("organization_id, organization:organizations!inner(slug, status)")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .eq("is_course_instructor", true);
    const rows = ((data ?? []) as any[]).filter((r) => r.organization?.status === "active");
    return {
      orgIds: rows
        .map((r) => r.organization_id as string)
        .filter(Boolean),
      orgSlugs: rows
        .map((r) => r.organization?.slug as string | undefined)
        .filter(Boolean),
    };
  });
