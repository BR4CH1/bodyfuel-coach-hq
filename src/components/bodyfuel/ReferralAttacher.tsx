import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { attachReferralForSelf } from "@/lib/affiliates.functions";
import { captureReferralFromUrl, clearStoredReferral, getStoredReferral } from "@/lib/referral-tracking";

/**
 * Mountet sich einmal im Root und sorgt dafür, dass:
 * - `?ref=slug` aus jeder Landing-URL in localStorage übernommen wird
 * - Sobald der User eingeloggt ist, der Slug am Profil hinterlegt wird (einmalig)
 */
export function ReferralAttacher() {
  const { supabaseUser, loading } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const attach = useServerFn(attachReferralForSelf);

  // Capture ?ref=… on every navigation
  useEffect(() => {
    captureReferralFromUrl();
  }, [pathname]);

  // After sign-in, attach the stored slug to this user (once)
  useEffect(() => {
    if (loading || !supabaseUser) return;
    const slug = getStoredReferral();
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        // make sure the session bearer is ready
        await supabase.auth.getSession();
        if (cancelled) return;
        await attach({ data: { slug } });
        clearStoredReferral();
      } catch {
        /* silent: tracking is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseUser, loading, attach]);

  return null;
}
