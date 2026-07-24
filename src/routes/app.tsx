import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { useEntitlements } from "@/lib/bodyfuel/entitlements";
import { getActiveOrgContext } from "@/components/organizations/OrganizationContextSwitcher";
import { getLastAppRoute } from "@/hooks/use-last-app-route";

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

    const lastRoute = getLastAppRoute();
    if (lastRoute && lastRoute !== "/app") {
      navigate({ to: lastRoute as any, replace: true } as any);
      return;
    }

    // Respect the last actively chosen org+role context so refresh keeps the
    // user where they left off — otherwise dual-role users would always be
    // pushed into the coach dashboard on reload.
    const activeCtx = getActiveOrgContext();
    if (activeCtx) {
      const activeOrgId = ent.orgIdsBySlug[activeCtx.slug] ?? null;
      const hasStaffAccess = activeOrgId ? !!ent.staffRolesByOrg[activeOrgId] : false;

      if (activeCtx.mode === "staff" && activeOrgId && hasStaffAccess) {
        navigate({ to: "/coach/teams/$orgId", params: { orgId: activeOrgId }, replace: true });
        return;
      }
      if (activeCtx.mode === "athlete") {
        navigate({ to: "/$orgSlug/home", params: { orgSlug: activeCtx.slug }, replace: true });
        return;
      }
      // Stale staff context after role removal: fall back to the same org's
      // athlete portal instead of sending the user into a forbidden cockpit.
      if (activeCtx.mode === "staff") {
        navigate({ to: "/$orgSlug/home", params: { orgSlug: activeCtx.slug }, replace: true });
        return;
      }
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
