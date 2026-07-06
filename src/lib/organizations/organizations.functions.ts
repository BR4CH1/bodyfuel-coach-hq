import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  organization_type: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

export type OrganizationMembership = {
  organization_id: string;
  role: string;
  status: string;
  onboarding_completed: boolean;
  organization: OrganizationSummary;
};

export type OrganizationContext = {
  organization: OrganizationSummary;
  membership: OrganizationMembership | null;
  staff: { role: string; permissions: string[]; team_id: string | null } | null;
  features: { feature: string; enabled: boolean }[];
  teams: { id: string; name: string; slug: string; sport: string | null; age_group: string | null }[];
  team_membership: {
    team_id: string;
    position: string | null;
    secondary_position: string | null;
    jersey_number: number | null;
    gym_access: string | null;
    available_training_days: number[] | null;
    limitations: string | null;
    personal_goal: string | null;
  } | null;
  is_super_admin: boolean;
};

const SAFE_ORG_COLUMNS =
  "id, name, slug, organization_type, logo_url, primary_color, secondary_color";

function serverPublicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/** Public: resolve an organization by slug for the branded landing page. */
export const getOrganizationBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).toLowerCase().trim() }))
  .handler(async ({ data }): Promise<OrganizationSummary | null> => {
    const sb = serverPublicClient();
    const { data: row, error } = await sb
      .from("organizations")
      .select(SAFE_ORG_COLUMNS)
      .eq("slug", data.slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) return null;
    return (row as OrganizationSummary | null) ?? null;
  });

/** List every organization the signed-in user belongs to. */
export const getMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrganizationMembership[]> => {
    const { data, error } = await context.supabase
      .from("organization_memberships")
      .select(
        `organization_id, role, status, onboarding_completed,
         organization:organizations!inner(${SAFE_ORG_COLUMNS})`,
      )
      .eq("user_id", context.userId)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as OrganizationMembership[];
  });

export type OrgContextEntry = {
  organization: OrganizationSummary;
  athlete: { role: string; onboarding_completed: boolean } | null;
  staff: { role: string; permissions: string[]; team_id: string | null } | null;
};

/** Unified list: every organization the user can access as athlete OR staff. */
export const getMyOrgContexts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgContextEntry[]> => {
    const { supabase, userId } = context;
    const [memRes, staffRes] = await Promise.all([
      supabase
        .from("organization_memberships")
        .select(
          `organization_id, role, onboarding_completed,
           organization:organizations!inner(${SAFE_ORG_COLUMNS})`,
        )
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase
        .from("staff_assignments")
        .select(
          `organization_id, role, permissions, team_id,
           organization:organizations!inner(${SAFE_ORG_COLUMNS})`,
        )
        .eq("user_id", userId),
    ]);
    if (memRes.error) throw new Error(memRes.error.message);
    if (staffRes.error) throw new Error(staffRes.error.message);

    const byId = new Map<string, OrgContextEntry>();
    for (const m of (memRes.data ?? []) as any[]) {
      const org = m.organization as OrganizationSummary;
      if (!org) continue;
      byId.set(org.id, {
        organization: org,
        athlete: { role: m.role, onboarding_completed: !!m.onboarding_completed },
        staff: null,
      });
    }
    for (const s of (staffRes.data ?? []) as any[]) {
      const org = s.organization as OrganizationSummary;
      if (!org) continue;
      const existing = byId.get(org.id) ?? { organization: org, athlete: null, staff: null };
      existing.staff = {
        role: s.role,
        permissions: (s.permissions ?? []) as string[],
        team_id: s.team_id ?? null,
      };
      byId.set(org.id, existing);
    }
    return Array.from(byId.values());
  });

/** Full org context for the signed-in user (membership, staff, features, teams). */
export const getOrganizationContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).toLowerCase().trim() }))
  .handler(async ({ data, context }): Promise<OrganizationContext | null> => {
    const { supabase, userId } = context;
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select(SAFE_ORG_COLUMNS)
      .eq("slug", data.slug)
      .eq("status", "active")
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org) return null;
    const orgId = (org as { id: string }).id;

    const [membershipRes, staffRes, featuresRes, teamsRes, teamMembershipRes, superAdminRes] =
      await Promise.all([
        supabase
          .from("organization_memberships")
          .select("organization_id, role, status, onboarding_completed")
          .eq("user_id", userId)
          .eq("organization_id", orgId)
          .maybeSingle(),
        supabase
          .from("staff_assignments")
          .select("role, permissions, team_id")
          .eq("user_id", userId)
          .eq("organization_id", orgId)
          .maybeSingle(),
        supabase
          .from("organization_features")
          .select("feature, enabled")
          .eq("organization_id", orgId),
        supabase
          .from("organization_teams")
          .select("id, name, slug, sport, age_group")
          .eq("organization_id", orgId)
          .eq("status", "active"),
        supabase
          .from("team_memberships")
          .select("team_id, position, secondary_position, jersey_number, gym_access, available_training_days, limitations, personal_goal, team:organization_teams!inner(organization_id)")
          .eq("user_id", userId),
        supabase.rpc("has_role", { _user_id: userId, _role: "coach" }),
      ]);

    const teamMembership =
      (teamMembershipRes.data ?? []).find(
        (t: any) => t.team?.organization_id === orgId,
      ) ?? null;

    return {
      organization: org as OrganizationSummary,
      membership: membershipRes.data
        ? {
            organization_id: orgId,
            role: (membershipRes.data as any).role,
            status: (membershipRes.data as any).status,
            onboarding_completed: !!(membershipRes.data as any).onboarding_completed,
            organization: org as OrganizationSummary,
          }
        : null,
      staff: staffRes.data
        ? {
            role: (staffRes.data as any).role,
            permissions: ((staffRes.data as any).permissions ?? []) as string[],
            team_id: (staffRes.data as any).team_id ?? null,
          }
        : null,
      features: (featuresRes.data ?? []) as { feature: string; enabled: boolean }[],
      teams: (teamsRes.data ?? []) as OrganizationContext["teams"],
      team_membership: teamMembership
        ? {
            team_id: (teamMembership as any).team_id,
            position: (teamMembership as any).position ?? null,
            secondary_position: (teamMembership as any).secondary_position ?? null,
            jersey_number: (teamMembership as any).jersey_number ?? null,
            gym_access: (teamMembership as any).gym_access ?? null,
            available_training_days: (teamMembership as any).available_training_days ?? null,
            limitations: (teamMembership as any).limitations ?? null,
            personal_goal: (teamMembership as any).personal_goal ?? null,
          }
        : null,
      is_super_admin: !!superAdminRes.data,
    };
  });

