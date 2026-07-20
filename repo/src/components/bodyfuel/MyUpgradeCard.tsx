import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPackage } from "@/lib/coaching.functions";
import { UpgradeCard } from "./UpgradeCard";
import type { UpgradeTier } from "@/lib/upgrade-events.functions";

/**
 * Liest das aktive Paket des aktuellen Nutzers und rendert die passende
 * UpgradeCard. Coaching-Kunden bekommen nichts angezeigt.
 */
export function MyUpgradeCard({ source = "dashboard" }: { source?: string }) {
  const fn = useServerFn(getMyPackage);
  const { data, isLoading } = useQuery({
    queryKey: ["my-package"],
    queryFn: () => fn(),
    retry: false,
  });

  if (isLoading) return null;
  const pkg = data?.active?.package as string | undefined;
  const status = data?.active?.status as string | undefined;

  let tier: UpgradeTier = "free";
  if (pkg === "smart") tier = "smart";
  else if (pkg === "coaching" || pkg === "starter" || pkg === "premium") tier = "coaching";
  else if (status === "trial" || pkg === "trial") tier = "trial";

  if (tier === "coaching") return null;
  return <UpgradeCard currentTier={tier} source={source} />;
}
