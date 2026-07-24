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
  staff: {
    role: string;
    permissions: string[];
    team_id: string | null;
    function_label: string | null;
    onboarding_completed_at: string | null;
  } | null;
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
  profile: {
    display_name: string | null;
    nickname: string | null;
    birthdate: string | null;
    height_cm: number | null;
  } | null;
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

    const STAFF_MEMBERSHIP_ROLES = new Set([
      "coach",
      "organization_admin",
      "head_coach",
      "team_coach",
      "performance_coach",
      "nutrition_coach",
      "community_manager",
      "staff",
    ]);

    const byId = new Map<string, OrgContextEntry>();
    for (const m of (memRes.data ?? []) as any[]) {
      const org = m.organization as OrganizationSummary;
      if (!org) continue;
      const entry: OrgContextEntry = byId.get(org.id) ?? {
        organization: org,
        athlete: null,
        staff: null,
      };
      if (m.role === "athlete") {
        entry.athlete = { role: m.role, onboarding_completed: !!m.onboarding_completed };
      } else if (STAFF_MEMBERSHIP_ROLES.has(m.role) && !entry.staff) {
        // Membership role signals staff access even without a staff_assignments row.
        entry.staff = { role: m.role, permissions: [], team_id: null };
      }
      byId.set(org.id, entry);
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
    // Nur tatsächlich vorhandene Zugriffe zurückgeben. Ein Athleteneintrag
    // entsteht ausschließlich aus einer echten organization_memberships-Zeile
    // mit role='athlete'. Ein Coach-Eintrag entsteht aus staff_assignments
    // ODER einer Membership mit Staff-Rolle. Kein synthetisches Auto-Inject
    // — Rollen werden nicht dedupliziert oder überschrieben, sondern jede
    // Kombination (org × rolle) wird als eigener AccessContext ausgegeben.
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

    const [membershipRes, staffRes, featuresRes, teamsRes, teamMembershipRes, superAdminRes, profileRes] =
      await Promise.all([
        supabase
          .from("organization_memberships")
          .select("organization_id, role, status, onboarding_completed")
          .eq("user_id", userId)
          .eq("organization_id", orgId)
          .maybeSingle(),
        supabase
          .from("staff_assignments")
          .select("role, permissions, team_id, function_label, onboarding_completed_at")
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
        supabase
          .from("profiles")
          .select("display_name, nickname, birthdate, height_cm")
          .eq("id", userId)
          .maybeSingle(),
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
            function_label: (staffRes.data as any).function_label ?? null,
            onboarding_completed_at: (staffRes.data as any).onboarding_completed_at ?? null,
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
      profile: profileRes.data
        ? {
            display_name: (profileRes.data as any).display_name ?? null,
            nickname: (profileRes.data as any).nickname ?? null,
            birthdate: (profileRes.data as any).birthdate ?? null,
            height_cm: (profileRes.data as any).height_cm ?? null,
          }
        : null,
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
    const { supabase, userId, claims } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error: invErr } = await supabaseAdmin
      .from("organization_invites")
      .select("*")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (invErr) throw new Error(invErr.message);
    if (!invite) throw new Error("Einladung nicht gefunden.");

    // Guard: only the invited email address may accept. Prevents another
    // signed-in user (z. B. der einladende Coach) vom versehentlichen
    // Konsumieren der Einladung beim Klick auf den Link.
    const callerEmail = String(
      (claims as { email?: string } | undefined)?.email ?? "",
    )
      .trim()
      .toLowerCase();
    const inviteEmail = String(invite.email ?? "").trim().toLowerCase();
    if (inviteEmail && callerEmail && inviteEmail !== callerEmail) {
      throw new Error(
        "Diese Einladung ist für eine andere E-Mail-Adresse ausgestellt. Bitte melde dich mit der eingeladenen Adresse an.",
      );
    }

    if (invite.status !== "pending") throw new Error("Einladung nicht mehr gültig.");
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin
        .from("organization_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      throw new Error("Einladung abgelaufen.");
    }

    // Fachliche Trennung:
    // - `organization_memberships` = Zugehörigkeit + Athletenrolle. Für reine
    //   Staff-User ohne bestehende Membership speichern wir den neutralen
    //   Marker `member`. Eine vorhandene Athletenrolle bleibt immer erhalten.
    // - `staff_assignments` = tatsächliche Vereinsrolle + Berechtigungen.
    const assignedRole = invite.assigned_role;
    const isAthleteInvite = assignedRole === "athlete";

    if (isAthleteInvite) {
      const { error: memErr } = await supabaseAdmin.from("organization_memberships").upsert(
        {
          user_id: userId,
          organization_id: invite.organization_id,
          role: "athlete",
          status: "active",
        },
        { onConflict: "user_id,organization_id" },
      );
      if (memErr) throw new Error(memErr.message);

      if (invite.team_id) {
        // Invite-Prefill: Position/Trikotnummer aus der Einladung übernehmen,
        // damit das Athleten-Onboarding die Felder vorbelegen kann. Bestehende
        // Werte bei Wiederannahme nicht überschreiben — deshalb erst prüfen.
        const { data: existingTm } = await supabaseAdmin
          .from("team_memberships")
          .select("position, secondary_position, jersey_number")
          .eq("user_id", userId)
          .eq("team_id", invite.team_id)
          .maybeSingle();
        const invAny = invite as any;
        const tmPayload: Record<string, unknown> = {
          user_id: userId,
          team_id: invite.team_id,
          status: "active",
        };
        if (!(existingTm as any)?.position && invAny.athlete_primary_position) {
          tmPayload.position = invAny.athlete_primary_position;
        }
        if (!(existingTm as any)?.secondary_position && invAny.athlete_secondary_position) {
          tmPayload.secondary_position = invAny.athlete_secondary_position;
        }
        if ((existingTm as any)?.jersey_number == null && invAny.athlete_jersey_number != null) {
          tmPayload.jersey_number = invAny.athlete_jersey_number;
        }
        const { error: tmErr } = await supabaseAdmin
          .from("team_memberships")
          .upsert(tmPayload as any, { onConflict: "user_id,team_id" });

        if (tmErr) throw new Error(tmErr.message);
      }

    } else {
      // Staff-Einladung: Eine bestehende Athletenrolle muss erhalten bleiben.
      // organization_memberships hat absichtlich nur eine Zeile pro User+Org;
      // die additive Coach-Rolle lebt ausschließlich in staff_assignments.
      // Ein blindes Upsert mit role="member" würde Dual-Role-User wieder zu
      // reinen Staff-Usern machen.
      const { data: existingMembership, error: existingMembershipErr } =
        await supabaseAdmin
          .from("organization_memberships")
          .select("id, role, status")
          .eq("user_id", userId)
          .eq("organization_id", invite.organization_id)
          .maybeSingle();
      if (existingMembershipErr) throw new Error(existingMembershipErr.message);

      if (existingMembership) {
        const { error: memErr } = await supabaseAdmin
          .from("organization_memberships")
          .update({ status: "active" })
          .eq("id", existingMembership.id);
        if (memErr) throw new Error(memErr.message);
      } else {
        const { error: memErr } = await supabaseAdmin
          .from("organization_memberships")
          .insert({
            user_id: userId,
            organization_id: invite.organization_id,
            role: "member",
            status: "active",
          });
        if (memErr) throw new Error(memErr.message);
      }

      const { error: staffErr } = await supabaseAdmin.from("staff_assignments").upsert(
        {
          user_id: userId,
          organization_id: invite.organization_id,
          team_id: invite.team_id ?? null,
          role: assignedRole,
          permissions: invite.permissions ?? [],
        },
        { onConflict: "user_id,organization_id,team_id" },
      );
      if (staffErr) throw new Error(staffErr.message);
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

// ─────────────────────────────────────────────────────────────────────────────
// Platform Owner — Performance-Teams-Verwaltung (nur Plattform-Owner)
// ─────────────────────────────────────────────────────────────────────────────

export type PerformanceTeamCard = OrganizationSummary & {
  short_name: string | null;
  sport: string | null;
  status: string;
  team_count: number;
  athlete_count: number;
  staff_count: number;
};

async function assertPlatformOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "platform_owner",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Zugriff — nur für Plattform-Owner.");
}

/** Owner-only: prüft ob der aktuelle User Plattform-Owner ist. */
export const getIsPlatformOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "platform_owner",
    });
    return !!data;
  });

