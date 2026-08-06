import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEntitlement } from "@/lib/entitlements.functions";
import { FREE_ENTITLEMENT, type Entitlement } from "@/lib/entitlements.logic";
import { useSession } from "@/lib/bodyfuel/session";

export type EntitlementState = Entitlement & {
  loading: boolean;
  /** Coaches haben immer Vollzugriff. */
  isCoach: boolean;
  refresh: () => void;
};

/**
 * Einheitlicher Client-Zugriff auf das Smart-Entitlement.
 * Ein laufender 7-Tage-Test wird hier korrekt als Smart behandelt.
 */
export function useEntitlement(): EntitlementState {
  const { supabaseUser, isCoach } = useSession();
  const fetchFn = useServerFn(getMyEntitlement);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-entitlement", supabaseUser?.id],
    queryFn: () => fetchFn(),
    enabled: !!supabaseUser?.id,
    staleTime: 60_000,
  });

  const base = data ?? FREE_ENTITLEMENT;

  return {
    ...base,
    hasSmart: base.hasSmart || isCoach,
    loading: isLoading && !!supabaseUser?.id,
    isCoach,
    refresh: () => {
      void refetch();
    },
  };
}
