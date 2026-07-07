/**
 * Zentrale BodyFuel-Produkt-Entitlements.
 *
 * Aggregiert bestehende Quellen (customer_packages, subscriptions, user_roles,
 * organization_memberships, staff_assignments). KEINE neuen Tabellen, KEINE
 * Umbenennung interner Keys. Das ist der einzige erlaubte Weg, UI-seitig zu
 * entscheiden, ob „Mein BodyFuel" freigeschaltet ist.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";

export type StaffRoleKey = "organization_admin" | "head_coach" | "team_coach" | "staff";

export type Entitlements = {
  hasBodyfuelFree: boolean;
  hasBodyfuelSmart: boolean;
  hasBodyfuelCoaching: boolean;
  /** smart ODER coaching → persönlicher BodyFuel-Bereich freigeschaltet */
  hasAnyPersonalBodyfuel: boolean;
  /** Aktive Vereinsmitgliedschaft oder Staff-Zuweisung in irgendeinem Verein */
  hasTeamAccess: boolean;
  /** Coach-Rolle auf Plattformebene (BodyFuel Coach, nicht Vereinscoach) */
  isPlatformCoach: boolean;
  /** Slug des primären Vereins des Nutzers, für Redirects. Nur gesetzt bei hasTeamAccess. */
  primaryOrgSlug: string | null;
  /** ID des primären Vereins (für /coach/teams/$orgId Cockpit-Link). */
  primaryOrgId: string | null;
  /** Höchste Staff-Rolle im primären Verein (falls vorhanden). */
  primaryStaffRole: StaffRoleKey | null;
  loading: boolean;
};

const EMPTY: Entitlements = {
  hasBodyfuelFree: false,
  hasBodyfuelSmart: false,
  hasBodyfuelCoaching: false,
  hasAnyPersonalBodyfuel: false,
  hasTeamAccess: false,
  isPlatformCoach: false,
  primaryOrgSlug: null,
  primaryOrgId: null,
  primaryStaffRole: null,
  loading: false,
};

/**
 * Hook für UI-Entscheidungen. Cache: 60s.
 */
export function useEntitlements(): Entitlements {
  const { supabaseUser, isCoach, isFreeUser, loading } = useSession();

  const q = useQuery({
    queryKey: ["entitlements", supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    staleTime: 60_000,
    queryFn: async () => {
      const uid = supabaseUser!.id;
      const [pkgRes, orgMemRes, staffRes] = await Promise.all([
        supabase
          .from("customer_packages")
          .select("package, is_active, status")
          .eq("user_id", uid)
          .eq("is_active", true),
        supabase
          .from("organization_memberships")
          .select("organization_id, status, organization:organizations!inner(id, slug, status)")
          .eq("user_id", uid),
        supabase
          .from("staff_assignments")
          .select("organization_id, role, permissions, organization:organizations!inner(id, slug, status)")
          .eq("user_id", uid),
      ]);

      const packages = (pkgRes.data ?? []) as { package: string | null }[];
      const activeKeys = new Set(
        packages.map((p) => (p.package ?? "").toLowerCase()).filter(Boolean),
      );
      const hasBodyfuelSmart = activeKeys.has("smart");
      const hasBodyfuelCoaching =
        activeKeys.has("coaching") ||
        activeKeys.has("starter") ||
        activeKeys.has("premium");

      const memRows = (orgMemRes.data ?? []) as Array<{
        status: string | null;
        organization: { id: string; slug: string; status: string } | null;
      }>;
      const activeMems = memRows
        .filter((r) => (!r.status || r.status === "active") && r.organization?.status === "active")
        .map((r) => r.organization!);

      const staffRows = (staffRes.data ?? []) as Array<{
        role: string | null;
        permissions: string[] | null;
        organization: { id: string; slug: string; status: string } | null;
      }>;
      const activeStaff = staffRows.filter((r) => r.organization?.status === "active");

      const primaryOrg = activeMems[0] ?? activeStaff[0]?.organization ?? null;
      const primaryOrgSlug = primaryOrg?.slug ?? null;
      const primaryOrgId = primaryOrg?.id ?? null;
      const hasTeamAccess = primaryOrgSlug !== null;

      // Staff-Rolle im primären Verein bestimmen (Priorität:
      // organization_admin > head_coach > team_coach > staff)
      const rank = (r: string | null, perms: string[] | null): number => {
        if (r === "organization_admin") return 4;
        if (r === "coach" && (perms ?? []).includes("manage_organization")) return 3;
        if (r === "coach") return 2;
        if (r === "staff") return 1;
        return 0;
      };
      const staffInPrimary = activeStaff
        .filter((r) => r.organization?.id === primaryOrgId)
        .sort((a, b) => rank(b.role, b.permissions) - rank(a.role, a.permissions))[0];
      let primaryStaffRole: StaffRoleKey | null = null;
      if (staffInPrimary) {
        const rk = rank(staffInPrimary.role, staffInPrimary.permissions);
        primaryStaffRole =
          rk === 4 ? "organization_admin" :
          rk === 3 ? "head_coach" :
          rk === 2 ? "team_coach" :
          rk === 1 ? "staff" : null;
      }

      return { hasBodyfuelSmart, hasBodyfuelCoaching, hasTeamAccess, primaryOrgSlug, primaryOrgId, primaryStaffRole };
    },
  });

  if (loading || (supabaseUser && q.isPending)) {
    return { ...EMPTY, loading: true };
  }
  if (!supabaseUser) return EMPTY;

  const d =
    q.data ?? {
      hasBodyfuelSmart: false,
      hasBodyfuelCoaching: false,
      hasTeamAccess: false,
      primaryOrgSlug: null as string | null,
      primaryOrgId: null as string | null,
      primaryStaffRole: null as StaffRoleKey | null,
    };
  const hasAny = d.hasBodyfuelSmart || d.hasBodyfuelCoaching;

  return {
    hasBodyfuelFree: isFreeUser,
    hasBodyfuelSmart: d.hasBodyfuelSmart,
    hasBodyfuelCoaching: d.hasBodyfuelCoaching,
    hasAnyPersonalBodyfuel: hasAny,
    hasTeamAccess: d.hasTeamAccess,
    isPlatformCoach: isCoach,
    primaryOrgSlug: d.primaryOrgSlug,
    primaryOrgId: d.primaryOrgId,
    primaryStaffRole: d.primaryStaffRole,
    loading: false,
  };
}