/** Owner-only: alle Organisationen inkl. Zählungen für die Team-Karten. */
export const listPerformanceTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PerformanceTeamCard[]> => {
    await assertPlatformOwner(context.supabase, context.userId);
    const { data: orgs, error } = await context.supabase
      .from("organizations")
      .select("id, name, slug, organization_type, logo_url, primary_color, secondary_color, short_name, sport, status")
      .order("name");
    if (error) throw new Error(error.message);
    if (!orgs || orgs.length === 0) return [];

    const orgIds = orgs.map((o: any) => o.id);
    const [teamsRes, athletesRes, staffRes] = await Promise.all([
      context.supabase
        .from("organization_teams")
        .select("organization_id")
        .in("organization_id", orgIds),
      context.supabase
        .from("organization_memberships")
        .select("organization_id")
        .in("organization_id", orgIds)
        .eq("status", "active")
        .eq("role", "athlete"),
      context.supabase
        .from("staff_assignments")
        .select("organization_id")
        .in("organization_id", orgIds),
    ]);

    const count = (rows: any[] | null, orgId: string) =>
      (rows ?? []).filter((r: any) => r.organization_id === orgId).length;

    return (orgs as any[]).map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      organization_type: o.organization_type,
      logo_url: o.logo_url,
      primary_color: o.primary_color,
      secondary_color: o.secondary_color,
      short_name: o.short_name ?? null,
      sport: o.sport ?? null,
      status: o.status,
      team_count: count(teamsRes.data as any[], o.id),
      athlete_count: count(athletesRes.data as any[], o.id),
      staff_count: count(staffRes.data as any[], o.id),
    }));
  });

