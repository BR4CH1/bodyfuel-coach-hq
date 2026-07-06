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
  loading: boolean;
};

const EMPTY: Entitlements = {
  hasBodyfuelFree: false,
  hasBodyfuelSmart: false,
  hasBodyfuelCoaching: false,
  hasAnyPersonalBodyfuel: false,
  hasTeamAccess: false,
  isPlatformCoach: false,
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
          .select("id, status")
          .eq("user_id", uid),
        supabase
          .from("staff_assignments")
          .select("id")
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

      const activeOrgMem = ((orgMemRes.data ?? []) as { status: string | null }[]).some(
        (m) => !m.status || m.status === "active",
      );
      const hasStaff = (staffRes.data ?? []).length > 0;

      return {
        hasBodyfuelSmart,
        hasBodyfuelCoaching,
        hasTeamAccess: activeOrgMem || hasStaff,
      };
    },
  });

  if (loading || (supabaseUser && q.isPending)) {
    return { ...EMPTY, loading: true };
  }
  if (!supabaseUser) return EMPTY;

  const d = q.data ?? { hasBodyfuelSmart: false, hasBodyfuelCoaching: false, hasTeamAccess: false };
  const hasAny = d.hasBodyfuelSmart || d.hasBodyfuelCoaching;

  return {
    hasBodyfuelFree: isFreeUser,
    hasBodyfuelSmart: d.hasBodyfuelSmart,
    hasBodyfuelCoaching: d.hasBodyfuelCoaching,
    hasAnyPersonalBodyfuel: hasAny,
    hasTeamAccess: d.hasTeamAccess,
    isPlatformCoach: isCoach,
    loading: false,
  };
}
