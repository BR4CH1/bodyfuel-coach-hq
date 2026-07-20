import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Shareable Team-Beitrittslinks.
 *
 * Coaches/Admins mit Roster-Rechten erzeugen pro Team einen Token. Jeder
 * eingeloggte Nutzer kann diesen Link öffnen, sieht Verein + Team und wird
 * beim Annehmen als aktiver Athlet in Verein & Team eingetragen. Onboarding
 * wird explizit auf offen gesetzt, damit der Player-Flow startet.
 */

// ---------------------------------------------------------------------------
// Permission-Helper (dupliziert bewusst assertCanManageRoster – roster.ts
// exportiert das intern nicht.)
// ---------------------------------------------------------------------------
async function assertCanManage(
  supabase: any,
  userId: string,
  organization_id: string,
  team_id: string | null,
): Promise<void> {
  const { data: isAdmin } = await supabase.rpc("is_org_admin", {
    _user: userId,
    _org: organization_id,
  });
  if (isAdmin) return;

  const { data: sas } = await supabase
    .from("staff_assignments")
    .select("role, permissions, team_id")
    .eq("user_id", userId)
    .eq("organization_id", organization_id);

  const rows = (sas ?? []) as Array<{ role: string; permissions: string[] | null; team_id: string | null }>;
  const ok = rows.some(
    (r) =>
      r.role === "coach" &&
      (
        (r.permissions ?? []).includes("manage_organization") ||
        (
          (r.permissions ?? []).includes("invite_athletes") &&
          (r.team_id === null || r.team_id === team_id)
        )
      ),
  );
  if (!ok) throw new Error("Keine Berechtigung, für dieses Team Beitrittslinks zu verwalten.");
}

// ---------------------------------------------------------------------------
// Create / List / Revoke
// ---------------------------------------------------------------------------

export const createTeamJoinLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { organization_id: string; team_id: string; expires_at?: string | null; max_uses?: number | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId, data.organization_id, data.team_id);

    const token = crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 8);
    const { data: row, error } = await supabase
      .from("team_join_links")
      .insert({
        organization_id: data.organization_id,
        team_id: data.team_id,
        token,
        is_active: true,
        expires_at: data.expires_at || null,
        max_uses: data.max_uses ?? null,
        created_by: userId,
      })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string; token: string };
  });

export const listTeamJoinLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { organization_id: string; team_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId, data.organization_id, data.team_id);
    const { data: rows, error } = await supabase
      .from("team_join_links")
      .select("id, token, is_active, uses_count, max_uses, expires_at, created_at")
      .eq("team_id", data.team_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      token: string;
      is_active: boolean;
      uses_count: number;
      max_uses: number | null;
      expires_at: string | null;
      created_at: string;
    }>;
  });

export const revokeTeamJoinLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; organization_id: string; team_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManage(supabase, userId, data.organization_id, data.team_id);
    const { error } = await supabase
      .from("team_join_links")
      .update({ is_active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Preview + Accept (authenticated user, any signed-in user may follow a link)
// ---------------------------------------------------------------------------

export const getTeamJoinLinkPreview = createServerFn({ method: "GET" })
  .validator((d: { token: string }) => ({ token: String(d.token).trim() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("team_join_links")
      .select("id, organization_id, team_id, is_active, max_uses, uses_count, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!link) return { ok: false as const, reason: "not_found" as const };
    if (!link.is_active) return { ok: false as const, reason: "revoked" as const };
    if (link.expires_at && new Date(link.expires_at) < new Date()) return { ok: false as const, reason: "expired" as const };
    if (link.max_uses != null && link.uses_count >= link.max_uses) return { ok: false as const, reason: "exhausted" as const };

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name, slug, logo_url, primary_color")
      .eq("id", link.organization_id)
      .maybeSingle();
    const { data: team } = await supabaseAdmin
      .from("organization_teams")
      .select("name")
      .eq("id", link.team_id)
      .maybeSingle();

    return {
      ok: true as const,
      organization: {
        id: link.organization_id,
        name: (org as any)?.name ?? "",
        slug: (org as any)?.slug ?? "",
        logo_url: (org as any)?.logo_url ?? null,
        primary_color: (org as any)?.primary_color ?? null,
      },
      team: {
        id: link.team_id,
        name: (team as any)?.name ?? "",
      },
    };
  });

export const acceptTeamJoinLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { token: string }) => ({ token: String(d.token).trim() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: link } = await supabaseAdmin
      .from("team_join_links")
      .select("id, organization_id, team_id, is_active, max_uses, uses_count, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!link) throw new Error("Beitrittslink nicht gefunden.");
    if (!link.is_active) throw new Error("Beitrittslink wurde deaktiviert.");
    if (link.expires_at && new Date(link.expires_at) < new Date()) throw new Error("Beitrittslink ist abgelaufen.");
    if (link.max_uses != null && link.uses_count >= link.max_uses) throw new Error("Beitrittslink hat sein Nutzungslimit erreicht.");

    // Existierende org-Mitgliedschaft respektieren: onboarding_completed nur
    // dann auf false setzen, wenn noch nichts existiert (Neuzugang).
    const { data: existingMem } = await supabaseAdmin
      .from("organization_memberships")
      .select("onboarding_completed, status")
      .eq("user_id", userId)
      .eq("organization_id", link.organization_id)
      .maybeSingle();

    const { error: memErr } = await supabaseAdmin.from("organization_memberships").upsert(
      {
        user_id: userId,
        organization_id: link.organization_id,
        role: "athlete" as any,
        status: "active" as any,
        onboarding_completed: existingMem ? (existingMem as any).onboarding_completed : false,
      } as any,
      { onConflict: "user_id,organization_id" },
    );
    if (memErr) throw new Error(memErr.message);

    // Team-Mitgliedschaft (pending → Onboarding vervollständigt später).
    const { data: existingTm } = await supabaseAdmin
      .from("team_memberships")
      .select("id, status")
      .eq("user_id", userId)
      .eq("team_id", link.team_id)
      .maybeSingle();

    const { error: tmErr } = await supabaseAdmin.from("team_memberships").upsert(
      {
        user_id: userId,
        team_id: link.team_id,
        status: existingTm ? (existingTm as any).status : "pending",
      } as any,
      { onConflict: "user_id,team_id" },
    );
    if (tmErr) throw new Error(tmErr.message);

    // Zählen (best effort).
    await supabaseAdmin
      .from("team_join_links")
      .update({ uses_count: (link.uses_count ?? 0) + 1 })
      .eq("id", link.id);

    // Zielpfad: wenn Onboarding noch offen → org-Onboarding.
    const { data: orgRow } = await supabaseAdmin
      .from("organizations")
      .select("slug")
      .eq("id", link.organization_id)
      .maybeSingle();
    return {
      ok: true as const,
      org_slug: (orgRow as any)?.slug ?? null,
      needs_onboarding: !(existingMem && (existingMem as any).onboarding_completed),
    };
  });
