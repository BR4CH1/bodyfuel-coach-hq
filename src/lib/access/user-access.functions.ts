/**
 * Central Access Resolver — Source of Truth für Zugriffsrechte eines Users.
 *
 * Aggregiert additiv aus bestehenden Tabellen (kein neues Schema):
 *   - customer_packages (persönlicher BodyFuel-Bereich, Smart, Coaching)
 *   - user_roles (Plattform-Coach)
 *   - user_groups (Free-Tracker, Bulls-Gruppe)
 *   - organization_memberships (Verein als Athlet)
 *   - staff_assignments (Verein als Coach/Staff)
 *   - team_memberships (Team-Zuordnung im Verein)
 *
 * REGEL: Ein User = ein Auth-Account. Alle Kontexte sind additiv.
 * „Mein BodyFuel" ist NIEMALS eine Organisation.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrgMembershipInfo = {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: "athlete" | "staff" | string;
  staffRole: string | null;
  permissions: string[];
  teamId: string | null;
  teamName: string | null;
  athleteProfileLinked: boolean;
  membershipStatus: string;
};

export type AvailableContext =
  | { type: "personal_bodyfuel"; label: string }
  | {
      type: "organization";
      organizationId: string;
      organizationSlug: string;
      label: string;
      role: string;
    };

export type UserAccessWarning =
  | "athlete_profile_orphaned"
  | "org_membership_without_active_status"
  | "duplicate_membership"
  | "membership_without_profile"
  | "bodyfuel_customer_without_personal_context"
  | "bulls_group_without_membership";

export type UserAccess = {
  userId: string;
  email: string | null;
  displayName: string | null;
  personalBodyfuelAccess: boolean;
  smartAccess: boolean;
  coachingAccess: boolean;
  freeAccess: boolean;
  isPlatformCoach: boolean;
  organizationMemberships: OrgMembershipInfo[];
  availableContexts: AvailableContext[];
  warnings: UserAccessWarning[];
};

async function loadAccess(
  supabase: any,
  userId: string,
): Promise<UserAccess> {
  const [
    profileRes,
    pkgRes,
    subRes,
    rolesRes,
    groupsRes,
    memRes,
    staffRes,
    teamRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, display_name, email").eq("id", userId).maybeSingle(),
    supabase
      .from("customer_packages")
      .select("package, status, is_active")
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase.from("subscriptions").select("status").eq("user_id", userId),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("user_groups").select("group_name").eq("user_id", userId),
    supabase
      .from("organization_memberships")
      .select(
        "id, organization_id, role, status, organization:organizations!inner(id, slug, name, status)",
      )
      .eq("user_id", userId),
    supabase
      .from("staff_assignments")
      .select(
        "organization_id, role, permissions, team_id, organization:organizations!inner(id, slug, name, status)",
      )
      .eq("user_id", userId),
    supabase
      .from("team_memberships")
      .select("team_id, team:organization_teams!inner(id, name, organization_id)")
      .eq("user_id", userId),
  ]);

  const packages = ((pkgRes.data ?? []) as any[]).map((p) =>
    String(p.package ?? "").toLowerCase(),
  );
  const pkgSet = new Set(packages);
  const activeSubs = ((subRes.data ?? []) as any[]).some(
    (s) => s.status === "active" || s.status === "trialing",
  );
  const smartAccess = pkgSet.has("smart");
  const coachingAccess =
    pkgSet.has("coaching") ||
    pkgSet.has("starter") ||
    pkgSet.has("premium") ||
    activeSubs;
  const personalBodyfuelAccess = smartAccess || coachingAccess;

  const roles = ((rolesRes.data ?? []) as any[]).map((r) => r.role);
  const isPlatformCoach = roles.includes("coach");

  const groups = ((groupsRes.data ?? []) as any[]).map((g) => g.group_name);
  const freeAccess = groups.includes("free") || groups.includes("bulls_free");
  const isBullsGroup = groups.includes("bulls");

  const teamsByOrg = new Map<string, { id: string; name: string }[]>();
  for (const t of (teamRes.data ?? []) as any[]) {
    const orgId = t.team?.organization_id;
    if (!orgId) continue;
    const list = teamsByOrg.get(orgId) ?? [];
    list.push({ id: t.team.id, name: t.team.name });
    teamsByOrg.set(orgId, list);
  }

  // Aggregate memberships + staff into a unified per-org view.
  type Row = OrgMembershipInfo & { sortKey: number };
  const rows = new Map<string, Row>();

  for (const m of (memRes.data ?? []) as any[]) {
    if (!m.organization) continue;
    const teams = teamsByOrg.get(m.organization_id) ?? [];
    rows.set(m.organization_id, {
      organizationId: m.organization_id,
      organizationSlug: m.organization.slug,
      organizationName: m.organization.name,
      role: m.role ?? "athlete",
      staffRole: null,
      permissions: [],
      teamId: teams[0]?.id ?? null,
      teamName: teams[0]?.name ?? null,
      athleteProfileLinked: teams.length > 0,
      membershipStatus: m.status ?? "unknown",
      sortKey: m.status === "active" ? 0 : 1,
    });
  }
  for (const s of (staffRes.data ?? []) as any[]) {
    if (!s.organization) continue;
    const prev = rows.get(s.organization_id);
    if (prev) {
      prev.staffRole = s.role ?? null;
      prev.permissions = (s.permissions as string[] | null) ?? [];
    } else {
      const teams = teamsByOrg.get(s.organization_id) ?? [];
      rows.set(s.organization_id, {
        organizationId: s.organization_id,
        organizationSlug: s.organization.slug,
        organizationName: s.organization.name,
        role: "staff",
        staffRole: s.role ?? null,
        permissions: (s.permissions as string[] | null) ?? [],
        teamId: s.team_id ?? teams[0]?.id ?? null,
        teamName: teams.find((t) => t.id === s.team_id)?.name ?? teams[0]?.name ?? null,
        athleteProfileLinked: false,
        membershipStatus: "active",
        sortKey: 0,
      });
    }
  }

  const organizationMemberships = [...rows.values()].sort((a, b) => a.sortKey - b.sortKey);

  const availableContexts: AvailableContext[] = [];
  if (personalBodyfuelAccess) {
    availableContexts.push({ type: "personal_bodyfuel", label: "Mein BODYFUEL" });
  }
  for (const m of organizationMemberships) {
    if (m.membershipStatus !== "active") continue;
    availableContexts.push({
      type: "organization",
      organizationId: m.organizationId,
      organizationSlug: m.organizationSlug,
      label: m.organizationName,
      role: m.staffRole ?? m.role,
    });
  }

  const warnings: UserAccessWarning[] = [];
  const hasInactive = organizationMemberships.some((m) => m.membershipStatus !== "active");
  if (hasInactive) warnings.push("org_membership_without_active_status");
  if (isBullsGroup && !organizationMemberships.some((m) => m.organizationSlug === "bulls")) {
    warnings.push("bulls_group_without_membership");
  }
  if ((pkgRes.data ?? []).length > 0 && !personalBodyfuelAccess) {
    warnings.push("bodyfuel_customer_without_personal_context");
  }

  return {
    userId,
    email: profileRes.data?.email ?? null,
    displayName: profileRes.data?.display_name ?? null,
    personalBodyfuelAccess,
    smartAccess,
    coachingAccess,
    freeAccess,
    isPlatformCoach,
    organizationMemberships: organizationMemberships.map(({ sortKey: _s, ...rest }) => rest),
    availableContexts,
    warnings,
  };
}

/** Resolver für den eingeloggten User selbst. */
export const resolveMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return loadAccess(context.supabase, context.userId);
  });

/** Coach/Admin-Resolver für einen anderen User (Debug-View). */
export const resolveUserAccessAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isCoach } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "coach",
    });
    if (!isCoach) throw new Error("Forbidden");
    return loadAccess(context.supabase, data.userId);
  });
