import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Entitlement } from "@/lib/entitlements.logic";

/**
 * Liefert das aufgelöste Entitlement des eingeloggten Nutzers.
 * Trial und bezahlte Pakete sind hier bereits vereinheitlicht.
 */
export const getMyEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Entitlement> => {
    const { resolveEntitlementFor } = await import("@/lib/entitlements.server");
    return resolveEntitlementFor(context.userId);
  });