const SLUG_RESERVED = new Set([
  "auth","login","logout","dashboard","nutrition","training","messages","community",
  "profile","coach","admin","tracker","smart","ranking","achievements","checkout",
  "impressum","datenschutz","trust","welcome","api","app","mcp","lovable","onboarding",
  "measurements","progress","strength-check","check-in","training-import","daily-checklist",
  "unsubscribe","guardian-consent","org","organizations","teams","staff","invite","invites",
  "settings","account","notifications","support","help","about","pricing","contact","signup","signin","register",
]);

/** Owner-only: legt eine neue leere Performance-Team-Organisation an.
 *  Erstellt NUR die Org-Hülle + Branding + den aufrufenden Owner als organization_admin.
 *  Keine Mannschaften, Coaches, Athleten, Trainings-, Ernährungs- oder Testdaten
 *  werden aus einer Vorlage kopiert — das neue Team startet komplett leer. */
export const createPerformanceTeamOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      name: string;
      slug: string;
      short_name?: string | null;
      sport?: string | null;
      claim?: string | null;
      logo_url?: string | null;
      alt_logo_url?: string | null;
      primary_color?: string | null;
      secondary_color?: string | null;
      accent_color?: string | null;
      background_color?: string | null;
      text_color?: string | null;
      organization_type?: string | null;
      enabled_features?: string[] | null;
      license_plan?: string | null;
      license_status?: string | null;
      max_customers?: number | null;
      max_coaches?: number | null;
    }) => {
      const name = String(d.name ?? "").trim();
      const slug = String(d.slug ?? "").toLowerCase().trim();
      if (name.length < 2) throw new Error("Teamname zu kurz.");
      if (!/^[a-z0-9][a-z0-9-]{1,49}$/.test(slug)) {
        throw new Error("Ungültiger URL-Slug (a-z, 0-9, -, 2–50 Zeichen).");
      }
      if (SLUG_RESERVED.has(slug)) throw new Error(`Slug "${slug}" ist reserviert.`);
      const features = Array.isArray(d.enabled_features)
        ? Array.from(new Set(d.enabled_features.map((f) => String(f).trim()).filter(Boolean)))
        : null;
      return {
        name,
        slug,
        short_name: d.short_name?.trim() || null,
        sport: d.sport?.trim() || null,
        claim: d.claim?.trim() || null,
        logo_url: d.logo_url?.trim() || null,
        alt_logo_url: d.alt_logo_url?.trim() || null,
        primary_color: d.primary_color?.trim() || null,
        secondary_color: d.secondary_color?.trim() || null,
        accent_color: d.accent_color?.trim() || null,
        background_color: d.background_color?.trim() || null,
        text_color: d.text_color?.trim() || null,
        organization_type: d.organization_type?.trim() || "sports_club",
        enabled_features: features,
        license_plan: d.license_plan?.trim() || null,
        license_status: d.license_status?.trim() || null,
        max_customers:
          typeof d.max_customers === "number" && Number.isFinite(d.max_customers)
            ? Math.max(0, Math.floor(d.max_customers))
            : null,
        max_coaches:
          typeof d.max_coaches === "number" && Number.isFinite(d.max_coaches)
            ? Math.max(0, Math.floor(d.max_coaches))
            : null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertPlatformOwner(context.supabase, context.userId);

    const { data: existing } = await context.supabase
      .from("organizations")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (existing) throw new Error(`Slug "${data.slug}" ist bereits vergeben.`);

    const insertRow: Record<string, unknown> = {
      name: data.name,
      slug: data.slug,
      short_name: data.short_name,
      sport: data.sport,
      claim: data.claim,
      logo_url: data.logo_url,
      alt_logo_url: data.alt_logo_url,
      primary_color: data.primary_color,
      secondary_color: data.secondary_color,
      accent_color: data.accent_color,
      background_color: data.background_color,
      text_color: data.text_color,
      organization_type: data.organization_type,
      status: "active",
    };
    if (data.license_plan) insertRow.license_plan = data.license_plan;
    if (data.license_status) {
      insertRow.license_status = data.license_status;
      if (data.license_status === "trial" || data.license_status === "active") {
        insertRow.license_started_at = new Date().toISOString();
      }
    }
    if (data.max_customers !== null) insertRow.max_customers = data.max_customers;
    if (data.max_coaches !== null) insertRow.max_coaches = data.max_coaches;

    const { data: inserted, error: insErr } = await context.supabase
      .from("organizations")
      .insert(insertRow as any)
      .select("id, slug")
      .single();
    if (insErr) throw new Error(insErr.message);

    const orgId = (inserted as any).id as string;

    // Owner als organization_admin eintragen, damit is_org_admin sofort greift.
    const { error: staffErr } = await context.supabase
      .from("staff_assignments")
      .insert({
        user_id: context.userId,
        organization_id: orgId,
        role: "organization_admin",
        permissions: [],
        team_id: null,
      } as any);
    if (staffErr) throw new Error(staffErr.message);

    // Modul-Presets als organization_features anlegen (enabled=true).
    if (data.enabled_features && data.enabled_features.length > 0) {
      const rows = data.enabled_features.map((feature) => ({
        organization_id: orgId,
        feature,
        enabled: true,
      }));
      const { error: featErr } = await context.supabase
        .from("organization_features")
        .upsert(rows as any, { onConflict: "organization_id,feature" });
      if (featErr) throw new Error(featErr.message);
    }

    return { id: orgId, slug: (inserted as any).slug as string };
  });

