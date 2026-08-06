import { UpgradeCard } from "./UpgradeCard";
import type { UpgradeTier } from "@/lib/upgrade-events.functions";
import { useEntitlement } from "@/hooks/use-entitlement";

/**
 * Rendert die passende UpgradeCard anhand des vereinheitlichten Entitlements.
 * Ein laufender 7-Tage-Test zählt als Smart (Tier "trial"), damit dem Nutzer
 * kein "Free" angezeigt wird, während er vollen Smart-Zugriff hat.
 * Coaching-Kunden bekommen nichts angezeigt.
 */
export function MyUpgradeCard({ source = "dashboard" }: { source?: string }) {
  const { loading, tier: resolved, isTrial } = useEntitlement();

  if (loading) return null;

  let tier: UpgradeTier = "free";
  if (resolved === "coaching") tier = "coaching";
  else if (resolved === "smart") tier = isTrial ? "trial" : "smart";

  if (tier === "coaching") return null;
  return <UpgradeCard currentTier={tier} source={source} />;
}
