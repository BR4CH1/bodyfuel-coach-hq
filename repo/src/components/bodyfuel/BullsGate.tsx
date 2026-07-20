import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/lib/bodyfuel/session";
import { useEntitlements } from "@/lib/bodyfuel/entitlements";
import { BullsPerformanceOnboardingPopup } from "./BullsPerformanceOnboardingPopup";

export function BullsGate({ children }: { children: ReactNode }) {
  const { hasGroup, loading, supabaseUser, isFreeUser } = useSession();
  const ent = useEntitlements();
  const navigate = useNavigate();

  // Bulls-Zugang: entweder Legacy-Gruppe `bulls` ODER aktive Mitgliedschaft
  // in der Bulls-Organisation. Vereinsathleten (z. B. Jordan) haben keinen
  // user_groups-Eintrag mehr, sondern nur noch organization_memberships —
  // ohne diesen Fallback landeten sie beim Öffnen von /bulls/nutrition,
  // /bulls/training oder /bulls/checkin in einem Redirect-Flackern zurück
  // aufs Home-Dashboard.
  const isBullsOrgAthlete = ent.primaryOrgSlug === "bulls";
  const hasBullsAccess = hasGroup("bulls") || isBullsOrgAthlete;

  useEffect(() => {
    if (loading || ent.loading) return;
    if (!supabaseUser) {
      navigate({ to: "/auth", search: { next: undefined } });
      return;
    }
    if (!hasBullsAccess) {
      navigate({ to: isFreeUser ? "/tracker/app" : "/dashboard" });
    }
  }, [hasBullsAccess, loading, ent.loading, supabaseUser, isFreeUser, navigate]);

  if (loading || ent.loading) return null;
  if (!supabaseUser || !hasBullsAccess) return null;
  return (
    <div className="bulls-theme">
      {children}
      <BullsPerformanceOnboardingPopup />
    </div>
  );
}