/** Owner-only: löscht eine Performance-Team-Organisation vollständig.
 *  Bulls-Slug ist hart geblockt. Erfordert exakten Namen als Bestätigung.
 *  FK-Cascade räumt organisationsbezogene Daten auf; globale profiles /
 *  auth.users bleiben unangetastet (profiles.organization_id → SET NULL). */
export const deletePerformanceTeamOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; confirm_name: string }) => {
    const id = String(d.organization_id ?? "").trim();
    const name = String(d.confirm_name ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Ungültige Organisations-ID.");
    if (!name) throw new Error("Bitte den Organisationsnamen zur Bestätigung eingeben.");
    return { organization_id: id, confirm_name: name };
  })
  .handler(async ({ data, context }) => {
    await assertPlatformOwner(context.supabase, context.userId);

    const { data: org, error: readErr } = await context.supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", data.organization_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!org) throw new Error("Organisation nicht gefunden.");

    if (String((org as any).name).trim() !== data.confirm_name.trim()) {

      throw new Error("Der eingegebene Name stimmt nicht mit dem Organisationsnamen überein.");
    }

    // Service-Role-Client — FK-Cascade räumt Teams, Memberships, Staff,
    // Challenges, Posts, Tasks etc. auf. profiles.organization_id → SET NULL,
    // globale BodyFuel-Accounts bleiben bestehen.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin
      .from("organizations")
      .delete()
      .eq("id", data.organization_id);
    if (delErr) throw new Error(delErr.message);

    return { ok: true as const, id: data.organization_id, name: (org as any).name as string };
  });