/** Complete the org onboarding for the current user. */
export const completeOrganizationOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      team_id?: string | null;
      position?: string | null;
      secondary_position?: string | null;
      jersey_number?: number | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.team_id) {
      const { error: tmErr } = await supabase
        .from("team_memberships")
        .upsert(
          {
            user_id: userId,
            team_id: data.team_id,
            position: data.position ?? null,
            secondary_position: data.secondary_position ?? null,
            jersey_number: data.jersey_number ?? null,
            status: "active",
          },
          { onConflict: "user_id,team_id" },
        );
      if (tmErr) throw new Error(tmErr.message);
    }

    const { error } = await supabase
      .from("organization_memberships")
      .update({ onboarding_completed: true })
      .eq("user_id", userId)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public: preview an invite (no auth) so the invite page can render a
 *  Willkommens-/Onboarding-Screen bevor Login/Signup passiert. */
export const getInvitePreview = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => ({ token: String(d.token).trim() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("organization_invites")
      .select("email, assigned_role, status, expires_at, organization_id, team_id")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!invite) return { ok: false as const, reason: "not_found" as const };
    const expired =
      !!invite.expires_at && new Date(invite.expires_at) < new Date();
    const effectiveStatus = expired ? "expired" : String(invite.status);
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name, slug, logo_url")
      .eq("id", invite.organization_id)
      .maybeSingle();
    let teamName: string | null = null;
    if (invite.team_id) {
      const { data: t } = await supabaseAdmin
        .from("organization_teams")
        .select("name")
        .eq("id", invite.team_id)
        .maybeSingle();
      teamName = (t as { name?: string } | null)?.name ?? null;
    }
    return {
      ok: true as const,
      email: invite.email,
      role: invite.assigned_role,
      status: effectiveStatus,
      organization: {
        name: (org as { name?: string } | null)?.name ?? "",
        slug: (org as { slug?: string } | null)?.slug ?? "",
        logo_url: (org as { logo_url?: string | null } | null)?.logo_url ?? null,
      },
      team_name: teamName,
    };
  });

/** Accept an invite token — creates the org (and optionally team) membership. */
export const acceptOrganizationInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => ({ token: String(d.token).trim() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error: invErr } = await supabaseAdmin
      .from("organization_invites")
      .select("*")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (invErr) throw new Error(invErr.message);
    if (!invite) throw new Error("Einladung nicht gefunden.");
    if (invite.status !== "pending") throw new Error("Einladung nicht mehr gültig.");
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin
        .from("organization_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      throw new Error("Einladung abgelaufen.");
    }

    const { error: memErr } = await supabaseAdmin.from("organization_memberships").upsert(
      {
        user_id: userId,
        organization_id: invite.organization_id,
        role: invite.assigned_role,
        status: "active",
      },
      { onConflict: "user_id,organization_id" },
    );
    if (memErr) throw new Error(memErr.message);

    if (invite.team_id) {
      const { error: tmErr } = await supabaseAdmin.from("team_memberships").upsert(
        { user_id: userId, team_id: invite.team_id, status: "active" },
        { onConflict: "user_id,team_id" },
      );
      if (tmErr) throw new Error(tmErr.message);
    }

    await supabaseAdmin
      .from("organization_invites")
      .update({ status: "accepted", accepted_by: userId, accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    // Return the slug so the client can navigate to the branded surface.
    const { data: org } = await supabase
      .from("organizations")
      .select("slug")
      .eq("id", invite.organization_id)
      .maybeSingle();
    return { ok: true, slug: (org as any)?.slug ?? null };
  });

/** Coach dashboard — list organizations the current staff/admin can see. */
export const listOrganizationsForStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrganizationSummary[]> => {
    const { supabase, userId } = context;
    const { data: isCoach } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "coach",
    });

    if (isCoach) {
      const { data, error } = await supabase
        .from("organizations")
        .select(SAFE_ORG_COLUMNS)
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as OrganizationSummary[];
    }

    const { data, error } = await supabase
      .from("staff_assignments")
      .select(`organization:organizations!inner(${SAFE_ORG_COLUMNS})`)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const seen = new Set<string>();
    const out: OrganizationSummary[] = [];
    for (const row of (data ?? []) as any[]) {
      const o = row.organization as OrganizationSummary;
      if (o && !seen.has(o.id)) {
        seen.add(o.id);
        out.push(o);
      }
    }
    return out;
  });
