import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { useEntitlements } from "@/lib/bodyfuel/entitlements";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "App — BODYFUEL" }] }),
  component: AppEntryPage,
});

function AppEntryPage() {
  const { supabaseUser, isCoach, isFreeUser, loading } = useSession();
  const ent = useEntitlements();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || ent.loading) return;

    if (!supabaseUser) {
      navigate({ to: "/auth", search: { next: undefined }, replace: true });
      return;
    }

    if (isCoach) {
      navigate({ to: "/coach", replace: true });
      return;
    }

    if (isFreeUser) {
      navigate({ to: "/tracker/app", replace: true });
      return;
    }

    // Vereins-Staff (Vereinsleitung, Head Coach, Team Coach, Staff) landet
    // direkt im Cockpit — NICHT auf der öffentlichen Vereinsseite.
    if (ent.primaryStaffRole && ent.primaryOrgId) {
      navigate({
        to: "/coach/teams/$orgId",
        params: { orgId: ent.primaryOrgId },
        replace: true,
      });
      return;
    }

    // Team-only Athlet: direkt in den Verein leiten, KEIN persönliches Dashboard.
    if (ent.hasTeamAccess && !ent.hasAnyPersonalBodyfuel && ent.primaryOrgSlug) {
      navigate({
        to: "/$orgSlug",
        params: { orgSlug: ent.primaryOrgSlug },
        replace: true,
      });
      return;
    }

    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("body_measurements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", supabaseUser.id);

      if (cancelled) return;
      navigate({ to: (count ?? 0) === 0 ? "/measurements" : "/dashboard", replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    supabaseUser,
    isCoach,
    isFreeUser,
    loading,
    navigate,
    ent.loading,
    ent.hasTeamAccess,
    ent.hasAnyPersonalBodyfuel,
    ent.primaryOrgSlug,
    ent.primaryOrgId,
    ent.primaryStaffRole,
  ]);

  return (
    <div className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
          <Flame className="h-5 w-5" />
        </span>
        App wird geöffnet…
      </div>
    </div>
  );
}