function slugifyTeamName(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** Coach/Admin: legt ein Team unter einer Organisation an. RLS (is_org_admin)
 *  regelt die Berechtigung, `platform_owner` ist als organization_admin
 *  eingetragen und darf ebenfalls anlegen. */
export const createOrgTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      name: string;
      sport?: string | null;
      age_group?: string | null;
    }) => {
      const organization_id = String(d.organization_id ?? "").trim();
      const name = String(d.name ?? "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(organization_id))
        throw new Error("Ungültige Organisations-ID.");
      if (name.length < 2) throw new Error("Teamname zu kurz.");
      if (name.length > 80) throw new Error("Teamname zu lang.");
      return {
        organization_id,
        name,
        sport: d.sport?.trim() || null,
        age_group: d.age_group?.trim() || null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const base = slugifyTeamName(data.name) || "team";
    // Konflikte in (organization_id, slug) vermeiden — Suffix bei Bedarf.
    const { data: existing } = await context.supabase
      .from("organization_teams")
      .select("slug")
      .eq("organization_id", data.organization_id);
    const taken = new Set(((existing ?? []) as any[]).map((r) => String(r.slug)));
    let slug = base;
    let i = 2;
    while (taken.has(slug)) {
      slug = `${base}-${i++}`;
      if (i > 999) throw new Error("Konnte keinen freien Team-Slug erzeugen.");
    }

    // Sport von der Organisation erben, wenn nicht angegeben.
    let sport = data.sport;
    if (!sport) {
      const { data: org } = await context.supabase
        .from("organizations")
        .select("sport")
        .eq("id", data.organization_id)
        .maybeSingle();
      sport = ((org as any)?.sport as string | null) ?? null;
    }

    const { data: inserted, error } = await context.supabase
      .from("organization_teams")
      .insert({
        organization_id: data.organization_id,
        name: data.name,
        slug,
        sport,
        age_group: data.age_group,
      } as any)
      .select("id, name, slug, sport, age_group")
      .single();
    if (error) throw new Error(error.message);
    return inserted as { id: string; name: string; slug: string; sport: string | null; age_group: string | null };
  });


// =============================================================================
// ORGANISATIONS-MODULE (Feature Flags)
// =============================================================================
//
// Der Modul-Katalog lebt in `src/lib/organizations/modules.ts`. Diese Server-
// funktionen sind der reine DB-Zugang. Autorisierung erfolgt über die
// RLS-Policy `org features manage admin` (Platform-Owner ODER Vereins-Admin).

/** Alle bekannten Feature-Zeilen der Organisation. */
export const listOrganizationFeatures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("organization_features")
      .select("feature, enabled")
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return (rows ?? []) as { feature: string; enabled: boolean }[];
  });

/** Setzt ein oder mehrere Feature-Flags gleichzeitig (Modul-Aliase). */
export const setOrganizationFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { orgId: string; features: string[]; enabled: boolean }) => data,
  )
  .handler(async ({ data, context }) => {
    if (!data.features?.length) return { ok: true };



    const rows = data.features.map((f) => ({
      organization_id: data.orgId,
      feature: f,
      enabled: data.enabled,
    }));
    const { error } = await context.supabase
      .from("organization_features")
      .upsert(rows, { onConflict: "organization_id,feature" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });





// ────────────────────────────────────────────────────────────────────────────
// Phase 3: Terminologie überschreiben
// ────────────────────────────────────────────────────────────────────────────


async function assertCanManageOrg(supabase: any, userId: string, orgId: string) {
  // Plattform-Owner darf alles.
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_owner")
    .maybeSingle();
  if (role) return;
  const { data: staff } = await supabase
    .from("staff_assignments")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();
  const r = (staff as any)?.role;
  if (r !== "organization_admin") {
    throw new Error("Keine Berechtigung.");
  }
}

export const updateOrganizationTerminology = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; terminology: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    await assertCanManageOrg(context.supabase, context.userId, data.orgId);
    const { error } = await context.supabase
      .from("organizations")
      .update({ terminology: data.terminology as any })
      .eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ────────────────────────────────────────────────────────────────────────────
// Phase 6: Branding erweitern
// ────────────────────────────────────────────────────────────────────────────

export const updateOrganizationBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      orgId: string;
      primary_color?: string | null;
      secondary_color?: string | null;
      accent_color?: string | null;
      background_color?: string | null;
      text_color?: string | null;
      logo_url?: string | null;
      alt_logo_url?: string | null;
      claim?: string | null;
      short_name?: string | null;
      branding_mode?: string | null;
      branding_extra?: Record<string, unknown> | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCanManageOrg(context.supabase, context.userId, data.orgId);
    
    const patch: Record<string, unknown> = {};
    for (const k of [
      "primary_color",
      "secondary_color",
      "accent_color",
      "background_color",
      "text_color",
      "logo_url",
      "alt_logo_url",
      "claim",
      "short_name",
      "branding_mode",
      "branding_extra",
    ] as const) {
      if ((data as any)[k] !== undefined) patch[k] = (data as any)[k];
    }
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await context.supabase
      .from("organizations")
      .update(patch as any)
      .eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ────────────────────────────────────────────────────────────────────────────
// Phase 4: Coach ↔ Kunden-Zuweisungen (organization_coach_assignments)
// ────────────────────────────────────────────────────────────────────────────

export type OrgCoachAssignmentRow = {
  id: string;
  organization_id: string;
  coach_user_id: string;
  customer_user_id: string;
  role: string;
  coach_name: string | null;
  customer_name: string | null;
  created_at: string;
};

export const listOrgCoachAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => d)
  .handler(async ({ data, context }) => {
    // Zugriff prüfen (Coach der Org oder Owner)
    const { data: staff } = await context.supabase
      .from("staff_assignments")
      .select("role")
      .eq("user_id", context.userId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    const { data: plat } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "platform_owner")
      .maybeSingle();
    if (!staff && !plat) throw new Error("Keine Berechtigung.");

    const { data: rows, error } = await context.supabase
      .from("organization_coach_assignments")
      .select("id, organization_id, coach_user_id, customer_user_id, role, created_at")
      .eq("organization_id", data.orgId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = new Set<string>();
    for (const r of rows ?? []) {
      ids.add((r as any).coach_user_id);
      ids.add((r as any).customer_user_id);
    }
    let nameMap = new Map<string, string>();
    if (ids.size) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(ids));
      for (const p of profs ?? []) {
        nameMap.set((p as any).id, (p as any).display_name ?? null);
      }
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      coach_name: nameMap.get(r.coach_user_id) ?? null,
      customer_name: nameMap.get(r.customer_user_id) ?? null,
    })) as OrgCoachAssignmentRow[];
  });

export const upsertOrgCoachAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      orgId: string;
      coachUserId: string;
      customerUserId: string;
      role?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCanManageOrg(context.supabase, context.userId, data.orgId);
    const { error } = await context.supabase
      .from("organization_coach_assignments")
      .upsert(
        {
          organization_id: data.orgId,
          coach_user_id: data.coachUserId,
          customer_user_id: data.customerUserId,
          role: data.role ?? "primary_coach",
        },
        { onConflict: "organization_id,coach_user_id,customer_user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeOrgCoachAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; assignmentId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCanManageOrg(context.supabase, context.userId, data.orgId);
    const { error } = await context.supabase
      .from("organization_coach_assignments")
      .delete()
      .eq("id", data.assignmentId)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Liefert Coaches (staff_assignments.role='coach' oder 'organization_admin') und Members der Org. */
export const listOrgCoachesAndCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase
      .from("staff_assignments")
      .select("user_id, role")
      .eq("organization_id", data.orgId)
      .in("role", ["organization_admin", "coach"]);
    const { data: mems } = await context.supabase
      .from("organization_memberships")
      .select("user_id, role, status")
      .eq("organization_id", data.orgId);

    const coachIds = new Set<string>((staff ?? []).map((s: any) => s.user_id));
    const memberIds = new Set<string>(
      (mems ?? [])
        .filter((m: any) => !coachIds.has(m.user_id))
        .map((m: any) => m.user_id),
    );
    const allIds = new Set<string>([...coachIds, ...memberIds]);
    let profiles: any[] = [];
    if (allIds.size) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", Array.from(allIds));
      profiles = profs ?? [];
    }
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const coaches = Array.from(coachIds).map((id) => ({
      user_id: id,
      display_name: byId.get(id)?.display_name ?? null,
      email: byId.get(id)?.email ?? null,
      role: (staff ?? []).find((s: any) => s.user_id === id)?.role ?? "coach",
    }));
    const customers = Array.from(memberIds).map((id) => ({
      user_id: id,
      display_name: byId.get(id)?.display_name ?? null,
      email: byId.get(id)?.email ?? null,
    }));
    return { coaches, customers };
  });
